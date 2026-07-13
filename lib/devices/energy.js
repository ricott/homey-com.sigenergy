'use strict';
const { EnergyRegistry } = require('../modbus/registry/energy.js');
const Base = require('../base.js');
const utilFunctions = require('../util.js');

class Energy extends Base {
    constructor(options) {
        super(EnergyRegistry, options);
    }

    setMaxExportLimitation(limit) {
        return this.writeRegisters(40038, utilFunctions.createBuffer32(limit, 1000));
    }

    setMaxImportLimitation(limit) {
        return this.writeRegisters(40040, utilFunctions.createBuffer32(limit, 1000));
    }
}
module.exports = Energy;