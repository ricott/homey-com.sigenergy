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
