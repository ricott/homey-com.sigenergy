'use strict';
const { EvACChargerRegistry } = require('../modbus/registry/evACCharger.js');
const Base = require('../base.js');
const utilFunctions = require('../util.js');

class EVACCharger extends Base {
    constructor(options) {
        super(EvACChargerRegistry, options);
    }

    startCharging() {
        return this.writeRegisters(42000, utilFunctions.createBuffer(1, 1));
    }

    stopCharging() {
        return this.writeRegisters(42000, utilFunctions.createBuffer(0, 1));
    }
}

module.exports = EVACCharger;