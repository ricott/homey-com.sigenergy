'use strict';

const Battery = require('../../lib/devices/battery.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

// Set once the battery has reported a non-zero minimum cell temperature,
// which shows that this system supports register 30621.
const STORE_MIN_CELL_SUPPORTED = 'min_cell_temperature_supported';

class BatteryDevice extends BaseDevice {

    async onInit() {
        await this.upgradeDevice();
        await super.onInit();
    }

    async upgradeDevice() {
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

        // Min cell temperature is added or removed per system once readings
        // arrive, see _updateMinCellTemperature.
        await this.addCapabilityHelper('measure_temperature.avgCell');
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
        // A failed string read must not blank the firmware capability/setting,
        // so an absent or empty value resolves to undefined and is skipped.
        const firmware = typeof message.firmware === 'string' && message.firmware.trim().length > 0
            ? message.firmware.trim()
            : undefined;

        let updates = [
            this._updateProperty('measure_battery', message.soc),
            this._updateProperty('measure_power', message.power),
            this._updateProperty('measure_temperature.avgCell', message.avgCellTemperature),
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
        await this._updateMinCellTemperature(message.minCellTemperature);

        // Update firmware setting if changed
        if (firmware !== undefined) {
            await this.updateSettingIfChanged('firmware', firmware, this.getSetting('firmware'));
        }
    }

    /**
     * Register 30621 always reads 0 on some systems (seen on a SigenStor EC
     * 20.0 TP, V100R001C21SPC117) but reports real values on others, retrofit
     * installs among them. The capability is only shown once the battery has
     * reported a non-zero value; until then a constant 0 is treated as
     * unsupported and the capability is removed. A cell at exactly 0.0 °C on
     * the first reading only delays the capability until the value changes.
     */
    async _updateMinCellTemperature(value) {
        if (!Number.isFinite(value)) {
            return;
        }

        if (value !== 0 && this.getStoreValue(STORE_MIN_CELL_SUPPORTED) !== true) {
            await this.setStoreValue(STORE_MIN_CELL_SUPPORTED, true);
        }

        if (this.getStoreValue(STORE_MIN_CELL_SUPPORTED) === true) {
            await this.addCapabilityHelper('measure_temperature.minCell');
            await this._updateProperty('measure_temperature.minCell', value);
        } else {
            await this.removeCapabilityHelper('measure_temperature.minCell');
        }
    }
}
module.exports = BatteryDevice;
