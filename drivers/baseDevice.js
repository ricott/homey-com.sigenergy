'use strict';

const { Device } = require('homey');
const utilFunctions = require('../lib/util.js');

const DEFAULT_REFRESH_INTERVAL_SECONDS = 10;
const DEFAULT_REQUEST_TIMEOUT_SECONDS = 5;
const MIN_DATA_STALE_THRESHOLD_MS = 30_000;
const MIN_WATCHDOG_INTERVAL_MS = 5_000;
const MAX_WATCHDOG_INTERVAL_MS = 30_000;
const EXPECTED_REQUESTS_PER_SWEEP = 12;

class BaseDevice extends Device {

    async onInit() {
        this.api = null;
        this._sessionGeneration = 0;
        this._deleted = false;
        this._apiEventListeners = null;
        this._availabilityWatchdogId = null;
        this._sessionStartedAt = null;
        this._lastValidReadingAt = null;
        this._watchdogUnavailable = false;
        this._availabilityUpdateQueue = Promise.resolve();
        this._activeRefreshInterval = DEFAULT_REFRESH_INTERVAL_SECONDS;
        this._activeTimeout = DEFAULT_REQUEST_TIMEOUT_SECONDS;

        this.logMessage(`Sigenergy ${this.constructor.name} device initiated`);

        await this.initializeSession(
            this.getSettings().address,
            this.getSettings().port,
            this.getSettings().modbus_unitId,
            this.getSettings().refreshInterval,
            this.getSettings().timeout
        );
    }

    async destroySession() {
        this._stopAvailabilityWatchdog();

        const api = this.api;
        this.api = null;
        this._detachApiEventListeners(api);

        if (api) {
            await api.disconnect();
        }
    }

    async initializeSession(host, port, modbus_unitId, refreshInterval, timeout) {
        if (this._deleted) {
            return;
        }

        const generation = ++this._sessionGeneration;
        this._stopAvailabilityWatchdog();
        this._sessionStartedAt = null;
        this._lastValidReadingAt = null;
        this._watchdogUnavailable = false;

        // Queue a generation-bound reset immediately after invalidating the old
        // session. It runs behind any in-flight old transition, so a late
        // setAvailable cannot make the replacement session available before it
        // produces valid data.
        const availabilityReset = this._queueAvailabilityUpdate(
            false,
            'Waiting for valid device data',
            null,
            generation
        );

        try {
            // Null and detach the old API synchronously before awaiting its
            // teardown, so no old event can race with the replacement session.
            await this.destroySession();
            if (!this._isCurrentGeneration(generation)) {
                return;
            }

            try {
                await availabilityReset;
            } catch (error) {
                if (this._isCurrentGeneration(generation)) {
                    this.error('Failed to reset device availability:', utilFunctions.formatError(error));
                }
            }

            if (!this._isCurrentGeneration(generation)) {
                return;
            }

            await this.setupSession(host, port, modbus_unitId, refreshInterval, timeout, generation);
            // Availability is driven by guarded reading events. lib/base.js is
            // the only reconnect engine, so the device layer does not retry.
        } catch (error) {
            if (!this._isCurrentGeneration(generation)) {
                return;
            }

            const failedApi = this.api;
            this.api = null;
            this._detachApiEventListeners(failedApi);
            if (failedApi) {
                try {
                    await failedApi.disconnect();
                } catch (_) {
                    // Preserve the original setup failure below.
                }
            }

            if (!this._isCurrentGeneration(generation)) {
                return;
            }

            // Reached only for unexpected setup failures (e.g. createApi); the
            // API layer reports normal connection failures through status.
            this.error('Failed to initialize device connection:', utilFunctions.formatError(error));
            await this._queueAvailabilityUpdate(
                false,
                utilFunctions.formatError(error) || 'Connection failed',
                null,
                generation
            );
        }
    }

    /**
     * Create the device-specific Modbus API instance. Subclasses MUST override
     * this to return their concrete device (e.g. `new Battery(options)`), which
     * binds the correct register set. The base class owns the rest of the
     * session lifecycle (initialize + event wiring) so drivers don't repeat it.
     *
     * @param {object} options - { host, port, modbus_unitId, refreshInterval, timeout, device }
     * @returns {object} the device API instance (a lib/base.js subclass)
     */
    createApi(_options) {
        throw new Error(`${this.constructor.name} must implement createApi(options)`);
    }

