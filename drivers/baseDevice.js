'use strict';

const { Device } = require('homey');
const utilFunctions = require('../lib/util.js');

class BaseDevice extends Device {

    async onInit() {
        this.api = null;
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
        if (this.api) {
            await this.api.disconnect();
        }
    }

    async initializeSession(host, port, modbus_unitId, refreshInterval, timeout) {
        try {
            await this.destroySession();
            await this.setupSession(host, port, modbus_unitId, refreshInterval, timeout);
            // Availability and reconnection are driven by the API's
            // 'connectionStatus' event and its health-check backoff (lib/base.js
            // is the single reconnect engine), so there is no retry timer here.
        } catch (error) {
            // Reached only for unexpected setup failures (e.g. createApi); the
            // API layer handles connection failures itself and reports them via
            // 'connectionStatus'.
            this.error('Failed to initialize device connection:', utilFunctions.formatError(error));
            await this.setUnavailable(utilFunctions.formatError(error) || 'Connection failed');
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
    createApi(options) {
        throw new Error(`${this.constructor.name} must implement createApi(options)`);
    }

    async setupSession(host, port, modbus_unitId, refreshInterval, timeout) {
        this.api = this.createApi({
            host,
            port,
            modbus_unitId,
            refreshInterval,
            timeout,
            device: this
        });

        // Subscribe before initialize(): the initial 'connectionStatus' is
        // emitted synchronously during initialize(), so the listener must
        // already be attached to catch the first connect/fail.
        this._initializeEventListeners();
        await this.api.initialize();
    }

    /**
     * Wire API events to their handlers. 'readings', 'error' and
     * 'connectionStatus' are always subscribed; 'properties' is only subscribed
     * when the subclass implements a _handlePropertiesEvent (not every device
     * exposes INFO registers).
     */
    _initializeEventListeners() {
        if (typeof this._handlePropertiesEvent === 'function') {
            this.api.on('properties', this._handlePropertiesEvent.bind(this));
        }
        this.api.on('readings', this._handleReadingsEvent.bind(this));
        this.api.on('error', this._handleErrorEvent.bind(this));
        this.api.on('connectionStatus', this._handleConnectionStatus.bind(this));
    }

    /**
     * Reflect the API connection state onto the Homey device availability.
     * This is the single place that marks the device available/unavailable.
     */
    async _handleConnectionStatus({ connected, error } = {}) {
        try {
            if (connected) {
                await this.setAvailable();
            } else {
                await this.setUnavailable(
                    error ? utilFunctions.formatError(error) : 'Connection lost'
                );
            }
        } catch (e) {
            this.error('Failed to update device availability:', utilFunctions.formatError(e));
        }
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

    async _handlePropertyTriggers(key, value) {
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

    onDeleted() {
        this.logMessage(`Sigenergy ${this.constructor.name} device deleted`);
        if (this.api) {
            this.api.disconnect();
        }
        this.api = null;
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
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
            this.initializeSession(
                host || this.getSettings().address,
                port || this.getSettings().port,
                modbus_unitId || this.getSettings().modbus_unitId,
                refreshInterval || this.getSettings().refreshInterval,
                timeout || this.getSettings().timeout
            );
        }
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
