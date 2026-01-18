'use strict';
const { EvACChargerRegistry } = require('../modbus/registry/evACCharger.js');
const Base = require('../base.js');
const utilFunctions = require('../util.js');

class EVACCharger extends Base {
    constructor(options) {
        super(EvACChargerRegistry, options);
    }

    startCharging() {
        return this.getModbusClient().writeMultipleRegisters(42000, utilFunctions.createBuffer(1, 1))
            .then(() => true);
    }

    stopCharging() {
        return this.getModbusClient().writeMultipleRegisters(42000, utilFunctions.createBuffer(0, 1))
            .then(() => true);
    }
}

module.exports = EVACCharger;