    async setupSession(host, port, modbus_unitId, refreshInterval, timeout, generation = this._sessionGeneration) {
        if (!this._isCurrentGeneration(generation)) {
            return;
        }

        const api = this.createApi({
            host,
            port,
            modbus_unitId,
            refreshInterval,
            timeout,
            device: this
        });

        if (!this._isCurrentGeneration(generation)) {
            await api.disconnect();
            return;
        }

        this.api = api;
        this._activeRefreshInterval = this._positiveNumberOrDefault(
            refreshInterval,
            DEFAULT_REFRESH_INTERVAL_SECONDS
        );
        this._activeTimeout = this._positiveNumberOrDefault(
            timeout,
            DEFAULT_REQUEST_TIMEOUT_SECONDS
        );

        // Subscribe before initialize(): the initial 'connectionStatus' is
        // emitted during initialize(), so the listener must already be attached.
        this._initializeEventListeners(api, generation);
        await api.initialize();

        if (!this._isCurrentSession(api, generation)) {
            this._detachApiEventListeners(api);
            await api.disconnect();
        }
    }

    /**
     * Wire API events to generation-bound wrappers. 'properties' remains
     * optional for devices that do not implement a properties handler.
     */
    _initializeEventListeners(api = this.api, generation = this._sessionGeneration) {
        if (!api || !this._isCurrentSession(api, generation)) {
            return;
        }

        const listeners = {
            api,
            generation,
            properties: null,
            readings: message => this._handleApiReadings(message, api, generation),
            error: error => {
                if (this._isCurrentSession(api, generation)) {
                    return this._handleErrorEvent(error);
                }
                return undefined;
            },
            connectionStatus: status => {
                if (this._isCurrentSession(api, generation)) {
                    return this._handleConnectionStatus(status, api, generation);
                }
                return undefined;
            }
        };

        if (typeof this._handlePropertiesEvent === 'function') {
            listeners.properties = message => {
                if (this._isCurrentSession(api, generation)) {
                    return this._handlePropertiesEvent(message);
                }
                return undefined;
            };
            api.on('properties', listeners.properties);
        }

        api.on('readings', listeners.readings);
        api.on('error', listeners.error);
        api.on('connectionStatus', listeners.connectionStatus);
        this._apiEventListeners = listeners;
    }

    _detachApiEventListeners(api) {
        const listeners = this._apiEventListeners;
        if (!api || !listeners || listeners.api !== api) {
            return;
        }

        if (listeners.properties) {
            api.removeListener('properties', listeners.properties);
        }
        api.removeListener('readings', listeners.readings);
        api.removeListener('error', listeners.error);
        api.removeListener('connectionStatus', listeners.connectionStatus);
        this._apiEventListeners = null;
    }

    async _handleApiReadings(message, api, generation) {
        if (!this._isCurrentSession(api, generation)
            || !message
            || typeof message !== 'object'
            || Object.keys(message).length === 0) {
            return;
        }

        this._lastValidReadingAt = Date.now();
        this._watchdogUnavailable = false;

        try {
            await this._queueAvailabilityUpdate(true, null, api, generation);
        } catch (error) {
            if (this._isCurrentSession(api, generation)) {
                this.error('Failed to update device availability:', utilFunctions.formatError(error));
            }
        }

        if (this._isCurrentSession(api, generation)) {
            await this._handleReadingsEvent(message);
        }
    }

    /**
     * Reflect connection loss immediately. A successful TCP connection only
     * starts the data watchdog; availability waits for a valid readings event.
     */
    async _handleConnectionStatus({ connected, error } = {}, api = this.api, generation = this._sessionGeneration) {
        if (!this._isCurrentSession(api, generation)) {
            return;
        }

        try {
            if (connected) {
                this._sessionStartedAt = Date.now();
                this._lastValidReadingAt = null;
                this._watchdogUnavailable = false;
                this._startAvailabilityWatchdog(api, generation);
                return;
            }

            this._stopAvailabilityWatchdog();
            this._sessionStartedAt = null;
            this._lastValidReadingAt = null;
            this._watchdogUnavailable = false;
            await this._queueAvailabilityUpdate(
                false,
                error ? utilFunctions.formatError(error) : 'Connection lost',
                api,
                generation
            );
        } catch (e) {
            if (this._isCurrentSession(api, generation)) {
                this.error('Failed to update device availability:', utilFunctions.formatError(e));
            }
        }
    }

