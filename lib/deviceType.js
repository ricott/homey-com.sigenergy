'use strict';

const { setting } = require('./modbus/modbusRegistry.js');

/**
 * Collect the registries of a given setting type (INFO/READING/SYSTEM),
 * carrying the property `key` so that reads and decodes can be paired by name
 * instead of by fragile array position.
 *
 * @param {object} modbusSettings - a registry object (e.g. BatteryRegistry)
 * @param {string} settingType - one of setting.INFO | setting.READING | setting.SYSTEM
 * @returns {Array<{key: string, comment: string, registryId: number, count: number}>}
 */
function getRegistriesByType(modbusSettings, settingType) {
    const arr = [];
    for (const [key, registry] of Object.entries(modbusSettings)) {
        if (registry != null && registry.setting === settingType) {
            arr.push({
                key,
                comment: registry.comment,
                registryId: registry.registryId,
                count: registry.count
            });
        }
    }
    return arr;
}

/**
 * Decode a map of { registryKey: Buffer|null } into { registryKey: value }.
 *
 * The buffer map is already scoped to a single setting type — it was produced
 * by reading exactly the registries returned from getRegistriesByType — so
 * decoding is a direct per-key lookup with no positional/index pairing.
 * Registers that failed to read (null buffer) or that are not known in
 * modbusSettings are skipped.
 *
 * @param {object} modbusSettings - a registry object (e.g. BatteryRegistry)
 * @param {Object<string, (Buffer|null)>} bufferMap
 * @returns {Object<string, (number|string)>}
 */
function decodeValues(modbusSettings, bufferMap) {
    const resultList = {};
    for (const [key, buffer] of Object.entries(bufferMap || {})) {
        const registry = modbusSettings[key];
        if (registry != null && buffer != null) {
            resultList[key] = registry.readData(buffer);
        }
    }
    return resultList;
}

/**
 * Group registries into contiguous "runs" that can each be fetched with a
 * single readHoldingRegisters call, then sliced apart afterwards.
 *
 * Registries are sorted by address and merged into a run while:
 *   - the gap to the previous register's end is <= maxGap (bridges small holes
 *     of reserved/unmapped registers), and
 *   - the resulting span stays <= maxRun (Modbus caps a read at 125 registers).
 *
 * Each run is { start, count, registers: [...] } where count spans from the
 * first register's address to the last register's end (holes included).
 *
 * @param {Array<{key,comment,registryId,count}>} registries
 * @param {{maxGap?: number, maxRun?: number}} [options]
 * @returns {Array<{start: number, count: number, registers: Array}>}
 */
function groupRegistersIntoRuns(registries, { maxGap = 8, maxRun = 120 } = {}) {
    const sorted = [...registries].sort((a, b) => a.registryId - b.registryId);

    const runs = [];
    let current = null;

    for (const reg of sorted) {
        const regEnd = reg.registryId + reg.count; // exclusive end address

        if (current) {
            const gap = reg.registryId - current.end; // reserved registers between
            const span = regEnd - current.start;
            if (gap <= maxGap && span <= maxRun) {
                current.registers.push(reg);
                current.end = Math.max(current.end, regEnd);
                continue;
            }
        }

        current = { start: reg.registryId, end: regEnd, registers: [reg] };
        runs.push(current);
    }

    return runs.map(run => ({
        start: run.start,
        count: run.end - run.start,
        registers: run.registers
    }));
}

/**
 * Slice a single run's response buffer into a { registryKey: Buffer } map by
 * byte offset. Each register's slice starts at (registryId - run.start) * 2
 * bytes and is (count * 2) bytes long (Modbus registers are 16-bit words).
 *
 * @param {Buffer} runBuffer - the buffer returned for the whole run
 * @param {{start: number, registers: Array}} run
 * @returns {Object<string, Buffer>}
 */
function sliceRunBuffer(runBuffer, run) {
    const slices = {};
    for (const reg of run.registers) {
        const byteOffset = (reg.registryId - run.start) * 2;
        slices[reg.key] = runBuffer.subarray(byteOffset, byteOffset + reg.count * 2);
    }
    return slices;
}

exports.getSystemRegistries = function (modbusSettings) {
    return getRegistriesByType(modbusSettings, setting.SYSTEM);
}

exports.getReadingRegistries = function (modbusSettings) {
    return getRegistriesByType(modbusSettings, setting.READING);
}

exports.getInfoRegistries = function (modbusSettings) {
    return getRegistriesByType(modbusSettings, setting.INFO);
}

exports.decodeValues = decodeValues;

exports.groupRegistersIntoRuns = groupRegistersIntoRuns;

exports.sliceRunBuffer = sliceRunBuffer;
