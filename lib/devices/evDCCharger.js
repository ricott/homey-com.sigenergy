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
}

module.exports = EVDCCharger;