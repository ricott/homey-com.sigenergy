'use strict';

const deviceType = require('./deviceType.js');
const HomeyEventEmitter = require('./homeyEventEmitter.js');
const utilFunctions = require('./util.js');
const { getRegisterBuffer } = require('./modbus/utils.js');
const logger = require('./logger.js');
const net = require('net');
const Modbus = require('jsmodbus');

// Default per-request Modbus timeout (ms) when the `timeout` setting is unset,
// e.g. on devices created before the setting existed.
const DEFAULT_TIMEOUT_MS = 5000;

// Modbus unit id for the Sigenergy "system" register space (plant-level values).
// A second client is created on this unit id for device types that expose
// SYSTEM registries.
const SYSTEM_UNIT_ID = 247;

// Read-coalescing bounds. Contiguous registers within MODBUS_MAX_COALESCE_GAP
// registers of each other are fetched in a single readHoldingRegisters call, up
// to MODBUS_MAX_COALESCE_RUN registers per read (the Modbus spec caps a read at
// 125 registers). Bridging small gaps lets a range span a few reserved holes.
const MODBUS_MAX_COALESCE_GAP = 8;
const MODBUS_MAX_COALESCE_RUN = 120;

const SESSION_CANCELLED_CODE = 'BASE_SESSION_CANCELLED';

class Base extends HomeyEventEmitter {
    options = {};
    deviceRegistryType = null;
    #connectionTimeout = DEFAULT_TIMEOUT_MS; // Per-request/connection timeout in ms
    #socket = null;
    #modbusClient = null;
    #systemModbusClient = null;
    #pollIntervalId = null;
    #healthCheckIntervalId = null;
    #pendingConnect = null;
    #connectionGeneration = 0;
    #stopped = false;
    #isReconnecting = false;
    #isPolling = false;
    #infoRegistriesRead = false;
    #backoffState = null; // { attempts, nextRetryTime } | null
    #failedRegisters = new Set();
    // Run keys ("start:count") the device rejected as a single range read, so we
    // stop attempting to coalesce them and read those registers individually.
    #coalesceBlocklist = new Set();
    // Sliding window of recent serious-error timestamps, used to detect a
    // sustained failure state and report it (rate-limited) for blast-radius
    // telemetry.
    #errorTimestamps = [];

    constructor(deviceRegistryType, options) {
        super();

        if (!deviceRegistryType) {
            this._logError('deviceRegistryType is mandatory input');
            throw new Error('deviceRegistryType is mandatory input');
        }
        this.deviceRegistryType = deviceRegistryType;
        this.deviceTypeName = deviceRegistryType.name || deviceRegistryType.constructor.name;
        this.options = options;

        // Resolve the per-request Modbus timeout (seconds -> ms). Falls back to
        // the default when unset or invalid.
        const timeoutSeconds = Number(options?.timeout);
        this.#connectionTimeout = (Number.isFinite(timeoutSeconds) && timeoutSeconds > 0)
            ? timeoutSeconds * 1000
            : DEFAULT_TIMEOUT_MS;
    }

    async initialize() {
        if (this.#stopped) {
            return;
        }

        this._logMessage('DEBUG', 'Setting up ModBus, connecting with parameters');

        try {
            this.options = await this.#validateOptions(this.options);
            this.#throwIfStopped();
            await this.#initListenersAndConnect();
            this.#throwIfStopped();
            this.#emitConnectionStatus(true);
        } catch (error) {
            if (this.#stopped || this.#isCancellationError(error)) {
                return;
            }

            this.#cleanupConnection();
            this._logError('Failed to initialize device', error);
            this.#emitConnectionStatus(false, error);
        }

        // The health check is the single reconnection engine (exponential
        // backoff). It remains active across internal client rebuilds.
        if (!this.#stopped) {
            this.#startHealthCheck();
        }
    }

