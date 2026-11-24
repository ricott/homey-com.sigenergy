'use strict';

const Energy = require('../../lib/devices/energy.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');
const utilFunctions = require('../../lib/util.js');

class EnergyDevice extends BaseDevice {

    async onInit() {
        await this.upgradeDevice();
        await super.onInit();
    }

    async upgradeDevice() {
        await this.addCapabilityHelper('grid_status');
        await this.addCapabilityHelper('grid_sensor_status');
        await this.addCapabilityHelper('phase_control');
        for (const phase of ['L1', 'L2', 'L3']) {
            await this.addCapabilityHelper(`measure_voltage.${phase}`);
            await this.addCapabilityHelper(`measure_current.${phase}`);
        }

        // Left over from an earlier app version that showed the grid
        // export/import limits (40038/40040) as power readings. With no limit
        // set those registers hold 0xFFFFFFFF, so the device displayed
        // 4294967295 W. Nothing writes these capabilities any more.
        await this.removeCapabilityHelper('measure_power.export_limitation');
        await this.removeCapabilityHelper('measure_power.import_limitation');
    }

    createApi(options) {
        return new Energy(options);
    }

    // _handlePropertiesEvent(message) {
    //     this.updateSetting('serial', message.serial);
    // }

    /**
     * Public method - used by flow action cards.
     *
     * Caps how much power may be fed into the grid at the grid connection
     * point. Requires a grid sensor and takes effect regardless of EMS mode.
     */
    async setGridMaxExportPower(kW) {
        return this._writeGridLimit('export', utilFunctions.clampPower(kW));
    }

    /**
     * Public method - used by flow action cards.
     *
     * Caps how much power may be drawn from the grid at the grid connection
     * point, e.g. to stay under a fuse rating.
     */
    async setGridMaxImportPower(kW) {
        return this._writeGridLimit('import', utilFunctions.clampPower(kW));
    }

    async _writeGridLimit(direction, kW) {
        if (!this.api) {
            throw new Error(`Failed to set max grid ${direction} power! Device is not connected.`);
        }

        const write = direction === 'export'
            ? this.api.setMaxExportLimitation(kW)
            : this.api.setMaxImportLimitation(kW);

        await write.catch(reason => {
            this.error(`Failed to set max grid ${direction} power!`, reason);
            throw new Error(`Failed to set max grid ${direction} power! ${utilFunctions.formatError(reason)}`);
        });

        this.logMessage(`Set max grid ${direction} power to ${kW} kW`);
        return true;
    }

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
            this._updateProperty('measure_power.L1', message.powerL1),
            this._updateProperty('measure_voltage.L1', message.voltageL1),
            this._updateProperty('measure_current.L1', message.currentL1),

            // Phase L2 measurements
            this._updateProperty('measure_power.L2', message.powerL2),
            this._updateProperty('measure_voltage.L2', message.voltageL2),
            this._updateProperty('measure_current.L2', message.currentL2),

            // Phase L3 measurements
            this._updateProperty('measure_power.L3', message.powerL3),
            this._updateProperty('measure_voltage.L3', message.voltageL3),
            this._updateProperty('measure_current.L3', message.currentL3),

            // Energy meters
            this._updateProperty('meter_power.imported', message.totalImportedEnergy),
            this._updateProperty('meter_power.exported', message.totalExportedEnergy),

            // Independent phase control
            this._updateProperty('phase_control', phaseControl)
        ];

        if (Number.isFinite(message.gridSensorStatus)) {
            const gridSensorStatus = enums.decodeGridSensorStatus(message.gridSensorStatus);
            propertyUpdates.unshift(this._updateProperty('grid_sensor_status', gridSensorStatus));
        }

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
