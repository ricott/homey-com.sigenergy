'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const PlantRegistry = Object.freeze({
    name: 'Plant',

    gridPower: new ModbusRegistry(setting.READING, 30005, 2, type.int32_1, 'Grid power'),
    gridStatus: new ModbusRegistry(setting.READING, 30009, 1, type.uint16_1, 'Grid status'),
    batterySoc: new ModbusRegistry(setting.READING, 30014, 1, type.uint16_10, 'Battery SoC'),
    solarPower: new ModbusRegistry(setting.READING, 30035, 2, type.int32_1, 'Solar power'),
    batteryPower: new ModbusRegistry(setting.READING, 30037, 2, type.int32_1, 'Battery power'),
    generalLoadPower: new ModbusRegistry(setting.READING, 30282, 2, type.int32_1, 'General load power')

});

module.exports = {
    PlantRegistry
}