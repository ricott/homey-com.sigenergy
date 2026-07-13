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

        // Phase voltage/current moved to the inverter device (they are inverter
        // registers, not battery registers). Remove them from existing devices.
        await this.removeCapabilityHelper('measure_voltage.phaseA');
        await this.removeCapabilityHelper('measure_current.phaseA');
        await this.removeCapabilityHelper('measure_voltage.phaseB');
        await this.removeCapabilityHelper('measure_current.phaseB');
        await this.removeCapabilityHelper('measure_voltage.phaseC');
        await this.removeCapabilityHelper('measure_current.phaseC');
    }

    createApi(options) {
        return new Battery(options);
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

            if (Object.keys(settings).length > 0) {
                await this.setSettings(settings);
            }
        } catch (error) {
            this.error('Failed to update battery properties settings:', error);
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

        await Promise.all(updates);

        // Update firmware setting if changed
        await this.updateSettingIfChanged('firmware', firmware, this.getSetting('firmware'));
    }
}
module.exports = BatteryDevice;
