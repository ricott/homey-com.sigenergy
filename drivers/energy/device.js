'use strict';

const Energy = require('../../lib/devices/energy.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

class EnergyDevice extends BaseDevice {

    async onInit() {
        await this.upgradeDevice();
        await super.onInit();
    }

    async upgradeDevice() {
        this.logMessage('Upgrading existing device');

        await this.addCapabilityHelper('grid_status');
        await this.addCapabilityHelper('phase_control');
    }

    createApi(options) {
        return new Energy(options);
    }

    // _handlePropertiesEvent(message) {
    //     this.updateSetting('serial', message.serial);
    // }

    async _handleReadingsEvent(message) {
        try {
            await this._updateEnergyMeterProperties(message);
        } catch (error) {
            this.error('Failed to process energy meter readings event:', error);
        }
    }

    async _updateEnergyMeterProperties(message) {

        const phaseControl = enums.decodePhaseControl(message.phaseControl);

        const propertyUpdates = [
            // Total power measurement
            this._updateProperty('measure_power', message.power),

            // Phase L1 measurements
            this._updateProperty('measure_power.L1', message.powerL1 || 0),

            // Phase L2 measurements
            this._updateProperty('measure_power.L2', message.powerL2 || 0),

            // Phase L3 measurements
            this._updateProperty('measure_power.L3', message.powerL3 || 0),

            // Energy meters
            this._updateProperty('meter_power.imported', message.totalImportedEnergy || 0),
            this._updateProperty('meter_power.exported', message.totalExportedEnergy || 0),

            // Independent phase control
            this._updateProperty('phase_control', phaseControl)
        ];

        if (Number.isFinite(message.gridStatus)) {
            const gridStatus = enums.decodeGridStatus(message.gridStatus);
            propertyUpdates.unshift(this._updateProperty('grid_status', gridStatus));
        }

        await Promise.all(propertyUpdates);

        if (phaseControl !== undefined) {
            await this.updateSettingIfChanged('phaseControl', phaseControl, this.getSetting('phaseControl'));
        }
    }
}
module.exports = EnergyDevice;
