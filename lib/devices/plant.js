'use strict';
const { PlantRegistry } = require('../modbus/registry/plant.js');
const Base = require('../base.js');
const utilFunctions = require('../util.js');

function noLimitBuffer() {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(0xFFFFFFFF);
    return buffer;
}

class Plant extends Base {
    constructor(options) {
        super(PlantRegistry, options);
    }

    /*
     * The ESS charging/discharging limits (40032/40034) and the PV limit
     * (40036) are enforced only while either remote EMS is active (work mode
     * 7) or "Remote EMS power limit global enable" (40162) is 1 (protocol
     * V2.10, confirmed on hardware: in AI mode a discharge limit was ignored
     * until 40162 was set). Older firmware without 40162 followed the V2.9
     * wording, which applied 40032/40036 regardless of mode. While not
     * enforced, the stored values are kept and apply again once a condition
     * holds.
     *
     * With no limit set each register reads 0xFFFFFFFF. Writing that value
     * back is accepted (confirmed on hardware) and returns the register to
     * its factory "no limit" state.
     *
     * Plant registers are only addressable on unit id 247, which is the unit id
     * the plant device is paired with, so no unit id override is needed here.
     */

    /**
     * Set the plant-wide ESS maximum charging power limit (in kW).
     * Register 40032, U32, gain 1000, range [0, rated ESS charging power].
     */
    setEssMaxChargingLimit(kW) {
        return this.writeRegisters(40032, utilFunctions.createBuffer32(kW, 1000));
    }

    /**
     * Set the plant-wide ESS maximum discharging power limit (in kW).
     * Register 40034, U32, gain 1000, range [0, rated ESS discharging power].
     * Writing 0 stops the battery from discharging altogether.
     */
    setEssMaxDischargingLimit(kW) {
        return this.writeRegisters(40034, utilFunctions.createBuffer32(kW, 1000));
    }

    /**
     * Remove an ESS power limit (40032 charging, 40034 discharging) by writing
     * the 0xFFFFFFFF "no limit" sentinel.
     */
    removeEssLimit(label) {
        return this.writeRegisters(label === 'charging' ? 40032 : 40034, noLimitBuffer());
    }

    /**
     * Read "Remote EMS power limit global enable" (40162, U16): 1 when the
     * ESS and PV limits are enforced in every EMS work mode. Throws on
     * firmware that predates the register.
     */
    async readLimitGlobalEnable() {
        const buffer = await this.readRegisters(40162, 1);
        return buffer.readUInt16BE(0);
    }

    /**
     * Set "Remote EMS power limit global enable" (40162). Default 0.
     */
    setLimitGlobalEnable(enabled) {
        return this.writeRegisters(40162, utilFunctions.createBuffer(enabled ? 1 : 0, 1));
    }

    /**
     * Read back an ESS power limit (40032 charging, 40034 discharging) in kW,
     * to confirm what the plant stored after a write. Returns null for the
     * 0xFFFFFFFF "no limit set" sentinel.
     */
    async readEssLimit(label) {
        const buffer = await this.readRegisters(label === 'charging' ? 40032 : 40034, 2);
        const raw = buffer.readUInt32BE(0);
        return raw === 0xFFFFFFFF ? null : raw / 1000;
    }

    /**
     * Set the plant-wide PV maximum power limit (in kW).
     * Register 40036, U32, gain 1000. Writing 0 stops solar production.
     */
    setPvMaxPowerLimit(kW) {
        return this.writeRegisters(40036, utilFunctions.createBuffer32(kW, 1000));
    }

    /**
     * Remove the PV maximum power limit by writing the 0xFFFFFFFF sentinel.
     */
    removePvMaxPowerLimit() {
        return this.writeRegisters(40036, noLimitBuffer());
    }

    /**
     * Read back the PV maximum power limit (40036) in kW. Returns null for the
     * 0xFFFFFFFF "no limit set" sentinel.
     */
    async readPvMaxPowerLimit() {
        const buffer = await this.readRegisters(40036, 2);
        const raw = buffer.readUInt32BE(0);
        return raw === 0xFFFFFFFF ? null : raw / 1000;
    }

    /**
     * Read the plant battery SoC in % (register 30014, U16, gain 10).
     */
    async readBatterySoc() {
        const buffer = await this.readRegisters(30014, 1);
        return buffer.readUInt16BE(0) / 10;
    }

    /**
     * Read the ESS discharge cut-off SOC in % (register 40048, U16, gain 10).
     */
    readDischargeCutoffSoc() {
        return this._readSocSetting(40048);
    }

    /**
     * Read the ESS backup SOC in % (register 40046, U16, gain 10).
     */
    readBackupSoc() {
        return this._readSocSetting(40046);
    }

    /**
     * Set the ESS backup SOC in % (register 40046, range [0, 100]): the charge
     * kept in reserve for a power outage. In AI mode it neither stops the
     * battery discharging nor makes it charge from the grid, even when set
     * above the SoC (confirmed on hardware).
     */
    setBackupSoc(percent) {
        return this.writeRegisters(40046, utilFunctions.createBuffer(percent, 10));
    }

    /**
     * Read the ESS charge cut-off SOC in % (register 40047, U16, gain 10).
     */
    readChargeCutoffSoc() {
        return this._readSocSetting(40047);
    }

    /**
     * Set the ESS charge cut-off SOC in % (register 40047, range [0, 100]):
     * the level the battery stops charging at.
     */
    setChargeCutoffSoc(percent) {
        return this.writeRegisters(40047, utilFunctions.createBuffer(percent, 10));
    }

    async _readSocSetting(registryId) {
        const buffer = await this.readRegisters(registryId, 1);
        return buffer.readUInt16BE(0) / 10;
    }

    /**
     * Set the ESS discharge cut-off SOC in % (register 40048, range [0, 100]).
     * Respected in AI mode without needing 40162.
     */
    setDischargeCutoffSoc(percent) {
        return this.writeRegisters(40048, utilFunctions.createBuffer(percent, 10));
    }

    /**
     * Enable or disable remote EMS (register 40029). While enabled the plant's
     * EMS work mode (30003) switches to remote EMS and follows the control mode
     * in 40031, overriding the mode chosen in mySigen.
     */
    setRemoteEmsEnabled(enabled) {
        return this.writeRegisters(40029, utilFunctions.createBuffer(enabled ? 1 : 0, 1));
    }

    /**
     * Set the remote EMS control mode (register 40031, Appendix 6). Only takes
     * effect while remote EMS is enabled.
     */
    setRemoteEmsControlMode(mode) {
        return this.writeRegisters(40031, utilFunctions.createBuffer(mode, 1));
    }
}

module.exports = Plant;
