'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const EvDCChargerRegistry = Object.freeze({
    name: 'EvDCCharger',

    serial: new ModbusRegistry(setting.INFO, 30515, 10, type.string, 'Serial'),

    // Rated power values - read once, used to bound the configurable power limits
    ratedChargingPower: new ModbusRegistry(setting.INFO, 31523, 2, type.uint32_1000, 'Rated charging power'),
    ratedDischargingPower: new ModbusRegistry(setting.INFO, 31525, 2, type.uint32_1000, 'Rated discharging power'),

    // Live readings
    vehicleBatteryVoltage: new ModbusRegistry(setting.READING, 31500, 1, type.uint16_10, 'Vehicle battery voltage'),
    current: new ModbusRegistry(setting.READING, 31501, 1, type.uint16_10, 'Charging current'),
    power: new ModbusRegistry(setting.READING, 31502, 2, type.int32_1, 'Output power'),
    vehicleSoc: new ModbusRegistry(setting.READING, 31504, 1, type.uint16_10, 'Vehicle SOC'),

    // Current session counters (single-time)
    sessionChargeEnergy: new ModbusRegistry(setting.READING, 31505, 2, type.uint32_100, 'Session charged energy'),
    sessionChargeDuration: new ModbusRegistry(setting.READING, 31507, 2, type.uint32_1, 'Session charging duration (s)'),

    // Detailed running state (Appendix 14)
    runningState: new ModbusRegistry(setting.READING, 31513, 1, type.uint16_1, 'Running state'),

    // Discharging registers added in v2.9
    dischargeCurrent: new ModbusRegistry(setting.READING, 31514, 1, type.uint16_10, 'Discharging current'),
    sessionDischargeEnergy: new ModbusRegistry(setting.READING, 31515, 2, type.uint32_100, 'Session discharged energy'),
    sessionDischargeDuration: new ModbusRegistry(setting.READING, 31517, 2, type.uint32_1, 'Session discharging duration (s)'),

    // Power limit holding registers (RW) - added in v2.9
    maxChargePowerLimit: new ModbusRegistry(setting.READING, 41002, 2, type.uint32_1000, 'Max charging power limit'),
    maxDischargePowerLimit: new ModbusRegistry(setting.READING, 41004, 2, type.uint32_1000, 'Max discharging power limit'),

    // Plant-level statistics interface (still useful for lifetime totals)
    totalChargeEnergy: new ModbusRegistry(setting.SYSTEM, 30252, 4, type.uint64_100, 'Total charged energy EVDC'),
    totalDischargeEnergy: new ModbusRegistry(setting.SYSTEM, 30256, 4, type.uint64_100, 'Total discharged energy EVDC')

});

module.exports = {
    EvDCChargerRegistry
}
