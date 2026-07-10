'use strict';

const deviceType = require('./deviceType.js');
const HomeyEventEmitter = require('./homeyEventEmitter.js');
const utilFunctions = require('./util.js');
const logger = require('./logger.js');
const net = require('net');
const Modbus = require('jsmodbus');

// Default per-request Modbus timeout (ms) when the `timeout` setting is unset,
// e.g. on devices created before the setting existed.
const DEFAULT_TIMEOUT_MS = 5000;

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
    #infoRegistriesRead = false;
    #backoff = new Map(); // key => { attempts, nextRetryTime }
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
        this.options = await this.#validateOptions(this.options);
        this._logMessage('DEBUG', 'Setting up ModBus, connecting with parameters');

        try {
            await this.#initListenersAndConnect();
        } catch (error) {
            this._logError('Failed to initialize device', error);
        }

        // Start health check even if initialization fails, we'll try to reconnect
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
        this.#infoRegistriesRead = false;
        this.#failedRegisters.clear();
        this.#backoff.delete(this.deviceTypeName);
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
                247,
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
                this.#backoff.delete(this.deviceTypeName);

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
        await this.#readInfoRegistries();

        await this.#readDeviceRegistries();
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
            let systemReadings = [];
            for (const registry of systemRegistries) {
                try {
                    const result = await this.#systemModbusClient.readHoldingRegisters(registry.registryId, registry.count);
                    systemReadings.push(result.response._body._valuesAsBuffer);
                    if (this.#failedRegisters.delete(registry.registryId)) {
                        this._logMessage('INFO', `System register ${registry.registryId} (${registry.comment}) recovered`);
                    }
                } catch (regErr) {
                    if (this.#shouldRebuildModbus(regErr)) {
                        throw regErr;
                    }
                    if (!this.#failedRegisters.has(registry.registryId)) {
                        this.#failedRegisters.add(registry.registryId);
                        this._logMessage('INFO', `Register ${registry.registryId} (${registry.comment}) read failed, skipping`);
                    }
                    systemReadings.push(null);
                }
            }

            const processedSystem = deviceType.getSystemValues(this.deviceRegistryType, systemReadings);
            return processedSystem;
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

            let deviceReadings = [];
            for (const registry of readingRegistries) {
                try {
                    const result = await this.#modbusClient.readHoldingRegisters(registry.registryId, registry.count);
                    deviceReadings.push(result.response._body._valuesAsBuffer);
                    if (this.#failedRegisters.delete(registry.registryId)) {
                        this._logMessage('INFO', `Device register ${registry.registryId} (${registry.comment}) recovered`);
                    }
                } catch (regErr) {
                    if (this.#shouldRebuildModbus(regErr)) {
                        throw regErr;
                    }
                    if (!this.#failedRegisters.has(registry.registryId)) {
                        this.#failedRegisters.add(registry.registryId);
                        this._logMessage('INFO', `Register ${registry.registryId} (${registry.comment}) read failed, skipping`);
                    }
                    deviceReadings.push(null);
                }
            }

            let processedReadings = deviceType.getReadingValues(this.deviceRegistryType, deviceReadings);

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

            let readings = [];
            for (const registry of infoRegistries) {
                try {
                    const result = await this.#modbusClient.readHoldingRegisters(registry.registryId, registry.count);
                    readings.push(result.response._body._valuesAsBuffer);
                    if (this.#failedRegisters.delete(registry.registryId)) {
                        this._logMessage('INFO', `Info register ${registry.registryId} (${registry.comment}) recovered`);
                    }
                } catch (regErr) {
                    if (this.#shouldRebuildModbus(regErr)) {
                        throw regErr;
                    }
                    if (!this.#failedRegisters.has(registry.registryId)) {
                        this.#failedRegisters.add(registry.registryId);
                        this._logMessage('INFO', `Register ${registry.registryId} (${registry.comment}) read failed, skipping`);
                    }
                    readings.push(null);
                }
            }

            const processedInfo = deviceType.getInfoValues(this.deviceRegistryType, readings);
            this._logMessage('DEBUG', 'Emitting properties:', processedInfo);
            this.emit('properties', processedInfo);
            this.#infoRegistriesRead = true;

        } catch (err) {
            await this.#handleModbusError('Info registry read failed', err);
        }
    }

    getModbusClient(modbus_unitId) {
        if (modbus_unitId === 247) {
            return this.#systemModbusClient;
        }
        return this.#modbusClient;
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

            const backoffState = this.#backoff.get(this.deviceTypeName) || { attempts: 0, nextRetryTime: 0 };
            const now = Date.now();

            if (now < backoffState.nextRetryTime) {
                this._logMessage('INFO', `Skipping reconnect, next attempt in ${(backoffState.nextRetryTime - now) / 1000}s`);
                return;
            }

            const success = await this.#rebuildModbusClients('health check reconnect', { restartHealthCheck: false });

            if (success) {
                this._logMessage('INFO', `Reconnected successfully`);
                this.#backoff.delete(this.deviceTypeName);
            } else {
                const attempts = backoffState.attempts + 1;
                const baseDelay = 10_000; // 10 seconds
                const maxDelay = 600_000; // 10 minutes max

                const delay = Math.min(Math.pow(2, attempts) * baseDelay, maxDelay);
                const nextRetryTime = Date.now() + delay;

                this._logMessage('INFO', `Reconnect failed (attempt ${attempts}), retrying in ${delay / 1000}s`);
                this.#backoff.set(this.deviceTypeName, { attempts, nextRetryTime });
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
        } catch (error) {
            this._logError('Failed to rebuild Modbus clients', error);
            // A failed reconnect (e.g. the device is powered off / unreachable)
            // does not produce read errors, so feed it into the same telemetry
            // window to still catch sustained outages.
            this.#emitError(`Reconnect failed (${reason})`, error);
            this.#reportErrorTelemetry(`Reconnect failed (${reason})`, error);
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

    createBuffer(numValue, factor) {
        let buffer = Buffer.alloc(2);
        buffer.writeInt16BE(numValue * factor);
        return buffer;
    }
}

module.exports = Base;
