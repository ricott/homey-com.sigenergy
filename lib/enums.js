'use strict';

const Enum = require('enum');

exports.decodeBatteryChargingState = function (numType, power) {
    switch (numType) {
        case 0: // standby
        case 2: // fault
        case 3: // shutdown
        case 7: // abnormality
            return 'idle';
        case 1: // running
            return power > 0 ? 'charging' : 'discharging';
        default:
            return 'idle';
    }
}

// Appendix 14 - DC Charger running state
const dcChargerState = new Enum({
    'Idle': 0,
    'Occupied': 1,                       // Gun plugged in but not detected
    'Preparing - Communication': 2,      // Establishing communication
    'Charging': 3,
    'Fault': 4,
    'Scheduled': 5,
    'Ended': 6,
    'Unavailable': 7,                    // Under maintenance
    'Discharging': 8,
    'Alarm': 9,
    'Preparing - Insulation': 10         // Insulation detection in progress
});

exports.decodeDCChargerState = function (numType) {
    return lookupEnumKey(dcChargerState, numType);
}

exports.getDCChargerStates = function () {
    return getEnumAsJson(dcChargerState);
}

exports.mapDCChargerStateToChargingState = function (state, power) {
    switch (state) {
        case 0: // Idle
            return 'plugged_out';
        case 1: // Occupied
        case 2: // Preparing - Communication
        case 5: // Scheduled
        case 6: // Ended
        case 10: // Preparing - Insulation
            return 'plugged_in';
        case 3: // Charging
            return power > 0 ? 'plugged_in_charging' : 'plugged_in';
        case 8: // Discharging
            return power < 0 ? 'plugged_in_discharging' : 'plugged_in';
        case 4: // Fault
        case 7: // Unavailable
        case 9: // Alarm
            return 'plugged_in_paused';
        default:
            return 'plugged_out';
    }
}

exports.mapACChargerStatusToChargingState = function (iecStatus, power) {
    switch (iecStatus) {
        case 0: // System Init
        case 7: // No Power (E)
        case 1: // Not Connected (A)
            return 'plugged_out';
        case 2: // Connected - Not Ready (B1)
        case 3: // Connected - Not Ready (B2)
            return 'plugged_in';
        case 4: // Charging (C1)
        case 5: // Charging (C2)
            return power > 0 ? 'plugged_in_charging' : 'plugged_in';
        case 6: // Fault (F)
            return 'plugged_out'; // or create a fault state
        default:
            return 'plugged_out';
    }
}

const phaseControl = new Enum({
    'Enabled': 1,
    'Disabled': 0
});

exports.decodePhaseControl = function (numType) {
    return lookupEnumKey(phaseControl, numType);
}

exports.getPhaseControl = function () {
    return getEnumAsJson(phaseControl);
}

const gridStatus = new Enum({
    'On grid': 0,
    'Off grid': 1,
    'Off grid (manual)': 2
});

exports.decodeGridStatus = function (numType) {
    return lookupEnumKey(gridStatus, numType);
}

exports.getGridStatuses = function () {
    return getEnumAsJson(gridStatus);
}

const acChargerStatus = new Enum({
    'System Init': 0,
    'Not Connected (A)': 1,              // State A: Vehicle not connected
    'Connected - Not Ready (B1)': 2,     // State B1: Vehicle connected, not ready for charging
    'Connected - Not Ready (B2)': 3,     // State B2: Vehicle connected, not ready (ventilation)
    'Charging (C1)': 4,                  // State C1: Actively charging
    'Charging (C2)': 5,                  // State C2: Actively charging (ventilation)
    'Fault (F)': 6,                      // State F: Error/fault condition
    'No Power (E)': 7                    // State E: EVSE not available
});

exports.decodeACChargerStatus = function (numType) {
    return lookupEnumKey(acChargerStatus, numType);
}

const batteryStatus = new Enum({
    'Standby': 0,
    'Running': 1,
    'Fault': 2,
    'Shutdown': 3,
    'Abnormality': 7
});

exports.decodeBatteryStatus = function (numType) {
    return lookupEnumKey(batteryStatus, numType);
}

exports.getBatteryStatuses = function () {
    return getEnumAsJson(batteryStatus);
}

const inverterOutputType = new Enum({
    'L/N': 0,
    'L1/L2/L3': 1,
    'L1/L2/L3/N': 2,
    'L1/L2/N': 3
});

exports.decodeInverterOutputType = function (numType) {
    return lookupEnumKey(inverterOutputType, numType);
}

function lookupEnumKey(enumObject, value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (enumObject.get(value)) {
        return enumObject.get(value).key;
    } else {
        return `UNKNOWN (${value})`
    }
}

function getEnumAsJson(enumObject) {
    let values = [];
    enumObject.enums.forEach(function (entry) {
        values.push({
            id: `${entry.value}`,
            name: `${entry.key}`
        });
    });
    return values;
}