    _startAvailabilityWatchdog(api, generation) {
        this._stopAvailabilityWatchdog();
        if (!this._isCurrentSession(api, generation)) {
            return;
        }

        const refreshMs = this._activeRefreshInterval * 1000;
        const timeoutMs = this._activeTimeout * 1000;
        // Allow the first scheduled poll plus a conservative complete sweep of
        // sequential Modbus requests before declaring the data stale.
        const staleThresholdMs = Math.max(
            MIN_DATA_STALE_THRESHOLD_MS,
            refreshMs * 2,
            refreshMs + (timeoutMs * EXPECTED_REQUESTS_PER_SWEEP) + MIN_WATCHDOG_INTERVAL_MS
        );
        const watchdogIntervalMs = Math.max(
            MIN_WATCHDOG_INTERVAL_MS,
            Math.min(refreshMs, MAX_WATCHDOG_INTERVAL_MS)
        );

        const watchdogId = this.homey.setInterval(async () => {
            if (!this._isCurrentSession(api, generation)
                || this._availabilityWatchdogId !== watchdogId) {
                return;
            }

            const lastDataAt = this._lastValidReadingAt || this._sessionStartedAt;
            if (!lastDataAt
                || Date.now() - lastDataAt < staleThresholdMs
                || this._watchdogUnavailable) {
                return;
            }

            this._watchdogUnavailable = true;
            try {
                await this._queueAvailabilityUpdate(
                    false,
                    'No data received from device',
                    api,
                    generation
                );
            } catch (error) {
                if (this._isCurrentSession(api, generation)
                    && this._availabilityWatchdogId === watchdogId) {
                    this._watchdogUnavailable = false;
                    this.error('Failed to update device availability:', utilFunctions.formatError(error));
                }
            }
        }, watchdogIntervalMs);

        this._availabilityWatchdogId = watchdogId;
    }

    _queueAvailabilityUpdate(available, message, api, generation) {
        const update = this._availabilityUpdateQueue.then(async () => {
            const isCurrent = api
                ? this._isCurrentSession(api, generation)
                : this._isCurrentGeneration(generation);

            if (!isCurrent) {
                return;
            }

            const currentlyAvailable = this.getAvailable();
            if (available) {
                if (currentlyAvailable === false) {
                    await this.setAvailable();
                }
            } else if (currentlyAvailable === true) {
                await this.setUnavailable(message);
            }
        });

        // Keep later transitions ordered even if this Homey update fails. The
        // caller still receives the original rejecting promise for logging.
        this._availabilityUpdateQueue = update.catch(() => {});
        return update;
    }

    _stopAvailabilityWatchdog() {
        if (this._availabilityWatchdogId) {
            this.homey.clearInterval(this._availabilityWatchdogId);
            this._availabilityWatchdogId = null;
        }
    }

    _isCurrentGeneration(generation) {
        return !this._deleted && generation === this._sessionGeneration;
    }

    _isCurrentSession(api, generation) {
        return this._isCurrentGeneration(generation) && api === this.api;
    }

    _positiveNumberOrDefault(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : fallback;
    }

    async _updateProperty(key, value) {
        if (value === undefined) {
            return;
        }

        if (!this.hasCapability(key)) {
            return;
        }

        try {
            const changed = this.isCapabilityValueChanged(key, value);

            // Update capability value
            await this.setCapabilityValue(key, value);

            // Trigger device-specific events only for changed values
            if (changed) {
                await this._handlePropertyTriggers(key, value);
            }
        } catch (error) {
            this.error(`Failed to update property ${key}:`, error);
        }
    }

    async _handlePropertyTriggers(_key, _value) {
        // Placeholder method for device-specific event triggers
        // Override this method in child classes to implement custom trigger logic
        // Example:
        // if (key === 'some_capability') {
        //     await this.driver.triggerSomeEvent(this, { value });
        // }
    }

    async _handleErrorEvent(error) {
        this.error('Houston we have a problem', error);

        const errorMessage = this._formatErrorMessage(error);
        const timeString = new Date().toLocaleString('sv-SE', {
            hour12: false,
            timeZone: this.homey.clock.getTimezone()
        });

        try {
            await this.setSettings({
                last_error: `${timeString}\n${errorMessage}`
            });
        } catch (settingsError) {
            this.error('Failed to update error settings:', settingsError);
        }
    }