    disconnect() {
        if (this.#stopped) {
            return;
        }

        this.#stopped = true;
        this._logMessage('INFO', 'Disconnecting from device');

        // Device-facing listeners are removed before transport teardown so no
        // in-flight continuation can update a replaced/deleted Homey device.
        this.removeAllListeners();

        if (this.#healthCheckIntervalId) {
            this._clearInterval(this.#healthCheckIntervalId);
            this.#healthCheckIntervalId = null;
        }

        this.#cleanupConnection();
        this.#isReconnecting = false;
        this.#backoffState = null;
        this.#errorTimestamps = [];
    }

    #cleanupConnection() {
        const socket = this.#socket;
        const pendingConnect = this.#pendingConnect;

        // Invalidate the transport before touching it. All async continuations
        // compare this token and the captured client/socket before doing work.
        this.#connectionGeneration += 1;

        if (this.#pollIntervalId) {
            this._clearInterval(this.#pollIntervalId);
            this.#pollIntervalId = null;
        }

        this.#socket = null;
        this.#modbusClient = null;
        this.#systemModbusClient = null;
        this.#isPolling = false;
        this.#infoRegistriesRead = false;
        this.#failedRegisters.clear();
        this.#coalesceBlocklist.clear();

        if (pendingConnect && pendingConnect.socket === socket) {
            pendingConnect.cancel();
        }

        if (socket) {
            // Keep socket listeners attached through destroy so jsmodbus sees
            // close and rejects/clears its active and queued requests. Our own
            // socket callbacks are generation guarded against stale effects.
            if (!socket.destroyed) {
                socket.destroy();
            }
        }
    }

    async #initListenersAndConnect() {
        this.#throwIfStopped();

        const generation = this.#connectionGeneration + 1;
        const socket = new net.Socket();
        const modbusClient = new Modbus.client.TCP(
            socket,
            this.options.modbus_unitId,
            this.#connectionTimeout
        );
        let systemModbusClient = null;

        // If this client also has system registries, create the system client.
        if (deviceType.getSystemRegistries(this.deviceRegistryType)?.length) {
            systemModbusClient = new Modbus.client.TCP(
                socket,
                SYSTEM_UNIT_ID,
                this.#connectionTimeout
            );
        }

        this.#connectionGeneration = generation;
        this.#socket = socket;
        this.#modbusClient = modbusClient;
        this.#systemModbusClient = systemModbusClient;

        await new Promise((resolve, reject) => {
            const pendingConnect = {
                socket,
                generation,
                settled: false,
                cancel: null
            };

            const settle = (error) => {
                if (pendingConnect.settled) {
                    return;
                }

                pendingConnect.settled = true;
                if (this.#pendingConnect === pendingConnect) {
                    this.#pendingConnect = null;
                }

                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            };

            pendingConnect.cancel = () => settle(this.#createCancellationError());
            this.#pendingConnect = pendingConnect;

            const onError = (error) => {
                if (!this.#isCurrentConnection(socket, generation)) {
                    return;
                }
                settle(error);
            };

            const onClose = () => {
                if (!this.#isCurrentConnection(socket, generation)) {
                    return;
                }

                this._logMessage('INFO', 'Socket closed');
                const error = new Error('Socket closed before connection completed');
                error.code = 'ECONNRESET';
                settle(error);
            };

            const onTimeout = () => {
                if (!this.#isCurrentConnection(socket, generation) || pendingConnect.settled) {
                    return;
                }

                const error = new Error('Socket connection timed out');
                error.code = 'ETIMEDOUT';
                settle(error);
                socket.destroy();
            };

            socket.on('error', onError);
            socket.on('close', onClose);
            socket.on('timeout', onTimeout);

            try {
                socket.connect({
                    host: this.options.host,
                    port: this.options.port,
                    timeout: this.#connectionTimeout
                }, () => {
                    if (pendingConnect.settled) {
                        return;
                    }
                    if (!this.#isCurrentConnection(socket, generation)) {
                        settle(this.#createCancellationError());
                        return;
                    }

                    this._logMessage('INFO', 'Socket connected');
                    this.#backoffState = null;
                    this.#pollIntervalId = this._setInterval(() => {
                        if (this.#isCurrentConnection(socket, generation)) {
                            this.#pollDevice(generation);
                        }
                    }, this.options.refreshInterval * 1000);
                    settle();
                });
            } catch (error) {
                settle(error);
            }
        });

        if (!this.#isCurrentConnection(socket, generation)) {
            throw this.#createCancellationError();
        }
    }

    async #pollDevice(generation) {
        if (this.#stopped || generation !== this.#connectionGeneration) {
            return;
        }

        // Guard against overlapping polls. A single poll can take up to
        // (registers × per-request timeout) on a slow/unresponsive device,
        // which may exceed refreshInterval.
        if (this.#isPolling) {
            this._logMessage('INFO', 'Previous poll still in progress, skipping this cycle');
            return;
        }

