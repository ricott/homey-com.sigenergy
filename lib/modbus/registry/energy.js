'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const EnergyRegistry = Object.freeze({
    name: 'Energy',

    // serial: new ModbusRegistry(setting.INFO, 2609, 7, type.string, 'Serial'),

    power: new ModbusRegistry(setting.READING, 30005, 2, type.int32_1, 'Power'),
    gridStatus: new ModbusRegistry(setting.SYSTEM, 30009, 1, type.uint16_1, 'Grid status'),
    powerL1: new ModbusRegistry(setting.READING, 30052, 2, type.int32_1, 'Power L1'),
    // voltageL1: new ModbusRegistry(setting.READING, 30286, 2, type.int32_1, 'Voltage L1'),
    // currentL1: new ModbusRegistry(setting.READING, 30292, 2, type.int32_1, 'Current L1'),
    powerL2: new ModbusRegistry(setting.READING, 30054, 2, type.int32_1, 'Power L2'),
    // voltageL2: new ModbusRegistry(setting.READING, 30288, 2, type.int32_1, 'Voltage L2'),
    // currentL2: new ModbusRegistry(setting.READING, 30294, 2, type.int32_1, 'Current L2'),
    powerL3: new ModbusRegistry(setting.READING, 30056, 2, type.int32_1, 'Power L3'),
    // voltageL3: new ModbusRegistry(setting.READING, 30290, 2, type.int32_1, 'Voltage L3'),
    // currentL3: new ModbusRegistry(setting.READING, 30296, 2, type.int32_1, 'Current L3'),

    totalImportedEnergy: new ModbusRegistry(setting.READING, 30260, 4, type.uint64_100, 'Imported energy'),
    totalExportedEnergy: new ModbusRegistry(setting.READING, 30264, 4, type.uint64_100, 'Exported energy'),

    phaseControl: new ModbusRegistry(setting.READING, 40030, 1, type.uint16_1, 'Independent phase control'),
    // maxExportLimitation: new ModbusRegistry(setting.READING, 40038, 2, type.uint32_1, 'Max export limitation'),
    // maxImportLimitation: new ModbusRegistry(setting.READING, 40040, 2, type.uint32_1, 'Max import limitation'),
});

module.exports = {
    EnergyRegistry
}