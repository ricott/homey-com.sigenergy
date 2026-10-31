'use strict';

const Plant = require('../../lib/devices/plant.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');
const utilFunctions = require('../../lib/util.js');

// Store keys for the rated ESS power values. Persisted so the power-limit flow
// actions still know the plant's bounds immediately after a restart, before the
// first INFO register read of the new session has completed.
const STORE_RATED_CHARGING_POWER = 'ess_rated_charging_power';
const STORE_RATED_DISCHARGING_POWER = 'ess_rated_discharging_power';

// Battery hold state, persisted so a hold survives an app restart and the
// release still restores the user's own discharge cut-off SOC.
const STORE_CUTOFF_BEFORE_HOLD = 'discharge_cutoff_before_hold';
const STORE_HOLD_CUTOFF = 'discharge_cutoff_hold';

class PlantDevice extends BaseDevice {

    async onInit() {
        await this.upgradeDevice();
        await super.onInit();
    }

    /**
     * Capability migrations for devices paired by an older app version. The
     * add/remove helpers log only when they actually change something, so an
     * already up-to-date device produces no output.
     */
    async upgradeDevice() {
        await this.addCapabilityHelper('ems_work_mode');
        await this.addCapabilityHelper('grid_sensor_status');
        await this.addCapabilityHelper('meter_power.consumption_daily');
        await this.addCapabilityHelper('meter_power.consumption');
    }

    createApi(options) {
        return new Plant(options);
    }

    /**
     * Resolve a clamp bound from the device store, falling back to the matching
     * display setting. Read on every use rather than cached, see
     * BaseDevice.getPersistedNumber.
     */
    _getRatedPower(label) {
        return label === 'charging'
            ? this.getPersistedNumber(STORE_RATED_CHARGING_POWER, 'ratedChargingPower')
            : this.getPersistedNumber(STORE_RATED_DISCHARGING_POWER, 'ratedDischargingPower');
    }

    async _handlePropertiesEvent(message) {
        try {
            // persistNumber ignores unusable values, so a failed or unsupported
            // read leaves the previously stored bound intact and returns it.
            const ratedChargingPower = await this.persistNumber(
                STORE_RATED_CHARGING_POWER,
                message.ratedChargingPower
            );
            const ratedDischargingPower = await this.persistNumber(
                STORE_RATED_DISCHARGING_POWER,
                message.ratedDischargingPower
            );

            // Settings hold the same values unit-suffixed, for display only.
            await this.setSettings({
                ratedChargingPower: ratedChargingPower !== undefined ? `${ratedChargingPower} kW` : '',
                ratedDischargingPower: ratedDischargingPower !== undefined ? `${ratedDischargingPower} kW` : ''
            });
        } catch (error) {
            this.error('Failed to update plant properties settings:', error);
        }
    }

    /**
     * Public method - used by flow action cards.
     *
     * Caps how much power the battery may draw while charging. Writing 0 stops
     * it charging altogether.
     */
    async setEssMaxChargePower(kW) {
        const clamped = utilFunctions.clampPower(kW, this._getRatedPower('charging'));
        return this._writeEssLimit('charging', clamped);
    }

    /**
     * Public method - used by flow action cards.
     *
     * Caps how much power the battery may supply while discharging. Writing 0
     * stops it discharging altogether, which is the building block for "don't
     * drain the battery into the car while it charges".
     */
    async setEssMaxDischargePower(kW) {
        const clamped = utilFunctions.clampPower(kW, this._getRatedPower('discharging'));
        return this._writeEssLimit('discharging', clamped);
    }

    /**
     * Public method - used by flow action cards.
     *
     * Restores unrestricted charging by writing the plant's rated charging
     * power, which is the top of the register's documented range.
     */
    async removeEssChargeLimit() {
        return this._writeEssLimit('charging', this._requireRatedPower('charging'));
    }

    /**
     * Public method - used by flow action cards.
     *
     * Restores unrestricted discharging by writing the plant's rated
     * discharging power.
     */
    async removeEssDischargeLimit() {
        return this._writeEssLimit('discharging', this._requireRatedPower('discharging'));
    }

    /**
     * The rated power registers define the upper bound of the limit registers,
     * so removing a limit is only meaningful once they have been read. Fail
     * loudly rather than guessing a value the plant may reject.
     */
    _requireRatedPower(label) {
        const rated = this._getRatedPower(label);
        if (rated === undefined) {
            throw new Error(`Cannot remove the battery ${label} limit: the plant's rated ${label} power is not known yet. Wait for the device to report it, or set an explicit power limit instead.`);
        }
        return rated;
    }

    async _writeEssLimit(label, kW) {
        if (!this.api) {
            throw new Error(`Failed to set max ${label} power! Device is not connected.`);
        }

        const write = label === 'charging'
            ? this.api.setEssMaxChargingLimit(kW)
            : this.api.setEssMaxDischargingLimit(kW);

        await write.catch(reason => {
            this.error(`Failed to set max ${label} power!`, reason);
            throw new Error(`Failed to set max ${label} power! ${utilFunctions.formatError(reason)}`);
        });

        this.logMessage(`Set ESS max ${label} power to ${kW} kW (${await this._describeEssLimitReadback(label)})`);
        return true;
    }

