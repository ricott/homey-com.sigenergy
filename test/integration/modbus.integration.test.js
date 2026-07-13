'use strict';

// Integration tests against a real Sigenergy device over Modbus TCP.
//
// These are NOT part of `npm test` (unit suite). Run explicitly with:
//   npm run test:integration
//
// They auto-skip when the target is unreachable, so they are safe to run
// anywhere. Configure the target with env vars (defaults shown):
//   SIGEN_HOST=192.168.200.66  SIGEN_PORT=502  SIGEN_UNIT=1  SIGEN_SYSTEM_UNIT=247
//
// Unit 1  = the device register space (inverter/battery/EV registers)
// Unit 247 = the Sigenergy "system"/plant register space

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const modbus = require('jsmodbus');

const dt = require('../../lib/deviceType.js');
const { getRegisterBuffer } = require('../../lib/modbus/utils.js');
const { InverterRegistry } = require('../../lib/modbus/registry/inverter.js');
const { BatteryRegistry } = require('../../lib/modbus/registry/battery.js');
const { EvDCChargerRegistry } = require('../../lib/modbus/registry/evDCCharger.js');
const Inverter = require('../../lib/devices/inverter.js');
const Battery = require('../../lib/devices/battery.js');
const EVDCCharger = require('../../lib/devices/evDCCharger.js');

// Device types whose READING registers get coalesced. Each is verified two
// ways: raw coalesced-vs-per-register equivalence, and end-to-end through the
// device class. `probe` is a representative READING register used to detect
// whether that device is actually present on the bus (so absent types skip
// instead of fail).
const COALESCED_DEVICES = [
    { name: 'inverter', registry: InverterRegistry, DeviceClass: Inverter, probe: InverterRegistry.power },
    { name: 'battery', registry: BatteryRegistry, DeviceClass: Battery, probe: BatteryRegistry.soc },
    { name: 'ev-dc-charger', registry: EvDCChargerRegistry, DeviceClass: EVDCCharger, probe: EvDCChargerRegistry.power }
];

const HOST = process.env.SIGEN_HOST || '192.168.200.66';
const PORT = Number(process.env.SIGEN_PORT || 502);
const UNIT = Number(process.env.SIGEN_UNIT || 1);
const SYSTEM_UNIT = Number(process.env.SIGEN_SYSTEM_UNIT || 247);
const TIMEOUT_MS = 5000;

function probe(host, port, timeout = 3000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        const done = (ok) => { socket.destroy(); resolve(ok); };
        socket.setTimeout(timeout);
        socket.once('error', () => done(false));
        socket.once('timeout', () => done(false));
        socket.connect(port, host, () => done(true));
    });
}

function openClient(unit) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(TIMEOUT_MS);
        const client = new modbus.client.TCP(socket, unit, TIMEOUT_MS);
        const onErr = (e) => reject(e);
        socket.once('error', onErr);
        socket.once('timeout', () => reject(new Error('connect timeout')));
        socket.connect({ host: HOST, port: PORT }, () => {
            socket.off('error', onErr);
            socket.on('error', () => { /* swallow post-connect socket errors */ });
            resolve({ socket, client });
        });
    });
}

async function readOne(client, registry) {
    const res = await client.readHoldingRegisters(registry.registryId, registry.count);
    return registry.readData(getRegisterBuffer(res));
}

// Whether a representative register can be read on `unit` — used to tell
// whether a device type is present on the bus.
async function isPresent(unit, registry) {
    const { socket, client } = await openClient(unit);
    try {
        await client.readHoldingRegisters(registry.registryId, registry.count);
        return true;
    } catch {
        return false;
    } finally {
        socket.destroy();
    }
}

