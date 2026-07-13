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

class Base extends HomeyEventEmitter {
    options = {};
    deviceRegistryType = null;
    #connectionTimeout = DEFAULT_TIMEOUT_MS; // Per-request/connection timeout in ms
    #socket = null;
    #modbusClient = null;
    #systemModbusClient = null;
    #pollIntervalId = null;
    #healthCheckIntervalId = null;
    #isReconnecting = false;
    #isPolling = false;
    #infoRegistriesRead = false;
    #backoffState = null; // { attempts, nextRetryTime } | null
    #failedRegisters = new Set();
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
        this._logMessage('DEBUG', 'Setting up ModBus, connecting with parameters');

        try {
            this.options = await this.#validateOptions(this.options);
            await this.#initListenersAndConnect();
            this.#emitConnectionStatus(true);
        } catch (error) {
            this._logError('Failed to initialize device', error);
            this.#emitConnectionStatus(false, error);
        }

        // Always start the health check — it is the single reconnection engine
        // (exponential backoff). Even when the initial validation/connect fails,
        // it keeps retrying and emits 'connectionStatus' once it recovers, so
        // there is no separate retry loop in the device layer.
        this.#startHealthCheck();
    }

    disconnect() {
        this._logMessage('INFO', 'Disconnecting from device');
        if (this.#pollIntervalId) {
            this._clearInterval(this.#pollIntervalId);
        }
        if (this.#healthCheckIntervalId) {
            this._clearInterval(this.#healthCheckIntervalId);
        }
        if (this.#socket) {
            this.#socket.destroy();
        }
        this.#socket = null;
        this.#modbusClient = null;
        this.#systemModbusClient = null;
        this.#pollIntervalId = null;
        this.#healthCheckIntervalId = null;
        this.#isPolling = false;
        this.#infoRegistriesRead = false;
        this.#failedRegisters.clear();
        this.#backoffState = null;
    }

    async #initListenersAndConnect() {

        this.#socket = new net.Socket();
        this.#modbusClient = new Modbus.client.TCP(
            this.#socket,
            this.options.modbus_unitId,
            this.#connectionTimeout
        );

        // If this client also has system registries, create the system client
        if (deviceType.getSystemRegistries(this.deviceRegistryType)?.length) {
            this.#systemModbusClient = new Modbus.client.TCP(
                this.#socket,
                SYSTEM_UNIT_ID,
                this.#connectionTimeout
            );
        }

        return new Promise((resolve, reject) => {
            this.#socket.connect({
                host: this.options.host,
                port: this.options.port,
                timeout: this.#connectionTimeout
            }, () => {
                this._logMessage('INFO', `Socket connected`);
                this.#backoffState = null;

                this.#pollIntervalId = this._setInterval(() => {
                    this.#pollDevice();
                }, this.options.refreshInterval * 1000);

                resolve();
            });

            this.#socket.on('error', (err) => {
                // this._logError(`Socket error: ${err.message}`);
                reject(err);
            });

            this.#socket.on('close', () => {
                this._logMessage('INFO', `Socket closed`);
            });
        });
    }

    async #pollDevice() {
        // Guard against overlapping polls. A single poll can take up to
        // (registers × per-request timeout) on a slow/unresponsive device,
        // which may exceed refreshInterval. Without this guard, setInterval
        // would stack concurrent polls on the same socket and cause the
        // OutOfSync / "fc does not match" errors that force a rebuild.
        if (this.#isPolling) {
            this._logMessage('INFO', 'Previous poll still in progress, skipping this cycle');
            return;
        }

        this.#isPolling = true;
        try {
            await this.#readInfoRegistries();
            await this.#readDeviceRegistries();
        } finally {
            this.#isPolling = false;
        }
    }

    /**
     * Read a set of registries from the given client, one register at a time.
     *
     * Individual register failures are tolerated: that slot becomes `null` and
     * the register is flagged (and logged once) as failed until it recovers.
     * A connection-level error (see #shouldRebuildModbus) is rethrown so the
     * caller's catch can route it to #handleModbusError and trigger a rebuild.
     *
     * The result is a map of { registryKey: Buffer|null } which deviceType
     * .decodeValues consumes directly (paired by name, not by array position).
     *
     * @param {Array<{key: string, registryId: number, count: number, comment: string}>} registries
     * @param {object} client - the modbus client to read from
     * @param {string} label - label used in recovery logs ('System'|'Device'|'Info')
     * @returns {Promise<Object<string, (Buffer|null)>>}
     */
    async #readRegistrySet(registries, client, label) {
        const buffers = {};
        for (const registry of registries) {
            try {
                const result = await client.readHoldingRegisters(registry.registryId, registry.count);
                buffers[registry.key] = getRegisterBuffer(result);
                if (this.#failedRegisters.delete(registry.registryId)) {
                    this._logMessage('INFO', `${label} register ${registry.registryId} (${registry.comment}) recovered`);
                }
            } catch (regErr) {
                if (this.#shouldRebuildModbus(regErr)) {
                    throw regErr;
                }
                if (!this.#failedRegisters.has(registry.registryId)) {
                    this.#failedRegisters.add(registry.registryId);
                    this._logMessage('INFO', `Register ${registry.registryId} (${registry.comment}) read failed, skipping`);
                }
                buffers[registry.key] = null;
            }
        }
        return buffers;
    }

    async #readSystemRegistries() {

        const systemRegistries = deviceType.getSystemRegistries(this.deviceRegistryType);

        if (!systemRegistries?.length) {
            this._logMessage('DEBUG', 'No system registries');
            return null;
        }

        if (!this.#isConnected(this.#systemModbusClient)) {
            this._logMessage('INFO', 'Skipping system registry read — system modbus client not connected');
            return null;
        }

        try {
            const systemReadings = await this.#readRegistrySet(systemRegistries, this.#systemModbusClient, 'System');
            return deviceType.decodeValues(this.deviceRegistryType, systemReadings);
        } catch (err) {
            await this.#handleModbusError('System registry read failed', err);
            return null;
        }
    }

    async #readDeviceRegistries() {

        if (!this.#isConnected(this.#modbusClient)) {
            this._logMessage('INFO', 'Skipping device registry read — device modbus client not connected');
            return;
        }

        try {
            const readingRegistries = deviceType.getReadingRegistries(this.deviceRegistryType);
            const deviceReadings = await this.#readRegistrySet(readingRegistries, this.#modbusClient, 'Device');

            let processedReadings = deviceType.decodeValues(this.deviceRegistryType, deviceReadings);

            const systemReadings = await this.#readSystemRegistries();
            if (systemReadings) {
                Object.assign(processedReadings, systemReadings);
            }

            this._logMessage('DEBUG', 'Emitting readings:', processedReadings);
            this.emit('readings', processedReadings);
        } catch (err) {
            await this.#handleModbusError('Device registry read failed', err);
        }
    }

    async #readInfoRegistries() {
        if (this.#infoRegistriesRead) {
            return;
        }

        if (!this.#isConnected(this.#modbusClient)) {
            this._logMessage('INFO', 'Skipping info registry read — device modbus client not connected');
            return;
        }

        try {
            const infoRegistries = deviceType.getInfoRegistries(this.deviceRegistryType);
            const readings = await this.#readRegistrySet(infoRegistries, this.#modbusClient, 'Info');

            const processedInfo = deviceType.decodeValues(this.deviceRegistryType, readings);
            this._logMessage('DEBUG', 'Emitting properties:', processedInfo);
            this.emit('properties', processedInfo);
            this.#infoRegistriesRead = true;

        } catch (err) {
            await this.#handleModbusError('Info registry read failed', err);
        }
    }

    getModbusClient(modbus_unitId) {
        if (modbus_unitId === SYSTEM_UNIT_ID) {
            return this.#systemModbusClient;
        }
        return this.#modbusClient;
    }

    /**
     * Write holding registers with the same resilience as the read path.
     *
     * Refuses to write when the client is not connected (clear error instead of
     * a null-deref), and on a connection-level failure (OutOfSync / ECONNRESET /
     * fc mismatch — see #shouldRebuildModbus) surfaces the error and triggers a
     * client rebuild, exactly like reads. The error is always rethrown so the
     * caller (capability listener / flow action) can report the failure to the
     * user; functional Modbus exceptions (e.g. illegal value) propagate without
     * forcing a rebuild.
     *
     * @param {number} registryId - the starting holding-register address
     * @param {Buffer} buffer - the register payload to write
     * @param {number} [modbus_unitId] - unit id override (defaults to the device client)
     * @returns {Promise<true>} resolves true on success
     */
    async writeRegisters(registryId, buffer, modbus_unitId) {
        const client = this.getModbusClient(modbus_unitId);

        if (!this.#isConnected(client)) {
            throw new Error(`Cannot write to register ${registryId}: Modbus client not connected`);
        }

        try {
            await client.writeMultipleRegisters(registryId, buffer);
            return true;
        } catch (err) {
            if (this.#shouldRebuildModbus(err)) {
                await this.#handleModbusError(`Write to register ${registryId} failed`, err);
            }
            throw err;
        }
    }

    #startHealthCheck() {
        if (this.#healthCheckIntervalId) {
            this._clearInterval(this.#healthCheckIntervalId);
        }

        this.#healthCheckIntervalId = this._setInterval(async () => {

            // Check if socket is healthy
            if (this.#socket && !this.#socket.destroyed && this.#socket.readable && this.#socket.writable) {
                this._logMessage('DEBUG', 'Socket healthy');
                return;
            }

            if (this.#isReconnecting) {
                this._logMessage('INFO', 'Reconnect already in progress, skipping health check cycle');
                return;
            }

            this._logError(`Socket unhealthy, attempting reconnect`);

            const backoffState = this.#backoffState || { attempts: 0, nextRetryTime: 0 };
            const now = Date.now();

            if (now < backoffState.nextRetryTime) {
                this._logMessage('INFO', `Skipping reconnect, next attempt in ${(backoffState.nextRetryTime - now) / 1000}s`);
                return;
            }

            const success = await this.#rebuildModbusClients('health check reconnect', { restartHealthCheck: false });

            if (success) {
                this._logMessage('INFO', `Reconnected successfully`);
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

            this.#startHealthCheck();
        }, 20_000); // Run every 20s
    }

    async #handleModbusError(context, err) {
        this._logError(`${context}:`, err);

        // Surface to the device (populates the "last error" debug setting) and
        // feed the sustained-failure telemetry window.
        this.#emitError(context, err);
        this.#reportErrorTelemetry(context, err);

        if (this.#shouldRebuildModbus(err)) {
            await this.#rebuildModbusClients(context);
        }
    }

    // Surface an error to the Homey device via the 'error' event, which
    // baseDevice._handleErrorEvent turns into the readable "last error" debug
    // setting. Guarded by listenerCount so it never throws when no listener is
    // attached (e.g. a local unit test without a device).
    #emitError(context, err) {
        try {
            if (this.listenerCount('error') > 0) {
                const message = utilFunctions.formatError(err);
                this.emit('error', new Error(`${context}: ${message}`));
            }
        } catch (_) {
            // Never let error surfacing break the poll/reconnect loop.
        }
    }

    // Report connection state to the device (which maps it to setAvailable /
    // setUnavailable). This is the single source of truth for availability, so
    // the device layer no longer runs its own reconnect timer. Guarded so a
    // listener error can never break the poll/reconnect loop, and a no-op when
    // no listener is attached (e.g. a local unit test without a device).
    #emitConnectionStatus(connected, error) {
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
    // per interval so we can see across installs which device types / Homey
    // firmware versions are affected, and with which polling/timeout settings.
    // The logger rate-limits and is a no-op when Sentry is not configured; this
    // must never throw.
    #reportErrorTelemetry(context, err) {
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
                        // As tags (not just extra) so events can be grouped and
                        // filtered by the polling / timeout values in use.
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

        if (err.err === 'OutOfSync') {
            return true;
        }

        const message = typeof err.message === 'string' ? err.message : '';
        if (message.includes('fc and response fc does not match')) {
            return true;
        }

        const code = err.code;
        if (code && ['ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(code)) {
            return true;
        }

        return false;
    }

    async #rebuildModbusClients(reason, { restartHealthCheck = true } = {}) {
        if (this.#isReconnecting) {
            this._logMessage('INFO', `Reconnect already in progress (${reason})`);
            return false;
        }

        this.#isReconnecting = true;
        let success = false;

        this._logMessage('INFO', `Rebuilding Modbus clients (${reason})`);

        try {
            this.disconnect();
            await this.#initListenersAndConnect();
            success = true;
            this._logMessage('INFO', 'Modbus clients rebuilt successfully');
            this.#emitConnectionStatus(true);
        } catch (error) {
            this._logError('Failed to rebuild Modbus clients', error);
            // A failed reconnect (e.g. the device is powered off / unreachable)
            // does not produce read errors, so feed it into the same telemetry
            // window to still catch sustained outages.
            this.#emitError(`Reconnect failed (${reason})`, error);
            this.#reportErrorTelemetry(`Reconnect failed (${reason})`, error);
            this.#emitConnectionStatus(false, error);
        } finally {
            this.#isReconnecting = false;
            if (restartHealthCheck) {
                this.#startHealthCheck();
            }
        }

        return success;
    }

    #isConnected(client) {
        return client && client._socket && client._socket.readable && client._socket.writable && !client._socket.destroyed && !client._socket.connecting;
    }

    async #validateOptions(options) {
        if (!options) {
            throw new Error('Missing input options!');
        }

        if (options.modbus_unitId) {
            // Make sure unitId exists and is a number
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
