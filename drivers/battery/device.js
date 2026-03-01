'use strict';

const Battery = require('../../lib/devices/battery.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

class BatteryDevice extends BaseDevice {

    async onInit() {
        await this.upgradeDevice();
        await super.onInit();
    }

    async upgradeDevice() {
        this.logMessage('Upgrading existing device');

        await this.removeCapabilityHelper('grid_status');
        await this.addCapabilityHelper('firmware');
        await this.addCapabilityHelper('measure_temperature.pcs');
    }

    async setupSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new Battery({
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
            const settings = {};

            if (message.serial !== undefined) {
                settings.serial = String(message.serial);
            }
            if (message.capacity !== undefined) {
                settings.capacity = `${message.capacity} kWh`;
            }

            const outputType = enums.decodeInverterOutputType(message.outputType);
            if (outputType) {
                this.logMessage(`Setting output type: ${outputType}`);
                settings.outputType = outputType;
            }

            if (Object.keys(settings).length > 0) {
                await this.setSettings(settings);
            }

            if (outputType) {
                await this._configureOutputCapabilities(outputType);
            }
        } catch (error) {
            this.error('Failed to update battery properties settings:', error);
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
            await this.addCapabilityHelper('measure_voltage.phaseA');
            await this.addCapabilityHelper('measure_current.phaseA');
            await this.removeCapabilityHelper('measure_voltage.phaseB');
            await this.removeCapabilityHelper('measure_current.phaseB');
            await this.removeCapabilityHelper('measure_voltage.phaseC');
            await this.removeCapabilityHelper('measure_current.phaseC');

        }
    }

    async _handleReadingsEvent(message) {
        try {
            await this._updateBatteryProperties(message);
        } catch (error) {
            this.error('Failed to process battery readings event:', error);
        }
    }

    async _updateBatteryProperties(message) {
        const firmware = (message.firmware || '').trim();
        let updates = [
            this._updateProperty('measure_battery', message.soc),
            this._updateProperty('measure_power', message.power),
            this._updateProperty('measure_temperature.minCell', message.minCellTemperature),
            this._updateProperty('measure_temperature.maxCell', message.maxCellTemperature),
            this._updateProperty('measure_temperature.pcs', message.pcsTemperature),
            // this._updateProperty('measure_voltage.minCell', message.minCellVoltage),
            // this._updateProperty('measure_voltage.maxCell', message.maxCellVoltage),

            this._updateProperty('battery_charging_state', enums.decodeBatteryChargingState(message.status, message.power)),
            this._updateProperty('meter_power.charged', message.totalChargeEnergy),
            this._updateProperty('meter_power.discharged', message.totalDischargeEnergy),
            this._updateProperty('firmware', firmware)
        ];

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

        // Update firmware setting if changed
        await this.updateSettingIfChanged('firmware', firmware, this.getSetting('firmware'));
    }
}
module.exports = BatteryDevice;
