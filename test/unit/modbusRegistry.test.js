'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ModbusRegistry, type, setting } = require('../../lib/modbus/modbusRegistry.js');

function u16(value) {
    const b = Buffer.alloc(2);
    b.writeUInt16BE(value);
    return b;
}
function i16(value) {
    const b = Buffer.alloc(2);
    b.writeInt16BE(value);
    return b;
}
function u32(value) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(value);
    return b;
}
function i32(value) {
    const b = Buffer.alloc(4);
    b.writeInt32BE(value);
    return b;
}
function u64(high, low) {
    const b = Buffer.alloc(8);
    b.writeUInt32BE(high, 0);
    b.writeUInt32BE(low, 4);
    return b;
}

function reg(t) {
    return new ModbusRegistry(setting.READING, 100, 1, t, 'test');
}

test('readData uint16 applies the gain factor', () => {
    assert.equal(reg(type.uint16_1).readData(u16(500)), 500);
    assert.equal(reg(type.uint16_10).readData(u16(505)), 50.5);
    assert.equal(reg(type.uint16_100).readData(u16(12345)), 123.45);
});

test('readData int16 handles negative values', () => {
    assert.equal(reg(type.int16_1).readData(i16(-42)), -42);
    assert.equal(reg(type.int16_10).readData(i16(-105)), -10.5);
});

test('readData uint32 / int32', () => {
    assert.equal(reg(type.uint32_100).readData(u32(1000)), 10);
    assert.equal(reg(type.int32_1).readData(i32(-12345)), -12345);
});

test('readData uint64 combines high/low words', () => {
    // low = 500000, high = 0 => 500000 / 100 = 5000
    assert.equal(reg(type.uint64_100).readData(u64(0, 500000)), 5000);
    // high word set => high * 2^32 + low
    assert.equal(reg(type.uint64_1).readData(u64(1, 0)), 0x100000000);
});

test('readData string trims NULs and whitespace', () => {
    assert.equal(reg(type.string).readData(Buffer.from('ABC123\0\0\0')), 'ABC123');
    assert.equal(reg(type.string).readData(Buffer.from('  SN9 \0')), 'SN9');
});

test('readData returns 0 for a missing (null) buffer', () => {
    assert.equal(reg(type.uint16_1).readData(null), 0);
    assert.equal(reg(type.string).readData(undefined), 0);
});

test('getters expose the constructor values', () => {
    const r = new ModbusRegistry(setting.INFO, 30515, 10, type.string, 'Serial', 'serial_cap');
    assert.equal(r.setting, setting.INFO);
    assert.equal(r.registryId, 30515);
    assert.equal(r.count, 10);
    assert.equal(r.comment, 'Serial');
    assert.equal(r.capability, 'serial_cap');
});