    /**
     * Some firmware accepts the limit write but does not enforce it in AI mode.
     * Logging what the plant stored next to the EMS work mode lets a diagnostic
     * report tell "stored but ignored" apart from "never stored". A failed
     * readback is only reported, since the write itself succeeded.
     */
    async _describeEssLimitReadback(label) {
        let readback;
        try {
            const value = await this.api.readEssLimit(label);
            readback = value === null ? 'not set' : `${value} kW`;
        } catch (error) {
            readback = `failed: ${utilFunctions.formatError(error)}`;
        }
        return `readback ${readback}, EMS work mode: ${this.getCapabilityValue('ems_work_mode') ?? 'unknown'}`;
    }

    /**
     * Public method - used by flow action cards.
     *
     * Hands control to (or takes it back from) Homey. Disabling hands control
     * back to the plant's own EMS, but on some firmware (reported on
     * V100R001C00SPC117) it falls back to Max self consumption rather than the
     * AI mode chosen in mySigen. The protocol has no register to select the
     * work mode, so the app cannot restore it.
     */
    async setRemoteEms(enabled) {
        await this._writeRemoteEms(`${enabled ? 'enable' : 'disable'} remote EMS`,
            () => this.api.setRemoteEmsEnabled(enabled));
        return true;
    }

    /**
     * Public method - used by flow action cards.
     *
     * Remote EMS is enabled first, since the control mode only takes effect
     * while it is on.
     */
    async setRemoteEmsControlMode(mode) {
        const value = Number(mode);
        if (!enums.isRemoteEmsControlMode(value)) {
            throw new Error(`Unsupported remote EMS control mode '${mode}'`);
        }

        await this.setRemoteEms(true);
        await this._writeRemoteEms(`set remote EMS control mode to ${value}`,
            () => this.api.setRemoteEmsControlMode(value));
        return true;
    }

    /**
     * Public method - used by flow action cards.
     *
     * Charges the battery from the grid at up to kW. The rate is bounded by the
     * ESS max charging limit (40032), which stays in place afterwards until it
     * is removed or changed.
     */
    async forceChargeFromGrid(kW) {
        await this.setEssMaxChargePower(kW);
        return this.setRemoteEmsControlMode(enums.REMOTE_EMS_MODE_CHARGE_GRID_FIRST);
    }

    /**
     * Public method - used by flow action cards.
     *
     * Stops the battery discharging without leaving AI mode, by raising the
     * discharge cut-off SOC (40048) to just below the current SoC. The ESS
     * discharge limit (40034) is ignored in AI mode, but the cut-off is not.
     * The cut-off that applied before the first hold is saved and restored by
     * releaseBatteryHold; holding again while held keeps that saved value.
     */
    async holdBatteryLevel() {
        if (!this.api) {
            throw new Error('Failed to hold the battery level! Device is not connected.');
        }

        try {
            const soc = await this.api.readBatterySoc();
            let cutoffBeforeHold = this.getStoreValue(STORE_CUTOFF_BEFORE_HOLD);
            if (!Number.isFinite(cutoffBeforeHold)) {
                cutoffBeforeHold = await this.api.readDischargeCutoffSoc();
                await this.setStoreValue(STORE_CUTOFF_BEFORE_HOLD, cutoffBeforeHold);
            }

            const cutoff = utilFunctions.holdCutoffSoc(soc, cutoffBeforeHold);
            await this.api.setDischargeCutoffSoc(cutoff);
            await this.setStoreValue(STORE_HOLD_CUTOFF, cutoff);

            this.logMessage(`Holding battery at ${soc}% SoC: discharge cut-off SOC set to ${cutoff}%`
                + ` (was ${cutoffBeforeHold}%, EMS work mode: ${this.getCapabilityValue('ems_work_mode') ?? 'unknown'})`);
        } catch (error) {
            this.error('Failed to hold the battery level!', error);
            throw new Error(`Failed to hold the battery level! ${utilFunctions.formatError(error)}`);
        }
        return true;
    }

    /**
     * Public method - used by flow action cards.
     *
     * Restores the discharge cut-off SOC saved by holdBatteryLevel. Does
     * nothing when no hold is active, so it is safe to run unconditionally.
     */
    async releaseBatteryHold() {
        const cutoffBeforeHold = this.getStoreValue(STORE_CUTOFF_BEFORE_HOLD);
        if (!Number.isFinite(cutoffBeforeHold)) {
            this.logMessage('Release battery hold: no hold active');
            return true;
        }

        if (!this.api) {
            throw new Error('Failed to release the battery hold! Device is not connected.');
        }

        try {
            await this.api.setDischargeCutoffSoc(cutoffBeforeHold);
        } catch (error) {
            this.error('Failed to release the battery hold!', error);
            throw new Error(`Failed to release the battery hold! ${utilFunctions.formatError(error)}`);
        }

        await this.unsetStoreValue(STORE_CUTOFF_BEFORE_HOLD);
        await this.unsetStoreValue(STORE_HOLD_CUTOFF);
        this.logMessage(`Released battery hold: discharge cut-off SOC restored to ${cutoffBeforeHold}%`);
        return true;
    }

