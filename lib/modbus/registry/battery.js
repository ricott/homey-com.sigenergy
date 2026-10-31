'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const BatteryRegistry = Object.freeze({
    name: 'Battery',

    // Identity, read once per connection and logged. Firmware is also a READING
    // below because it backs a capability and the firmware_changed flow trigger,
    // which has to keep noticing changes on a live connection.
    modelType: new ModbusRegistry(setting.INFO, 30500, 15, type.string, 'Model type'),
    serial: new ModbusRegistry(setting.INFO, 30515, 10, type.string, 'Serial'),
    capacity: new ModbusRegistry(setting.INFO, 30548, 2, type.uint32_100, 'Rated battery capacity'),

    // No ESS power on the modbus device, need to use the plant power instead
    power: new ModbusRegistry(setting.SYSTEM, 30037, 2, type.int32_1, 'ESS power'),
    // activePower: new ModbusRegistry(setting.READING, 30587, 2, type.int32_1, 'Active power'),

    firmware: new ModbusRegistry(setting.READING, 30525, 15, type.string, 'Firmware'),
    totalChargeEnergy: new ModbusRegistry(setting.READING, 30568, 4, type.uint64_100, 'Total charge energy'),
    totalDischargeEnergy: new ModbusRegistry(setting.READING, 30574, 4, type.uint64_100, 'Total discharge energy'),
    status: new ModbusRegistry(setting.READING, 30578, 1, type.uint16_1, 'Running state'),
    soc: new ModbusRegistry(setting.READING, 30601, 1, type.uint16_10, 'Battery SoC'),
    soh: new ModbusRegistry(setting.READING, 30602, 1, type.uint16_10, 'Battery SoH'),
    avgCellTemperature: new ModbusRegistry(setting.READING, 30603, 1, type.int16_10, 'Average cell temperature'),
    maxCellTemperature: new ModbusRegistry(setting.READING, 30620, 1, type.int16_10, 'Maximum cell temperature'),
    // Always reads 0 on some systems but reports real values on others,
    // retrofit installs among them - see BatteryDevice._updateMinCellTemperature.
    minCellTemperature: new ModbusRegistry(setting.READING, 30621, 1, type.int16_10, 'Minimum cell temperature'),
    // The min/max cell voltages (30622/30623) answer with a Modbus exception
    // (confirmed on V100R001C21SPC117), so they are not read.
    // maxCellVoltage: new ModbusRegistry(setting.READING, 30622, 1, type.uint16_1000, 'Maximum cell voltage'),
    // minCellVoltage: new ModbusRegistry(setting.READING, 30623, 1, type.uint16_1000, 'Minimum cell voltage')

    pcsTemperature: new ModbusRegistry(setting.READING, 31003, 1, type.int16_10, 'PCS temperature'),
});

module.exports = {
    BatteryRegistry
}