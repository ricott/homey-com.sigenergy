'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const enums = require('../../lib/enums.js');

test('decodeBatteryChargingState maps running state + power to charge/discharge/idle', () => {
    assert.equal(enums.decodeBatteryChargingState(1, 500), 'charging');
    assert.equal(enums.decodeBatteryChargingState(1, -500), 'discharging');
    assert.equal(enums.decodeBatteryChargingState(1, 0), 'discharging'); // power > 0 is false
    assert.equal(enums.decodeBatteryChargingState(0, 500), 'idle'); // standby
    assert.equal(enums.decodeBatteryChargingState(2, 0), 'idle'); // fault
    assert.equal(enums.decodeBatteryChargingState(99, 0), 'idle'); // default
});

test('decodeDCChargerState resolves known states and flags unknown ones', () => {
    assert.equal(enums.decodeDCChargerState(3), 'Charging');
    assert.equal(enums.decodeDCChargerState(0), 'Idle');
    assert.equal(enums.decodeDCChargerState(99), 'UNKNOWN (99)');
    assert.equal(enums.decodeDCChargerState(undefined), undefined);
});

test('mapDCChargerStateToChargingState reflects charging/discharging by power sign', () => {
    assert.equal(enums.mapDCChargerStateToChargingState(0, 0), 'plugged_out');
    assert.equal(enums.mapDCChargerStateToChargingState(1, 0), 'plugged_in');
    assert.equal(enums.mapDCChargerStateToChargingState(3, 500), 'plugged_in_charging');
    assert.equal(enums.mapDCChargerStateToChargingState(3, 0), 'plugged_in');
    assert.equal(enums.mapDCChargerStateToChargingState(8, -500), 'plugged_in_discharging');
    assert.equal(enums.mapDCChargerStateToChargingState(8, 0), 'plugged_in');
    assert.equal(enums.mapDCChargerStateToChargingState(4, 0), 'plugged_in_paused'); // fault
});

test('mapACChargerStatusToChargingState follows IEC 61851 states', () => {
    assert.equal(enums.mapACChargerStatusToChargingState(1, 0), 'plugged_out'); // Not connected (A)
    assert.equal(enums.mapACChargerStatusToChargingState(2, 0), 'plugged_in'); // Connected (B1)
    assert.equal(enums.mapACChargerStatusToChargingState(4, 500), 'plugged_in_charging'); // C1
    assert.equal(enums.mapACChargerStatusToChargingState(4, 0), 'plugged_in');
    assert.equal(enums.mapACChargerStatusToChargingState(6, 0), 'plugged_out'); // Fault
});

test('grid / battery / inverter enum decoders', () => {
    assert.equal(enums.decodeGridStatus(0), 'On grid');
    assert.equal(enums.decodeGridStatus(1), 'Off grid');
    assert.equal(enums.decodeBatteryStatus(1), 'Running');
    assert.equal(enums.decodeInverterOutputType(1), 'L1/L2/L3');
    assert.equal(enums.decodePhaseControl(1), 'Enabled');
});

test('getDCChargerStates returns id/name pairs for autocomplete', () => {
    const states = enums.getDCChargerStates();
    assert.ok(Array.isArray(states));
    const charging = states.find(s => s.name === 'Charging');
    assert.deepEqual(charging, { id: '3', name: 'Charging' });
});