    /**
     * While a hold is active, solar can still charge the battery. Raise the
     * cut-off along with the SoC so that charge is held too, rather than
     * discharged back down to the level the hold started at. It only ever
     * moves up, one whole percent at a time, so a steady SoC causes no writes.
     */
    async _followBatteryHold(soc) {
        const holdCutoff = this.getStoreValue(STORE_HOLD_CUTOFF);
        if (!Number.isFinite(holdCutoff) || this._raisingHold || !this.api) {
            return;
        }

        const cutoff = utilFunctions.holdCutoffSoc(soc, this.getStoreValue(STORE_CUTOFF_BEFORE_HOLD));
        if (cutoff === undefined || cutoff <= holdCutoff) {
            return;
        }

        this._raisingHold = true;
        try {
            await this.api.setDischargeCutoffSoc(cutoff);
            await this.setStoreValue(STORE_HOLD_CUTOFF, cutoff);
            this.logMessage(`Battery hold raised to ${cutoff}% as SoC rose to ${soc}%`);
        } catch (error) {
            this.error('Failed to raise the battery hold:', error);
        } finally {
            this._raisingHold = false;
        }
    }

    async _writeRemoteEms(action, write) {
        if (!this.api) {
            throw new Error(`Failed to ${action}! Device is not connected.`);
        }

        await write().catch(reason => {
            this.error(`Failed to ${action}!`, reason);
            throw new Error(`Failed to ${action}! ${utilFunctions.formatError(reason)}`);
        });

        this.logMessage(`Remote EMS: ${action}`);
    }

    async _handleReadingsEvent(message) {
        try {
            await this._updatePlantProperties(message);
        } catch (error) {
            this.error('Failed to process inverter readings event:', error);
        }
    }

    /**
     * Total PV power is the plant's own production plus any third-party inverter
     * feeding the same plant.
     *
     * Third-party inverter power (30194) is optional: it only exists on plants
     * that have one, and the register was added in protocol V2.7, so a missing
     * value counts as zero. The plant's own PV power is required - without it
     * there is no total to report, and returning the third-party figure alone
     * (or 0) would understate production. Returning undefined leaves the
     * capability at its last known value instead.
     */
    _resolveSolarPower(message) {
        if (!Number.isFinite(message.solarPower)) {
            return undefined;
        }

        const thirdParty = Number.isFinite(message.thirdPartyInverterPower)
            ? message.thirdPartyInverterPower
            : 0;

        return message.solarPower + thirdParty;
    }

    async _updatePlantProperties(message) {

        const evChargerPower = await this.calculateEVChargerPower();

        await Promise.all([
            this._updateProperty('measure_power.grid', message.gridPower),
            this._updateProperty('measure_power.battery', message.batteryPower),
            this._updateProperty('measure_power.solar', this._resolveSolarPower(message)),
            this._updateProperty('measure_power.load', message.generalLoadPower),
            this._updateProperty('measure_power.evcharger', evChargerPower),
            this._updateProperty('measure_battery', message.batterySoc),
            this._updateProperty('ems_work_mode', enums.decodeEmsWorkMode(message.emsWorkMode)),
            this._updateProperty('grid_sensor_status', enums.decodeGridSensorStatus(message.gridSensorStatus)),
            this._updateProperty('meter_power.consumption_daily', message.dailyConsumption),
            this._updateProperty('meter_power.consumption', message.totalConsumption),
        ]);

        await this._followBatteryHold(message.batterySoc);

        if (Number.isFinite(message.gridStatus)) {
            await this.setStoreValue('grid_status', enums.decodeGridStatus(message.gridStatus));
        }

        await this.sendLiveViewData();
    }

    async sendLiveViewData() {
        this.homey.api.realtime('liveview.data.update', await this.getLiveViewData());
    }

    async getLiveViewData() {
        return {
            grid: {
                power: this.getCapabilityValue('measure_power.grid') / 1000,
                status: this.getStoreValue('grid_status')
            },
            solar: {
                power: this.getCapabilityValue('measure_power.solar') / 1000
            },
            home: {
                power: this.getCapabilityValue('measure_power.load') / 1000
            },
            evcharger: {
                power: this.getCapabilityValue('measure_power.evcharger') / 1000
            },
            battery: {
                power: this.getCapabilityValue('measure_power.battery') / 1000,
                soc: this.getCapabilityValue('measure_battery')
            }
        }
    }

    async calculateEVChargerPower() {
        let power = 0;

        // A charger whose measure_power is not known yet (newly added, or its
        // register has not read successfully) contributes nothing rather than
        // poisoning the sum with null/NaN.
        const addChargerPower = charger => {
            const value = charger.getCapabilityValue('measure_power');
            if (Number.isFinite(value)) {
                power = power + value;
            }
        };

        this.homey.drivers.getDriver('evdccharger').getDevices().forEach(addChargerPower);
        this.homey.drivers.getDriver('evaccharger').getDevices().forEach(addChargerPower);

        return power;
    }
}
module.exports = PlantDevice;
