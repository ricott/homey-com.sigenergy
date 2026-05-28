'use strict';
const { EvDCChargerRegistry } = require('../modbus/registry/evDCCharger.js');
const Base = require('../base.js');
const utilFunctions = require('../util.js');

class EVDCCharger extends Base {
    constructor(options) {
        super(EvDCChargerRegistry, options);
    }

    startCharging() {
        return this.getModbusClient().writeMultipleRegisters(41000, utilFunctions.createBuffer(0, 1))
            .then(() => true);
    }

    stopCharging() {
        return this.getModbusClient().writeMultipleRegisters(41000, utilFunctions.createBuffer(1, 1))
            .then(() => true);
    }

    /**
     * Set the maximum charging power limit (in kW).
     * Register 41002, U32, gain 1000. Allowed range [0, rated charging power].
     */
    setMaxChargePower(kW) {
        return this.getModbusClient().writeMultipleRegisters(41002, utilFunctions.createBuffer32(kW, 1000))
            .then(() => true);
    }

    /**
     * Set the maximum discharging power limit (in kW).
     * Register 41004, U32, gain 1000. Allowed range [0, rated discharging power].
     */
    setMaxDischargePower(kW) {
        return this.getModbusClient().writeMultipleRegisters(41004, utilFunctions.createBuffer32(kW, 1000))
            .then(() => true);
    }
}

module.exports = EVDCCharger;