describe('integration: Sigenergy Modbus', () => {
    let reachable = false;

    before(async () => {
        reachable = await probe(HOST, PORT);
        if (!reachable) {
            console.log(`[integration] ${HOST}:${PORT} not reachable — skipping integration tests`);
        }
    });

    it('accepts a TCP connection on the configured host/port', (t) => {
        if (!reachable) return t.skip('device not reachable');
        assert.ok(reachable);
    });

    it('validates unit 1 through the discovery/pairing path', async (t) => {
        if (!reachable) return t.skip('device not reachable');
        const Discovery = require('../../lib/modbus/discovery.js');
        const res = await new Discovery().validateUnitId(HOST, PORT, UNIT, InverterRegistry.serial);
        assert.equal(res.outcome, 'success', `discovery failed: ${res.reason || 'unknown'}`);
        assert.ok(typeof res.returnValue === 'string' && res.returnValue.length > 0, 'expected a non-empty serial');
        console.log(`[integration] discovery serial (unit ${UNIT}) = "${res.returnValue}"`);
    });

    it('reads the device serial on unit 1', async (t) => {
        if (!reachable) return t.skip('device not reachable');
        const { socket, client } = await openClient(UNIT);
        try {
            const serial = await readOne(client, InverterRegistry.serial);
            assert.ok(typeof serial === 'string' && serial.length > 0, `expected non-empty serial, got "${serial}"`);
            console.log(`[integration] unit ${UNIT} serial = "${serial}"`);
        } finally {
            socket.destroy();
        }
    });

    it('reads a system register on unit 247', async (t) => {
        if (!reachable) return t.skip('device not reachable');
        const { socket, client } = await openClient(SYSTEM_UNIT);
        try {
            // 30037 ESS/battery power lives in the system (247) register space.
            const power = await readOne(client, BatteryRegistry.power);
            assert.ok(Number.isFinite(power), `expected finite ESS power, got ${power}`);
            console.log(`[integration] unit ${SYSTEM_UNIT} ESS power = ${power} W`);
        } finally {
            socket.destroy();
        }
    });

    for (const device of COALESCED_DEVICES) {
        it(`${device.name}: coalesced range reads equal per-register reads (unit 1)`, async (t) => {
            if (!reachable) return t.skip('device not reachable');
            const regs = dt.getReadingRegistries(device.registry);
            const { socket, client } = await openClient(UNIT);
            try {
                // 1) Read each register individually.
                const individual = {};
                for (const r of regs) {
                    try {
                        const res = await client.readHoldingRegisters(r.registryId, r.count);
                        individual[r.key] = getRegisterBuffer(res);
                    } catch {
                        individual[r.key] = null;
                    }
                }
                const readableKeys = Object.keys(individual).filter(k => individual[k] != null);
                if (readableKeys.length === 0) {
                    return t.skip(`no ${device.name} registers readable on unit ${UNIT} (not present?)`);
                }

                // 2) Read the coalesced runs and slice them apart.
                const runs = dt.groupRegistersIntoRuns(regs, { maxGap: 8, maxRun: 120 });
                const coalesced = {};
                const rangeFailedRuns = [];
                for (const run of runs) {
                    try {
                        const res = await client.readHoldingRegisters(run.start, run.count);
                        Object.assign(coalesced, dt.sliceRunBuffer(getRegisterBuffer(res), run));
                    } catch {
                        rangeFailedRuns.push(`${run.start}+${run.count}`);
                    }
                }

                // 3) Decoded values must match for every register readable both ways.
                const decInd = dt.decodeValues(device.registry, individual);
                const decCoal = dt.decodeValues(device.registry, coalesced);
                let compared = 0;
                for (const k of readableKeys) {
                    if (k in decCoal) {
                        assert.deepEqual(decCoal[k], decInd[k], `coalesced value differs from per-register for "${k}"`);
                        compared++;
                    }
                }
                assert.ok(compared > 0, 'expected at least one register compared between the two paths');

                if (rangeFailedRuns.length) {
                    console.log(`[integration] NOTE: ${device.name} device rejected coalesced run(s): ${rangeFailedRuns.join(', ')} — base.js auto-falls back to per-register for these`);
                }
                console.log(`[integration] ${device.name} equivalence OK: ${compared} register(s) matched, ${rangeFailedRuns.length} run(s) needed fallback`);
            } finally {
                socket.destroy();
            }
        });

        it(`${device.name}: emits a readings event through the full stack (coalescing + slice + decode)`, async (t) => {
            if (!reachable) return t.skip('device not reachable');
            if (!(await isPresent(UNIT, device.probe))) {
                return t.skip(`${device.name} not present on unit ${UNIT}`);
            }

            const api = new device.DeviceClass({ host: HOST, port: PORT, modbus_unitId: UNIT, refreshInterval: 1, timeout: 5 });
            api.on('error', () => { /* surfaced via events; ignore here */ });

            try {
                const readings = await new Promise((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error('no readings event within 20s')), 20000);
                    api.on('readings', (message) => {
                        clearTimeout(timer);
                        resolve(message);
                    });
                    api.initialize().catch(() => { /* connection errors surface via events */ });
                });

                assert.equal(typeof readings, 'object');
                const numericCount = Object.values(readings).filter(v => Number.isFinite(v)).length;
                assert.ok(numericCount > 0, 'expected at least one numeric reading');
                console.log(`[integration] ${device.name} full-stack readings (${numericCount} numeric): ${Object.keys(readings).join(', ')}`);
            } finally {
                api.disconnect();
            }
        });
    }
});
