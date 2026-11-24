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

// While held, a battery that keeps discharging means the plant is not
// enforcing the cut-off. Logged at most this often, so a diagnostic report
// shows it without flooding the log.
const HOLD_DISCHARGE_WARNING_INTERVAL_MS = 5 * 60 * 1000;
const HOLD_DISCHARGE_WARNING_W = 100;

// Set while the ESS charging limit (40032) is the one forceChargeFromGrid
// wrote, so turning remote EMS off can remove it again.
const STORE_FORCE_CHARGE_LIMIT = 'force_charge_limit_active';

function formatLimits({ charging, discharging, pv }) {
    const format = value => (value === null ? 'not set' : `${value} kW`);
    return `charge ${format(charging)}, discharge ${format(discharging)}, solar ${format(pv)}`;
}

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
        await this._writeEssLimit('charging', clamped);
        // The limit now belongs to the user, not to force charge.
        await this.unsetStoreValue(STORE_FORCE_CHARGE_LIMIT);
        return true;
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
     * Restores unrestricted charging. Also forgets a limit left behind by
     * forceChargeFromGrid, since it is now gone.
     */
    async removeEssChargeLimit() {
        await this._removeEssLimit('charging');
        await this.unsetStoreValue(STORE_FORCE_CHARGE_LIMIT);
        return true;
    }

    /**
     * Public method - used by flow action cards.
     *
     * Restores unrestricted discharging.
     */
    async removeEssDischargeLimit() {
        return this._removeEssLimit('discharging');
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
        await this._enforceLimitsInAllModes();
        return true;
    }

    async _removeEssLimit(label) {
        if (!this.api) {
            throw new Error(`Failed to remove the battery ${label} limit! Device is not connected.`);
        }

        await this.api.removeEssLimit(label).catch(reason => {
            this.error(`Failed to remove the battery ${label} limit!`, reason);
            throw new Error(`Failed to remove the battery ${label} limit! ${utilFunctions.formatError(reason)}`);
        });

        this.logMessage(`Removed ESS max ${label} power limit (${await this._describeEssLimitReadback(label)})`);
        await this._releaseLimitEnforcementIfUnused();
        return true;
    }

    /**
     * The ESS and PV limits only apply outside remote EMS while 40162 is 1
     * (protocol V2.10), so turn it on whenever a limit is set. Turning it on
     * also revives any other limit still stored on the plant, so those are
     * logged. Older firmware without 40162 applied the limits by the V2.9
     * rules; there the write is skipped. Never fails the card: the limit
     * itself was written.
     */
    async _enforceLimitsInAllModes() {
        try {
            if (await this.api.readLimitGlobalEnable() === 1) {
                return;
            }
        } catch (error) {
            this.logMessage(`Power limit global enable (40162) not available, limits follow the firmware's own rules: ${utilFunctions.formatError(error)}`);
            return;
        }

        try {
            await this.api.setLimitGlobalEnable(true);
            this.logMessage(`Enabled power limits in all EMS modes (40162 = 1). Stored limits: ${await this._describeStoredLimits()}`);
        } catch (error) {
            this.error('Failed to enable power limits in all EMS modes (40162)!', error);
        }
    }

    /**
     * Turn 40162 back off once no ESS or PV limit constrains anything, so the
     * plant is left as it was before the app set a limit. Never fails the
     * card: the limit itself was removed.
     */
    async _releaseLimitEnforcementIfUnused() {
        try {
            const limits = await this._readStoredLimits();
            const active = [
                utilFunctions.isPowerLimitActive(limits.charging, this._getRatedPower('charging')),
                utilFunctions.isPowerLimitActive(limits.discharging, this._getRatedPower('discharging')),
                utilFunctions.isPowerLimitActive(limits.pv)
            ];
            if (active.some(Boolean)) {
                this.logMessage(`Keeping power limits enabled in all EMS modes. Stored limits: ${formatLimits(limits)}`);
                return;
            }

            if (await this.api.readLimitGlobalEnable() !== 1) {
                return;
            }
            await this.api.setLimitGlobalEnable(false);
            this.logMessage('No power limits left, disabled power limits in all EMS modes (40162 = 0)');
        } catch (error) {
            this.logMessage(`Could not release power limit global enable (40162): ${utilFunctions.formatError(error)}`);
        }
    }

    async _readStoredLimits() {
        const [charging, discharging, pv] = await Promise.all([
            this.api.readEssLimit('charging'),
            this.api.readEssLimit('discharging'),
            this.api.readPvMaxPowerLimit()
        ]);
        return { charging, discharging, pv };
    }

    async _describeStoredLimits() {
        try {
            return formatLimits(await this._readStoredLimits());
        } catch (error) {
            return `readback failed: ${utilFunctions.formatError(error)}`;
        }
    }

    /**
     * Public method - used by flow action cards.
     *
     * Caps solar production, for example while the feed-in price is negative.
     * Unlike an export limit this also curtails solar that would have charged
     * the battery. Writing 0 stops solar production altogether.
     */
    async setPvMaxPower(kW) {
        const clamped = utilFunctions.clampPower(kW);
        await this._writePvLimit(`Set PV max power to ${clamped} kW`,
            () => this.api.setPvMaxPowerLimit(clamped));
        await this._enforceLimitsInAllModes();
        return true;
    }

    /**
     * Public method - used by flow action cards.
     *
     * Lets solar produce freely again.
     */
    async removePvMaxPowerLimit() {
        await this._writePvLimit('Removed PV max power limit',
            () => this.api.removePvMaxPowerLimit());
        await this._releaseLimitEnforcementIfUnused();
        return true;
    }

    async _writePvLimit(action, write) {
        if (!this.api) {
            throw new Error('Failed to set PV max power! Device is not connected.');
        }

        await write().catch(reason => {
            this.error('Failed to set PV max power!', reason);
            throw new Error(`Failed to set PV max power! ${utilFunctions.formatError(reason)}`);
        });

        let readback;
        try {
            const value = await this.api.readPvMaxPowerLimit();
            readback = value === null ? 'not set' : `${value} kW`;
        } catch (error) {
            readback = `failed: ${utilFunctions.formatError(error)}`;
        }
        this.logMessage(`${action} (readback ${readback},`
            + ` PV power: ${this.getCapabilityValue('measure_power.solar') ?? 'unknown'} W,`
            + ` EMS work mode: ${this.getCapabilityValue('ems_work_mode') ?? 'unknown'})`);
        return true;
    }

    /**
     * Logging what the plant stored next to the EMS work mode lets a diagnostic
     * report tell "stored but not enforced" apart from "never stored". A failed
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

        // A charge limit set by forceChargeFromGrid would otherwise keep
        // capping charging after remote EMS ends, since limits are enforced
        // in every mode while 40162 is on. A limit the user set themselves
        // (with the charge power card) is left alone.
        if (!enabled && this.getStoreValue(STORE_FORCE_CHARGE_LIMIT)) {
            try {
                await this.removeEssChargeLimit();
            } catch (error) {
                this.error('Failed to remove the charge limit left by force charge!', error);
            }
        }
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
     * ESS max charging limit (40032). The limit is remembered as set by force
     * charge, so turning remote EMS off removes it again.
     */
    async forceChargeFromGrid(kW) {
        await this.setEssMaxChargePower(kW);
        await this.setStoreValue(STORE_FORCE_CHARGE_LIMIT, true);
        return this.setRemoteEmsControlMode(enums.REMOTE_EMS_MODE_CHARGE_GRID_FIRST);
    }

    /**
     * Public method - used by flow action cards.
     *
     * Stops the battery discharging without leaving AI mode, by raising the
     * discharge cut-off SOC (40048) to 0.2 % below the current SoC. The ESS
     * discharge limit (40034) only applies in AI mode while 40162 is on; the
     * cut-off always does, and leaves the discharge limit free for the user.
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
            this._holdWarnedAt = Date.now();

            this.logMessage(`Holding battery at ${soc}% SoC: discharge cut-off SOC set to ${cutoff}%`
                + ` (was ${cutoffBeforeHold}%, ${await this._describeDischargeCutoffReadback()},`
                + ` battery power: ${this.getCapabilityValue('measure_power.battery') ?? 'unknown'} W,`
                + ` EMS work mode: ${this.getCapabilityValue('ems_work_mode') ?? 'unknown'})`);
        } catch (error) {
            this.error('Failed to hold the battery level!', error);
            throw new Error(`Failed to hold the battery level! ${utilFunctions.formatError(error)}`);
        }
        return true;
    }

    /**
     * Public method - used by flow condition cards.
     */
    isBatteryHeld() {
        return Number.isFinite(this.getStoreValue(STORE_HOLD_CUTOFF));
    }

    /**
     * Public method - used by flow condition cards. The card passes the
     * register value (30003) as a string; the capability holds its decoded name.
     */
    isEmsWorkMode(mode) {
        return this.getCapabilityValue('ems_work_mode') === enums.decodeEmsWorkMode(Number(mode));
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
        this._holdWarnedAt = undefined;
        this.logMessage(`Released battery hold: discharge cut-off SOC restored to ${cutoffBeforeHold}%`
            + ` (${await this._describeDischargeCutoffReadback()})`);
        return true;
    }

    /**
     * Public method - used by flow action cards.
     *
     * Sets the charge kept in reserve for a power outage. It does not stop the
     * battery discharging in AI mode; holdBatteryLevel does that.
     */
    async setBackupSoc(percent) {
        return this._writeSocSetting('backup SOC',
            utilFunctions.clampPercent(percent),
            value => this.api.setBackupSoc(value),
            () => this.api.readBackupSoc());
    }

    /**
     * Public method - used by flow action cards.
     *
     * Sets the level the battery stops charging at, for example 80 % to spare
     * the battery in summer.
     */
    async setChargeCutoffSoc(percent) {
        return this._writeSocSetting('charge cut-off SOC',
            utilFunctions.clampPercent(percent),
            value => this.api.setChargeCutoffSoc(value),
            () => this.api.readChargeCutoffSoc());
    }

    async _writeSocSetting(label, percent, write, read) {
        if (!this.api) {
            throw new Error(`Failed to set ${label}! Device is not connected.`);
        }

        await write(percent).catch(reason => {
            this.error(`Failed to set ${label}!`, reason);
            throw new Error(`Failed to set ${label}! ${utilFunctions.formatError(reason)}`);
        });

        let readback;
        try {
            readback = `${await read()}%`;
        } catch (error) {
            readback = `failed: ${utilFunctions.formatError(error)}`;
        }
        this.logMessage(`Set ${label} to ${percent}% (readback ${readback},`
            + ` SoC: ${this.getCapabilityValue('measure_battery') ?? 'unknown'}%,`
            + ` EMS work mode: ${this.getCapabilityValue('ems_work_mode') ?? 'unknown'})`);
        return true;
    }

    /**
     * Like _describeEssLimitReadback: what the plant stored after a cut-off
     * write, so a diagnostic report tells "stored but ignored" apart from
     * "never stored". A failed readback is only reported.
     */
    async _describeDischargeCutoffReadback() {
        try {
            return `readback ${await this.api.readDischargeCutoffSoc()}%`;
        } catch (error) {
            return `readback failed: ${utilFunctions.formatError(error)}`;
        }
    }

    /**
     * While held, the battery should stop discharging once the SoC reaches the
     * cut-off. If it is still discharging, log it every few minutes with the
     * values needed to tell whether the plant ignores the cut-off.
     */
    _checkHoldDischarge(soc, batteryPower, holdCutoff) {
        if (!Number.isFinite(batteryPower) || batteryPower > -HOLD_DISCHARGE_WARNING_W) {
            return;
        }

        const now = Date.now();
        if (this._holdWarnedAt === undefined) {
            // Hold carried over from before an app restart: start counting now.
            this._holdWarnedAt = now;
            return;
        }
        if (now - this._holdWarnedAt < HOLD_DISCHARGE_WARNING_INTERVAL_MS) {
            return;
        }

        this._holdWarnedAt = now;
        this.logMessage(`Battery hold active but still discharging ${batteryPower} W`
            + ` (SoC ${soc}%, cut-off ${holdCutoff}%,`
            + ` EMS work mode: ${this.getCapabilityValue('ems_work_mode') ?? 'unknown'})`);
    }

    /**
     * While a hold is active, move the cut-off with the SoC as decided by
     * utilFunctions.followHoldCutoff: up as solar charges the battery, and
     * down if the SoC falls clearly below it, so the plant never charges from
     * the grid to reach the hold.
     */
    async _followBatteryHold(soc, batteryPower) {
        const holdCutoff = this.getStoreValue(STORE_HOLD_CUTOFF);
        if (!Number.isFinite(holdCutoff) || this._adjustingHold || !this.api) {
            return;
        }

        this._checkHoldDischarge(soc, batteryPower, holdCutoff);

        const cutoff = utilFunctions.followHoldCutoff(soc, holdCutoff, this.getStoreValue(STORE_CUTOFF_BEFORE_HOLD));
        if (cutoff === undefined) {
            return;
        }

        const raise = cutoff > holdCutoff;
        this._adjustingHold = true;
        try {
            await this.api.setDischargeCutoffSoc(cutoff);
            await this.setStoreValue(STORE_HOLD_CUTOFF, cutoff);
            this.logMessage(`Battery hold ${raise ? 'raised' : 'lowered'} to ${cutoff}% as SoC ${raise ? 'rose' : 'fell'} to ${soc}%`
                + ` (${await this._describeDischargeCutoffReadback()})`);
        } catch (error) {
            this.error(`Failed to ${raise ? 'raise' : 'lower'} the battery hold:`, error);
        } finally {
            this._adjustingHold = false;
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

        await this._followBatteryHold(message.batterySoc, message.batteryPower);

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
