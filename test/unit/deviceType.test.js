'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const deviceType = require('../../lib/deviceType.js');
const { ModbusRegistry, type, setting } = require('../../lib/modbus/modbusRegistry.js');

const registry = Object.freeze({
    name: 'Test',
    reading1: new ModbusRegistry(setting.READING, 10, 1, type.uint16_1, 'Reading one'),
    reading2: new ModbusRegistry(setting.READING, 11, 1, type.uint16_10, 'Reading two'),
    info1: new ModbusRegistry(setting.INFO, 20, 2, type.uint32_1, 'Info one'),
    system1: new ModbusRegistry(setting.SYSTEM, 30, 2, type.int32_1, 'System one')
});

function u16(value) {
    const b = Buffer.alloc(2);
    b.writeUInt16BE(value);
    return b;
}

test('getReadingRegistries returns only READING registries, carrying the key', () => {
    const regs = deviceType.getReadingRegistries(registry);
    assert.deepEqual(regs.map(r => r.key), ['reading1', 'reading2']);
    assert.deepEqual(regs[0], { key: 'reading1', comment: 'Reading one', registryId: 10, count: 1 });
});

test('getInfoRegistries and getSystemRegistries filter by setting', () => {
    assert.deepEqual(deviceType.getInfoRegistries(registry).map(r => r.key), ['info1']);
    assert.deepEqual(deviceType.getSystemRegistries(registry).map(r => r.key), ['system1']);
});

test('the string "name" property is never treated as a registry', () => {
    const allKeys = [
        ...deviceType.getReadingRegistries(registry),
        ...deviceType.getInfoRegistries(registry),
        ...deviceType.getSystemRegistries(registry)
    ].map(r => r.key);
    assert.ok(!allKeys.includes('name'));
});

test('decodeValues decodes a buffer map by key', () => {
    const decoded = deviceType.decodeValues(registry, {
        reading1: u16(500),
        reading2: u16(505)
    });
    assert.deepEqual(decoded, { reading1: 500, reading2: 50.5 });
});

test('decodeValues skips failed (null) registers', () => {
    const decoded = deviceType.decodeValues(registry, {
        reading1: u16(42),
        reading2: null
    });
    assert.deepEqual(decoded, { reading1: 42 });
    assert.ok(!('reading2' in decoded));
});

test('decodeValues ignores unknown keys and tolerates an empty/undefined map', () => {
    assert.deepEqual(deviceType.decodeValues(registry, { unknown: u16(1) }), {});
    assert.deepEqual(deviceType.decodeValues(registry, {}), {});
    assert.deepEqual(deviceType.decodeValues(registry, undefined), {});
});

test('mapping is order-independent (decodes by name, not position)', () => {
    const decoded = deviceType.decodeValues(registry, {
        reading2: u16(200), // reversed order
        reading1: u16(100)
    });
    assert.equal(decoded.reading1, 100);
    assert.equal(decoded.reading2, 20);
});
