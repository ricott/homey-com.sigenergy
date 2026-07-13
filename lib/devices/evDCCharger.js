'use strict';
const { EvDCChargerRegistry } = require('../modbus/registry/evDCCharger.js');
const Base = require('../base.js');
const utilFunctions = require('../util.js');

class EVDCCharger extends Base {
    constructor(options) {
        super(EvDCChargerRegistry, options);
    }

    startCharging() {
        return this.writeRegisters(41000, utilFunctions.createBuffer(0, 1));
    }

    stopCharging() {
        return this.writeRegisters(41000, utilFunctions.createBuffer(1, 1));
    }

    /**
     * Set the maximum charging power limit (in kW).
     * Register 41002, U32, gain 1000. Allowed range [0, rated charging power].
     */
    setMaxChargePower(kW) {
        return this.writeRegisters(41002, utilFunctions.createBuffer32(kW, 1000));
    }

    /**
     * Set the maximum discharging power limit (in kW).
     * Register 41004, U32, gain 1000. Allowed range [0, rated discharging power].
     */
    setMaxDischargePower(kW) {
        return this.writeRegisters(41004, utilFunctions.createBuffer32(kW, 1000));
    }
}

module.exports = EVDCCharger;