        this.#isPolling = generation;
        try {
            await this.#readInfoRegistries(generation);
            if (this.#stopped || generation !== this.#connectionGeneration) {
                return;
            }
            await this.#readDeviceRegistries(generation);
        } finally {
            if (this.#isPolling === generation) {
                this.#isPolling = false;
            }
        }
    }

    /**
     * Read a set of registries, coalescing contiguous ones into single range
     * reads to cut round-trips (lower latency and desync risk). The result is a
     * map of { registryKey: Buffer|null } which deviceType.decodeValues consumes
     * directly (paired by name, not by array position).
     */
    async #readRegistrySet(registries, client, label, generation) {
        const buffers = {};
        const runs = deviceType.groupRegistersIntoRuns(registries, {
            maxGap: MODBUS_MAX_COALESCE_GAP,
            maxRun: MODBUS_MAX_COALESCE_RUN
        });

        for (const run of runs) {
            this.#assertActiveClient(client, generation);
            const runKey = `${run.start}:${run.count}`;

            // A lone register, or a run the device previously rejected as a
            // range, is read one register at a time.
            if (run.registers.length === 1 || this.#coalesceBlocklist.has(runKey)) {
                for (const reg of run.registers) {
                    this.#assertActiveClient(client, generation);
                    buffers[reg.key] = await this.#readSingleRegister(reg, client, label, generation);
                }
                continue;
            }

            try {
                const result = await client.readHoldingRegisters(run.start, run.count);
                this.#assertActiveClient(client, generation);
                const runBuffer = getRegisterBuffer(result);
                const slices = deviceType.sliceRunBuffer(runBuffer, run);
                for (const reg of run.registers) {
                    buffers[reg.key] = slices[reg.key];
                    if (this.#failedRegisters.delete(reg.registryId)) {
                        this._logMessage('INFO', `${label} register ${reg.registryId} (${reg.comment}) recovered`);
                    }
                }
            } catch (runErr) {
                if (this.#isCancellationError(runErr)) {
                    throw runErr;
                }
                if (!this.#isActiveClient(client, generation)) {
                    throw this.#createCancellationError();
                }
                if (this.#shouldRebuildModbus(runErr)) {
                    throw runErr;
                }

                // Range read unsupported/failed — remember it and fall back to
                // per-register reads so a single unmapped register cannot blank
                // the whole group.
                if (!this.#coalesceBlocklist.has(runKey)) {
                    this.#coalesceBlocklist.add(runKey);
                    this._logMessage('INFO', `${label} coalesced read ${run.start}+${run.count} failed, using per-register reads`);
                }
                for (const reg of run.registers) {
                    this.#assertActiveClient(client, generation);
                    buffers[reg.key] = await this.#readSingleRegister(reg, client, label, generation);
                }
            }
        }

        this.#assertActiveClient(client, generation);
        return buffers;
    }

    /**
     * Read a single register, tolerating a soft failure: returns its buffer, or
     * null while flagging (and logging once) the register as failed until it
     * recovers. A connection-level error is rethrown.
     */
    async #readSingleRegister(registry, client, label, generation) {
        this.#assertActiveClient(client, generation);

        try {
            const result = await client.readHoldingRegisters(registry.registryId, registry.count);
            this.#assertActiveClient(client, generation);
            const buffer = getRegisterBuffer(result);
            if (this.#failedRegisters.delete(registry.registryId)) {
                this._logMessage('INFO', `${label} register ${registry.registryId} (${registry.comment}) recovered`);
            }
            return buffer;
        } catch (regErr) {
            if (this.#isCancellationError(regErr)) {
                throw regErr;
            }
            if (!this.#isActiveClient(client, generation)) {
                throw this.#createCancellationError();
            }
            if (this.#shouldRebuildModbus(regErr)) {
                throw regErr;
            }
            if (!this.#failedRegisters.has(registry.registryId)) {
                this.#failedRegisters.add(registry.registryId);
                this._logMessage('INFO', `Register ${registry.registryId} (${registry.comment}) read failed, skipping`);
            }
            return null;
        }
    }

    async #readSystemRegistries(generation) {
        const systemRegistries = deviceType.getSystemRegistries(this.deviceRegistryType);

        if (!systemRegistries?.length) {
            this._logMessage('DEBUG', 'No system registries');
            return null;
        }

        const client = this.#systemModbusClient;
        if (!this.#isActiveClient(client, generation)) {
            throw this.#createCancellationError();
        }

        if (!this.#isConnected(client)) {
            const error = new Error('System Modbus client is not connected');
            error.err = 'Offline';
            throw error;
        }

        try {
            const systemReadings = await this.#readRegistrySet(systemRegistries, client, 'System', generation);
            this.#assertActiveClient(client, generation);
            return deviceType.decodeValues(this.deviceRegistryType, systemReadings);
        } catch (err) {
            if (this.#isCancellationError(err) || this.#shouldRebuildModbus(err)) {
                // Poisoning errors must reach the device sweep so its already
                // decoded device portion is discarded rather than emitted.
                throw err;
            }
            await this.#handleModbusError('System registry read failed', err, { client, generation });
            return null;
        }
    }

    async #readDeviceRegistries(generation) {
        const client = this.#modbusClient;
        if (!this.#isActiveClient(client, generation)) {
            return;
        }

        if (!this.#isConnected(client)) {
            this._logMessage('INFO', 'Skipping device registry read — device modbus client not connected');
            return;
        }

        try {
            const readingRegistries = deviceType.getReadingRegistries(this.deviceRegistryType);
            const deviceReadings = await this.#readRegistrySet(readingRegistries, client, 'Device', generation);
            this.#assertActiveClient(client, generation);

            const processedReadings = deviceType.decodeValues(this.deviceRegistryType, deviceReadings);
            const systemReadings = await this.#readSystemRegistries(generation);
            this.#assertActiveClient(client, generation);

            if (systemReadings) {
                Object.assign(processedReadings, systemReadings);
            }

            if (Object.keys(processedReadings).length === 0) {
                return;
            }

            this._logMessage('DEBUG', 'Emitting readings:', processedReadings);
            this.emit('readings', processedReadings);
        } catch (err) {
            if (this.#isCancellationError(err)
                || this.#stopped
                || generation !== this.#connectionGeneration) {
                return;
            }
            await this.#handleModbusError('Device registry read failed', err, { generation });
        }
    }

    async #readInfoRegistries(generation) {
        if (this.#infoRegistriesRead) {
            return;
        }

        const client = this.#modbusClient;
        if (!this.#isActiveClient(client, generation)) {
            return;
        }

        if (!this.#isConnected(client)) {
            this._logMessage('INFO', 'Skipping info registry read — device modbus client not connected');
            return;
        }

        try {
            const infoRegistries = deviceType.getInfoRegistries(this.deviceRegistryType);
            const readings = await this.#readRegistrySet(infoRegistries, client, 'Info', generation);
            this.#assertActiveClient(client, generation);
            const processedInfo = deviceType.decodeValues(this.deviceRegistryType, readings);

            if (Object.keys(processedInfo).length === 0) {
                return;
            }

            this._logMessage('DEBUG', 'Emitting properties:', processedInfo);
            this.emit('properties', processedInfo);
            this.#infoRegistriesRead = true;
        } catch (err) {
            if (this.#isCancellationError(err)
                || this.#stopped
                || generation !== this.#connectionGeneration) {
                return;
            }
            await this.#handleModbusError('Info registry read failed', err, { client, generation });
        }
    }

    getModbusClient(modbus_unitId) {
        if (this.#stopped) {
            return null;
        }
        if (modbus_unitId === SYSTEM_UNIT_ID) {
            return this.#systemModbusClient;
        }
        return this.#modbusClient;
    }

    /**
     * Write holding registers with the same resilience as the read path.
     *
     * @param {number} registryId - the starting holding-register address
     * @param {Buffer} buffer - the register payload to write
     * @param {number} [modbus_unitId] - unit id override (defaults to the device client)
     * @returns {Promise<true>} resolves true on success
     */
    async writeRegisters(registryId, buffer, modbus_unitId) {
        const generation = this.#connectionGeneration;
        const client = this.getModbusClient(modbus_unitId);

        if (!this.#isConnected(client)) {
            throw new Error(`Cannot write to register ${registryId}: Modbus client not connected`);
        }

        try {
            await client.writeMultipleRegisters(registryId, buffer);
            this.#assertActiveClient(client, generation);
            return true;
        } catch (err) {
            if (this.#isCancellationError(err) || !this.#isActiveClient(client, generation)) {
                throw this.#createCancellationError();
            }
            if (this.#shouldRebuildModbus(err)) {
                await this.#handleModbusError(`Write to register ${registryId} failed`, err, { client, generation });
            }
            throw err;
        }
    }

    #startHealthCheck() {
        if (this.#stopped || this.#healthCheckIntervalId) {
            return;
        }

        this.#healthCheckIntervalId = this._setInterval(async () => {
            if (this.#stopped) {
                return;
            }

            // Check if socket is healthy.
            if (this.#socket && !this.#socket.destroyed && this.#socket.readable && this.#socket.writable) {
                this._logMessage('DEBUG', 'Socket healthy');
                return;
            }

            if (this.#isReconnecting) {
                this._logMessage('INFO', 'Reconnect already in progress, skipping health check cycle');
                return;
            }

            const backoffState = this.#backoffState || { attempts: 0, nextRetryTime: 0 };
            const now = Date.now();

            if (now < backoffState.nextRetryTime) {
                this._logMessage('INFO', `Skipping reconnect, next attempt in ${(backoffState.nextRetryTime - now) / 1000}s`);
                return;
            }

            this._logError('Socket unhealthy, attempting reconnect');
            const success = await this.#rebuildModbusClients('health check reconnect');

            if (this.#stopped) {
                return;
            }

            if (success) {
                this._logMessage('INFO', 'Reconnected successfully');
                this.#backoffState = null;
            } else {
                const attempts = backoffState.attempts + 1;
                const baseDelay = 10_000; // 10 seconds
                const maxDelay = 600_000; // 10 minutes max
                const delay = Math.min(Math.pow(2, attempts) * baseDelay, maxDelay);
                const nextRetryTime = Date.now() + delay;

                this._logMessage('INFO', `Reconnect failed (attempt ${attempts}), retrying in ${delay / 1000}s`);
                this.#backoffState = { attempts, nextRetryTime };
            }
        }, 20_000); // Run every 20s
    }

    async #handleModbusError(context, err, { client = null, generation = null } = {}) {
        if (this.#stopped
            || this.#isCancellationError(err)
            || (generation !== null && generation !== this.#connectionGeneration)
            || (client && !this.#isActiveClient(client, generation))) {
            return;
        }

        this._logError(`${context}:`, err);

        // Surface to the device (populates the "last error" debug setting) and
        // feed the sustained-failure telemetry window.
        this.#emitError(context, err);
        this.#reportErrorTelemetry(context, err);

        if (this.#shouldRebuildModbus(err) && !this.#stopped) {
            await this.#rebuildModbusClients(context);
        }
    }

    // Surface an error to the Homey device via the 'error' event. Guarded by
    // listenerCount so it never throws when no listener is attached.
    #emitError(context, err) {
        if (this.#stopped) {
            return;
        }

        try {
            if (this.listenerCount('error') > 0) {
                const message = utilFunctions.formatError(err);
                this.emit('error', new Error(`${context}: ${message}`));
            }
        } catch (_) {
            // Never let error surfacing break the poll/reconnect loop.
        }
    }

    // Report connection state to the device. Guarded so a listener error can
    // never break the poll/reconnect loop.
    #emitConnectionStatus(connected, error) {
        if (this.#stopped) {
            return;
        }

        try {
            if (this.listenerCount('connectionStatus') > 0) {
                this.emit('connectionStatus', { connected, error });
            }
        } catch (_) {
            // Never let availability surfacing break the poll/reconnect loop.
        }
    }

    // Records a serious error and, when errors arrive in bursts (a sustained
    // failure rather than an occasional glitch), reports one event per device
    // per interval so we can see which device types/settings are affected.
    #reportErrorTelemetry(context, err) {
        if (this.#stopped) {
            return;
        }

        try {
            const now = Date.now();
            const windowMs = 10 * 60 * 1000; // 10 minutes
            const threshold = 10;            // errors within the window => sustained problem

            this.#errorTimestamps.push(now);
            this.#errorTimestamps = this.#errorTimestamps.filter(t => now - t <= windowMs);

            if (this.#errorTimestamps.length < threshold) {
                return;
            }

            const device = this.options?.device;
            let driverId = 'unknown';
            let deviceId = this.deviceTypeName;
            let homeyVersion = 'unknown';
            try { driverId = device?.driver?.id || 'unknown'; } catch (_) { /* ignore */ }
            try { deviceId = device?.getData?.().id || this.deviceTypeName; } catch (_) { /* ignore */ }
            try { homeyVersion = device?.homey?.version || 'unknown'; } catch (_) { /* ignore */ }

            logger.report(
                `modbus-sustained-failure:${driverId}:${deviceId}`,
                'Sustained Modbus failures',
                {
                    level: 'warning',
                    tags: {
                        deviceType: this.deviceTypeName,
                        driver: driverId,
                        homeyVersion,
                        refreshInterval: String(this.options?.refreshInterval),
                        timeout: String(this.options?.timeout)
                    },
                    extra: {
                        context,
                        errorsInWindow: this.#errorTimestamps.length,
                        windowMinutes: 10,
                        refreshInterval: this.options?.refreshInterval,
                        timeoutSetting: this.options?.timeout,
                        modbusUnitId: this.options?.modbus_unitId,
                        lastError: utilFunctions.formatError(err)
                    }
                }
            );
        } catch (_) {
            // Telemetry must never affect device operation.
        }
    }

    #shouldRebuildModbus(err) {
        if (!err) {
            return false;
        }

        const modbusError = typeof err.err === 'string' ? err.err.toLowerCase() : '';
        if (['offline', 'outofsync', 'protocol', 'timeout'].includes(modbusError)) {
            return true;
        }

        const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';
        if (message.includes('fc and response fc does not match')) {
            return true;
        }

        const code = typeof err.code === 'string' ? err.code.toUpperCase() : '';
        return ['ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(code);
    }

    async #rebuildModbusClients(reason) {
        if (this.#stopped) {
            return false;
        }

        if (this.#isReconnecting) {
            this._logMessage('INFO', `Reconnect already in progress (${reason})`);
            return false;
        }

        this.#isReconnecting = true;
        let success = false;

        // Poisoned/failed transports are unavailable until a fresh connection
        // succeeds. Emit once per rebuild attempt; the failure path below does
        // not repeat the transition.
        this.#emitConnectionStatus(false);
        this._logMessage('INFO', `Rebuilding Modbus clients (${reason})`);

        try {
            // Internal rebuilding invalidates only the transport generation; it
            // does not permanently stop this Base or restart its health timer.
            this.#cleanupConnection();
            this.#throwIfStopped();
            await this.#initListenersAndConnect();
            this.#throwIfStopped();
            success = true;
            this._logMessage('INFO', 'Modbus clients rebuilt successfully');
            this.#emitConnectionStatus(true);
        } catch (error) {
            if (!this.#stopped && !this.#isCancellationError(error)) {
                this.#cleanupConnection();
                this._logError('Failed to rebuild Modbus clients', error);
                // A failed reconnect does not produce read errors, so feed it
                // into the same telemetry window to catch sustained outages.
                this.#emitError(`Reconnect failed (${reason})`, error);
                this.#reportErrorTelemetry(`Reconnect failed (${reason})`, error);
            }
        } finally {
            this.#isReconnecting = false;
        }

        return success;
    }

    #isCurrentConnection(socket, generation) {
        return !this.#stopped
            && generation === this.#connectionGeneration
            && socket === this.#socket;
    }

    #isActiveClient(client, generation) {
        return !this.#stopped
            && generation === this.#connectionGeneration
            && client !== null
            && (client === this.#modbusClient || client === this.#systemModbusClient);
    }

    #assertActiveClient(client, generation) {
        if (!this.#isActiveClient(client, generation)) {
            throw this.#createCancellationError();
        }
    }

    #throwIfStopped() {
        if (this.#stopped) {
            throw this.#createCancellationError();
        }
    }

    #createCancellationError() {
        const error = new Error('Base session is no longer active');
        error.code = SESSION_CANCELLED_CODE;
        return error;
    }

    #isCancellationError(error) {
        return error?.code === SESSION_CANCELLED_CODE;
    }

    #isConnected(client) {
        return client
            && client._socket
            && client._socket.readable
            && client._socket.writable
            && !client._socket.destroyed
            && !client._socket.connecting;
    }

    async #validateOptions(options) {
        if (!options) {
            throw new Error('Missing input options!');
        }

        if (options.modbus_unitId) {
            // Make sure unitId exists and is a number.
            options.modbus_unitId = Number(options.modbus_unitId);
        } else {
            throw new Error('modbus_unitId is mandatory input');
        }

        if (options.host && !utilFunctions.validateIPaddress(options.host)) {
            throw new Error(`Invalid IP address '${options.host}'`);
        }

        const available = await utilFunctions.isPortAvailable(options.host, options.port);
        if (!available) {
            throw new Error(`Port '${options.port}' on IP Address '${options.host}' is NOT reachable`);
        }

        return options;
    }
}

module.exports = Base;
