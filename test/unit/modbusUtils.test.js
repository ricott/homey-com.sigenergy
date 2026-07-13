'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { getRegisterBuffer, getModbusExceptionMessage, formatSocketError } = require('../../lib/modbus/utils.js');

test('getRegisterBuffer reads the public jsmodbus getters', () => {
    const buf = Buffer.from([0x00, 0x2a]);
    const result = { response: { body: { valuesAsBuffer: buf } } };
    assert.equal(getRegisterBuffer(result), buf);
});

test('getRegisterBuffer falls back to the private fields', () => {
    const buf = Buffer.from([0x01, 0x02]);
    const result = { response: { _body: { _valuesAsBuffer: buf } } };
    assert.equal(getRegisterBuffer(result), buf);
});

test('getRegisterBuffer prefers the public getter when both exist', () => {
    const pub = Buffer.from([0xaa]);
    const priv = Buffer.from([0xbb]);
    const result = { response: { body: { valuesAsBuffer: pub }, _body: { _valuesAsBuffer: priv } } };
    assert.equal(getRegisterBuffer(result), pub);
});

test('getRegisterBuffer throws a clear error when no buffer is present', () => {
    assert.throws(() => getRegisterBuffer({}), /missing a response/);
    assert.throws(() => getRegisterBuffer({ response: {} }), /missing the register buffer/);
    assert.throws(() => getRegisterBuffer({ response: { body: {} } }), /missing the register buffer/);
});

test('getModbusExceptionMessage describes known codes and labels unknown ones', () => {
    assert.match(getModbusExceptionMessage(1), /Illegal Function/);
    assert.match(getModbusExceptionMessage(2), /Illegal Data Address/);
    assert.match(getModbusExceptionMessage(10), /Gateway Path Unavailable/);
    assert.equal(getModbusExceptionMessage(999), 'Unknown Exception Code: 999');
});

test('formatSocketError produces descriptive messages per error code', () => {
    assert.match(formatSocketError({ code: 'ECONNREFUSED' }, '1.2.3.4', 502), /Connection refused/);
    assert.match(formatSocketError({ code: 'EHOSTUNREACH' }, '1.2.3.4', 502), /Host unreachable/);
    assert.match(formatSocketError({ code: 'ETIMEDOUT' }, '1.2.3.4', 502), /timed out/);
    assert.match(formatSocketError({ message: 'weird' }, '1.2.3.4', 502), /weird/);
});
