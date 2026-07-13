'use strict';

const EVDCCharger = require('../../lib/devices/evDCCharger.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

class EvDCChargerDevice extends BaseDevice {

    async onInit() {
        await this.upgradeDevice();
        await this.setupCapabilityListeners();
        await super.onInit();
    }

    async upgradeDevice() {
        this.logMessage('Upgrading existing device');

        // v2.9 capabilities
        await this.addCapabilityHelper('evdc_running_state');
        await this.addCapabilityHelper('measure_current.discharge');
        await this.addCapabilityHelper('evdc_max_charge_power');
        await this.addCapabilityHelper('evdc_max_discharge_power');
        await this.addCapabilityHelper('meter_power.session_charged');
        await this.addCapabilityHelper('meter_power.session_discharged');
    }

    createApi(options) {
        return new EVDCCharger(options);
    }

    async setupCapabilityListeners() {
        this.registerCapabilityListener('evcharger_charging', async (value) => {
            if (value) {
                // Start
                await this.api.startCharging()
                    .catch(reason => {
                        this.error('Failed to start charging!', reason);
                        throw new Error(`Failed to start charging! ${reason.message}`);
                    });

            } else {
                // Stop
                await this.api.stopCharging()
                    .catch(reason => {
                        this.error('Failed to stop charging!', reason);
                        throw new Error(`Failed to stop charging! ${reason.message}`);
                    });
            }
        });
    }

    /**
     * Public method - used by flow action cards.
     */
    async setMaxChargePower(kW) {
        const clamped = this._clampPower(kW, 'ratedChargingPower');
        await this.api.setMaxChargePower(clamped)
            .catch(reason => {
                this.error('Failed to set max charging power!', reason);
                throw new Error(`Failed to set max charging power! ${reason.message}`);
            });
        return true;
    }

    /**
     * Public method - used by flow action cards.
     */
    async setMaxDischargePower(kW) {
        const clamped = this._clampPower(kW, 'ratedDischargingPower');
        await this.api.setMaxDischargePower(clamped)
            .catch(reason => {
                this.error('Failed to set max discharging power!', reason);
                throw new Error(`Failed to set max discharging power! ${reason.message}`);
            });
        return true;
    }

    _clampPower(kW, ratedKey) {
        let value = Number(kW);
        if (!Number.isFinite(value) || value < 0) {
            value = 0;
        }
        const max = Number(this._ratedPower?.[ratedKey]);
        if (Number.isFinite(max) && max > 0 && value > max) {
            value = max;
        }
        return value;
    }

    async _handlePropertiesEvent(message) {
        try {
            await this.setSettings({
                serial: String(message.serial),
                ratedChargingPower: Number.isFinite(message.ratedChargingPower)
                    ? `${message.ratedChargingPower} kW` : '',
                ratedDischargingPower: Number.isFinite(message.ratedDischargingPower)
                    ? `${message.ratedDischargingPower} kW` : ''
            });

            // Cache rated power for clamping flow action input
            this._ratedPower = {
                ratedChargingPower: message.ratedChargingPower,
                ratedDischargingPower: message.ratedDischargingPower
            };
        } catch (error) {
            this.error('Failed to update EV DC charger properties settings:', error);
        }
    }

    async _handleReadingsEvent(message) {
        try {
            await this._updateEvChargerProperties(message);
        } catch (error) {
            this.error('Failed to process EV DC charger readings event:', error);
        }
    }

    async _updateEvChargerProperties(message) {
        const isCharging = message.power > 0;
        const runningStateName = enums.decodeDCChargerState(message.runningState);
        const chargingState = Number.isFinite(message.runningState)
            ? enums.mapDCChargerStateToChargingState(message.runningState, message.power)
            : this._fallbackChargingState(message);

        await Promise.all([
            // EV charger capabilities
            this._updateProperty('evcharger_charging', isCharging),
            this._updateProperty('evcharger_charging_state', chargingState),
            this._updateProperty('evdc_running_state', runningStateName),

            // Power & current
            this._updateProperty('measure_power', message.power),
            this._updateProperty('measure_current', message.current),
            this._updateProperty('measure_current.discharge', message.dischargeCurrent),
            this._updateProperty('measure_voltage.vehicle', message.vehicleBatteryVoltage > 10 ? message.vehicleBatteryVoltage : 0),
            this._updateProperty('measure_battery.vehicle', message.vehicleSoc || 0),

            // Power limits (read back current values from device)
            this._updateProperty('evdc_max_charge_power', message.maxChargePowerLimit),
            this._updateProperty('evdc_max_discharge_power', message.maxDischargePowerLimit),

            // Session counters
            this._updateProperty('meter_power.session_charged', message.sessionChargeEnergy),
            this._updateProperty('meter_power.session_discharged', message.sessionDischargeEnergy),

            // Lifetime totals (system register)
            this._updateProperty('meter_power.charged', message.totalChargeEnergy),
            this._updateProperty('meter_power.discharged', message.totalDischargeEnergy)
        ]);
    }

    async _handlePropertyTriggers(key, value) {
        if (key === 'evdc_running_state' && typeof value === 'string') {
            try {
                await this.driver._dc_charger_state_changed?.trigger(this, {}, { value });
            } catch (error) {
                this.error('Failed to trigger dc_charger_state_changed:', error);
            }
        }
    }

    /**
     * Fallback when running state register is unavailable - infers state
     * from power and vehicle battery voltage like the v2.8 implementation.
     */
    _fallbackChargingState(message) {
        if (message.power > 0) {
            return 'plugged_in_charging';
        } else if (message.power < 0) {
            return 'plugged_in_discharging';
        } else if (message.power === 0 && message.vehicleBatteryVoltage > 10) {
            return 'plugged_in';
        } else {
            return 'plugged_out';
        }
    }
}
module.exports = EvDCChargerDevice;
