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

test('groupRegistersIntoRuns merges contiguous and near-contiguous registers', () => {
    // Contiguous block: 10(1), 11(2 -> ends 13), 13(1) => one run 10..14 (count 4)
    const regs = [
        { key: 'a', registryId: 10, count: 1, comment: 'a' },
        { key: 'b', registryId: 11, count: 2, comment: 'b' },
        { key: 'c', registryId: 13, count: 1, comment: 'c' }
    ];
    const runs = deviceType.groupRegistersIntoRuns(regs, { maxGap: 8, maxRun: 120 });
    assert.equal(runs.length, 1);
    assert.deepEqual({ start: runs[0].start, count: runs[0].count }, { start: 10, count: 4 });
    assert.deepEqual(runs[0].registers.map(r => r.key), ['a', 'b', 'c']);
});

test('groupRegistersIntoRuns bridges holes up to maxGap but splits larger gaps', () => {
    const regs = [
        { key: 'a', registryId: 100, count: 1, comment: 'a' }, // ends 101
        { key: 'b', registryId: 105, count: 1, comment: 'b' }, // gap 4 -> same run (maxGap 8)
        { key: 'c', registryId: 130, count: 1, comment: 'c' }  // gap 24 -> new run
    ];
    const runs = deviceType.groupRegistersIntoRuns(regs, { maxGap: 8, maxRun: 120 });
    assert.equal(runs.length, 2);
    assert.deepEqual({ start: runs[0].start, count: runs[0].count }, { start: 100, count: 6 }); // 100..105
    assert.deepEqual(runs[0].registers.map(r => r.key), ['a', 'b']);
    assert.deepEqual({ start: runs[1].start, count: runs[1].count }, { start: 130, count: 1 });
});

test('groupRegistersIntoRuns respects maxRun (never exceeds the read limit)', () => {
    const regs = [
        { key: 'a', registryId: 0, count: 1, comment: 'a' },
        { key: 'b', registryId: 5, count: 1, comment: 'b' }, // span would be 6
        { key: 'c', registryId: 118, count: 1, comment: 'c' } // span 119 > 120? gap from 6 is 112 anyway
    ];
    const runs = deviceType.groupRegistersIntoRuns(regs, { maxGap: 8, maxRun: 120 });
    // 'c' is far away -> its own run regardless
    assert.equal(runs.length, 2);

    // A run that would exceed maxRun must split even when the gap is small.
    const dense = [
        { key: 'x', registryId: 0, count: 100, comment: 'x' }, // ends 100
        { key: 'y', registryId: 100, count: 30, comment: 'y' } // span 130 > 120
    ];
    const denseRuns = deviceType.groupRegistersIntoRuns(dense, { maxGap: 8, maxRun: 120 });
    assert.equal(denseRuns.length, 2);
});

test('groupRegistersIntoRuns sorts by address regardless of input order', () => {
    const regs = [
        { key: 'c', registryId: 13, count: 1, comment: 'c' },
        { key: 'a', registryId: 10, count: 1, comment: 'a' },
        { key: 'b', registryId: 11, count: 2, comment: 'b' }
    ];
    const runs = deviceType.groupRegistersIntoRuns(regs, { maxGap: 8, maxRun: 120 });
    assert.equal(runs.length, 1);
    assert.deepEqual(runs[0].registers.map(r => r.key), ['a', 'b', 'c']);
});

test('sliceRunBuffer slices per register by byte offset, and slices decode correctly', () => {
    // Run 10..14 (count 4 => 8 bytes). a@10(1), b@11(2), c@13(1)
    const run = {
        start: 10,
        count: 4,
        registers: [
            { key: 'a', registryId: 10, count: 1 },
            { key: 'b', registryId: 11, count: 2 },
            { key: 'c', registryId: 13, count: 1 }
        ]
    };
    const runBuffer = Buffer.alloc(8);
    runBuffer.writeUInt16BE(0x1111, 0); // a  (offset 0)
    runBuffer.writeUInt32BE(0x22223333, 2); // b (offset 2, 4 bytes)
    runBuffer.writeUInt16BE(0x4444, 6); // c (offset 6)

    const slices = deviceType.sliceRunBuffer(runBuffer, run);
    assert.deepEqual([...slices.a], [0x11, 0x11]);
    assert.deepEqual([...slices.b], [0x22, 0x22, 0x33, 0x33]);
    assert.deepEqual([...slices.c], [0x44, 0x44]);

    // And the slices feed decodeValues just like individual reads would.
    const reg = Object.freeze({
        a: new ModbusRegistry(setting.READING, 10, 1, type.uint16_1, 'a'),
        b: new ModbusRegistry(setting.READING, 11, 2, type.uint32_1, 'b'),
        c: new ModbusRegistry(setting.READING, 13, 1, type.uint16_1, 'c')
    });
    assert.deepEqual(deviceType.decodeValues(reg, slices), {
        a: 0x1111,
        b: 0x22223333,
        c: 0x4444
    });
});