    _formatErrorMessage(error) {
        // Keep the full stack for genuine Errors (most useful in the debug
        // setting); for anything else (e.g. jsmodbus plain-object rejections)
        // fall back to formatError so we never store "[object Object]".
        if (utilFunctions.isError(error)) {
            return error.stack;
        }

        return utilFunctions.formatError(error);
    }

    isCapabilityValueChanged(key, value) {
        let oldValue = this.getCapabilityValue(key);
        //If oldValue===null then it is a newly added device, lets not trigger flows on that
        if (oldValue !== null && oldValue != value) {
            return true;
        } else {
            return false;
        }
    }

    async onDeleted() {
        this.logMessage(`Sigenergy ${this.constructor.name} device deleted`);
        this._deleted = true;
        this._sessionGeneration += 1;
        this._stopAvailabilityWatchdog();
        this._sessionStartedAt = null;
        this._lastValidReadingAt = null;

        const api = this.api;
        this.api = null;
        this._detachApiEventListeners(api);
        if (api) {
            await api.disconnect();
        }
    }

    async onSettings({ newSettings, changedKeys }) {
        let changeConn = false;
        let host, port, modbus_unitId, refreshInterval, timeout;
        if (changedKeys.indexOf("address") > -1) {
            this.logMessage(`Address value was change to: '${newSettings.address}'`);
            host = newSettings.address;
            changeConn = true;
        }

        if (changedKeys.indexOf("port") > -1) {
            this.logMessage(`Port value was change to: '${newSettings.port}'`);
            port = newSettings.port;
            changeConn = true;
        }

        if (changedKeys.indexOf("modbus_unitId") > -1) {
            this.logMessage(`Modbus UnitId was change to: '${newSettings.modbus_unitId}'`);
            modbus_unitId = newSettings.modbus_unitId;
            changeConn = true;
        }

        if (changedKeys.indexOf("refreshInterval") > -1) {
            this.logMessage(`Refresh interval value was change to: '${newSettings.refreshInterval}'`);
            refreshInterval = newSettings.refreshInterval;
            changeConn = true;
        }

        if (changedKeys.indexOf("timeout") > -1) {
            this.logMessage(`Modbus timeout value was change to: '${newSettings.timeout}'`);
            timeout = newSettings.timeout;
            changeConn = true;
        }

        if (changeConn) {
            // Re-initialize the Modbus session since connection setting(s) changed
            return this.initializeSession(
                host || this.getSettings().address,
                port || this.getSettings().port,
                modbus_unitId || this.getSettings().modbus_unitId,
                refreshInterval || this.getSettings().refreshInterval,
                timeout || this.getSettings().timeout
            );
        }

        return undefined;
    }

    async updateSetting(key, value) {
        try {
            const obj = {};
            obj[key] = String(value);
            await this.setSettings(obj);
        } catch (err) {
            this.error(`Failed to update setting '${key}' with value '${value}'`, err);
        }
    }

    async updateSettingIfChanged(key, newValue, oldValue) {
        if (newValue != oldValue) {
            await this.updateSetting(key, newValue);
        }
    }

    async updateNumericSettingIfChanged(key, newValue, oldValue, suffix) {
        if (!isNaN(newValue)) {
            await this.updateSettingIfChanged(key, `${newValue}${suffix}`, `${oldValue}${suffix}`);
        }
    }

    logMessage(message) {
        this.log(`[${this.getName()}] ${message}`);
    }

    async addCapabilityHelper(capability) {
        if (!this.hasCapability(capability)) {
            try {
                this.logMessage(`Adding missing capability '${capability}'`);
                await this.addCapability(capability);
            } catch (reason) {
                this.error(`Failed to add capability '${capability}'`);
                this.error(reason);
            }
        }
    }

    async removeCapabilityHelper(capability) {
        if (this.hasCapability(capability)) {
            try {
                this.logMessage(`Remove existing capability '${capability}'`);
                await this.removeCapability(capability);
            } catch (reason) {
                this.error(`Failed to removed capability '${capability}'`);
                this.error(reason);
            }
        }
    }

    async updateCapabilityOptions(capability, options) {
        if (this.hasCapability(capability)) {
            try {
                this.logMessage(`Updating capability options '${capability}'`);
                await this.setCapabilityOptions(capability, options);
            } catch (reason) {
                this.error(`Failed to update capability options for '${capability}'`);
                this.error(reason);
            }
        }
    }
}

module.exports = BaseDevice;
