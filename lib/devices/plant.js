'use strict';
const { PlantRegistry } = require('../modbus/registry/plant.js');
const Base = require('../base.js');
const utilFunctions = require('../util.js');

class Plant extends Base {
    constructor(options) {
        super(PlantRegistry, options);
    }

    /**
     * Set the plant-wide ESS maximum charging power limit (in kW).
     *
     * Register 40032, U32, gain 1000. Allowed range [0, rated ESS charging
     * power]. Per the Modbus spec this takes effect globally regardless of the
     * EMS operating mode, so it does not require remote EMS to be enabled.
     *
     * Plant registers are only addressable on unit id 247, which is the unit id
     * the plant device is paired with, so no unit id override is needed here.
     */
    setEssMaxChargingLimit(kW) {
        return this.writeRegisters(40032, utilFunctions.createBuffer32(kW, 1000));
    }

    /**
     * Set the plant-wide ESS maximum discharging power limit (in kW).
     *
     * Register 40034, U32, gain 1000. Allowed range [0, rated ESS discharging
     * power]. Writing 0 stops the battery from discharging altogether; a
     * non-zero value caps how much it may contribute.
     *
     * Note: while no limit has ever been set, 40032/40034 read back as
     * 0xFFFFFFFF rather than 0 (confirmed on hardware). That sentinel is
     * outside the documented writable range, so "remove the limit" writes the
     * rated power instead - the plant cannot exceed its rated power anyway, so
     * the effect is the same without writing an undocumented value. Readback of
     * these registers is also reported to be unreliable in some EMS modes, so
     * they are deliberately not surfaced as capabilities.
     */
    setEssMaxDischargingLimit(kW) {
        return this.writeRegisters(40034, utilFunctions.createBuffer32(kW, 1000));
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
     * Read the plant battery SoC in % (register 30014, U16, gain 10).
     */
    async readBatterySoc() {
        const buffer = await this.readRegisters(30014, 1);
        return buffer.readUInt16BE(0) / 10;
    }

    /**
     * Read the ESS discharge cut-off SOC in % (register 40048, U16, gain 10).
     */
    async readDischargeCutoffSoc() {
        const buffer = await this.readRegisters(40048, 1);
        return buffer.readUInt16BE(0) / 10;
    }

    /**
     * Set the ESS discharge cut-off SOC in % (register 40048, range [0, 100]).
     * Unlike the ESS power limits, this is respected in AI mode.
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
