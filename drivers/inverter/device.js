'use strict';

const Inverter = require('../../lib/devices/inverter.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

class InverterDevice extends BaseDevice {

    async onInit() {
        await this.upgradeDevice();
        await super.onInit();
    }

    async upgradeDevice() {
        this.logMessage('Upgrading existing device');

    }

    async setupSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new Inverter({
            host: host,
            port: port,
            modbus_unitId: modbus_unitId,
            refreshInterval: refreshInterval,
            device: this
        });

        await this.api.initialize();
        await this._initializeEventListeners();
    }

    async _initializeEventListeners() {
        this.api.on('properties', this._handlePropertiesEvent.bind(this));
        this.api.on('readings', this._handleReadingsEvent.bind(this));
        this.api.on('error', this._handleErrorEvent.bind(this));
    }

    async _handlePropertiesEvent(message) {
        try {
            const settings = {
                serial: String(message.serial),
                mpptCount: String(message.mpptCount)
            };

            const outputType = enums.decodeInverterOutputType(message.outputType);
            if (outputType) {
                this.logMessage(`Setting output type: ${outputType}`);
                settings.outputType = outputType;
            }

            await this.setSettings(settings);

            await this._configurePVCapabilities(message.mpptCount);

            if (outputType) {
                await this._configureOutputCapabilities(outputType);
            }
        } catch (error) {
            this.error('Failed to update inverter properties settings:', error);
        }
    }

    async _configureOutputCapabilities(outputType) {
        if (outputType == 'L1/L2/L3' || outputType == 'L1/L2/L3/N') {
            await this.addCapabilityHelper('measure_voltage.phaseA');
            await this.addCapabilityHelper('measure_current.phaseA');
            await this.addCapabilityHelper('measure_voltage.phaseB');
            await this.addCapabilityHelper('measure_current.phaseB');
            await this.addCapabilityHelper('measure_voltage.phaseC');
            await this.addCapabilityHelper('measure_current.phaseC');
        } else {
            // L/N or L1/L2/N
            await this.addCapabilityHelper('measure_voltage.phaseA');
            await this.addCapabilityHelper('measure_current.phaseA');
            await this.removeCapabilityHelper('measure_voltage.phaseB');
            await this.removeCapabilityHelper('measure_current.phaseB');
            await this.removeCapabilityHelper('measure_voltage.phaseC');
            await this.removeCapabilityHelper('measure_current.phaseC');
        }
    }

    async _configurePVCapabilities(mpptCount) {
        // Array of all possible PV voltage capabilities
        const allPVCapabilities = [
            'measure_voltage.pv1',
            'measure_voltage.pv2',
            'measure_voltage.pv3',
            'measure_voltage.pv4'
        ];

        // Add or keep capabilities based on mpptCount
        for (let i = 0; i < allPVCapabilities.length; i++) {
            if (i < mpptCount) {
                // Keep/add this capability
                await this.addCapabilityHelper(allPVCapabilities[i]);
            } else {
                // Remove this capability if it exists
                await this.removeCapabilityHelper(allPVCapabilities[i]);
            }
        }

        this.logMessage(`Configured ${mpptCount} PV voltage capabilities`);
    }

    async _handleReadingsEvent(message) {
        try {
            await this._updateSolarChargerProperties(message);
        } catch (error) {
            this.error('Failed to process inverter readings event:', error);
        }
    }

    async _updateSolarChargerProperties(message) {
        let updates = [
            this._updateProperty('measure_power', message.power || 0),
            this._updateProperty('meter_power.daily', message.dailyYield || 0),
            this._updateProperty('meter_power', message.totalYield || 0)
        ];

        // Only update PV voltages based on mpptCount
        const mpptCount = Number(this.getSetting('mpptCount'));
        if (mpptCount >= 1) {
            updates.push(this._updateProperty('measure_voltage.pv1', message.pv1Voltage || 0));
        }
        if (mpptCount >= 2) {
            updates.push(this._updateProperty('measure_voltage.pv2', message.pv2Voltage || 0));
        }
        if (mpptCount >= 3) {
            updates.push(this._updateProperty('measure_voltage.pv3', message.pv3Voltage || 0));
        }
        if (mpptCount >= 4) {
            updates.push(this._updateProperty('measure_voltage.pv4', message.pv4Voltage || 0));
        }

        // Phase voltage/current based on the inverter output type
        const outputType = this.getSetting('outputType');
        if (outputType == 'L1/L2/L3' || outputType == 'L1/L2/L3/N') {
            updates.push(this._updateProperty('measure_voltage.phaseA', parseInt((message.phaseAVoltage || 0).toFixed(0))));
            updates.push(this._updateProperty('measure_current.phaseA', message.phaseACurrent));
            updates.push(this._updateProperty('measure_voltage.phaseB', parseInt((message.phaseBVoltage || 0).toFixed(0))));
            updates.push(this._updateProperty('measure_current.phaseB', message.phaseBCurrent));
            updates.push(this._updateProperty('measure_voltage.phaseC', parseInt((message.phaseCVoltage || 0).toFixed(0))));
            updates.push(this._updateProperty('measure_current.phaseC', message.phaseCCurrent));
        } else {
            // L/N or L1/L2/N
            updates.push(this._updateProperty('measure_voltage.phaseA', parseInt((message.phaseAVoltage || 0).toFixed(0))));
            updates.push(this._updateProperty('measure_current.phaseA', message.phaseACurrent));
        }

        await Promise.all(updates);
    }
}
module.exports = InverterDevice;
