'use strict';

const modbus = require('jsmodbus');
const net = require('net');
const { getModbusExceptionMessage, formatSocketError, getRegisterBuffer } = require('./utils.js');

// Socket-level and per-request timeout used during pairing/discovery.
const DISCOVERY_TIMEOUT_MS = 5000;

class Discovery {
    #socket;

    validateUnitId(address, port, unitId, registry) {
        return new Promise((resolve, reject) => {
            if (unitId == 0) {
                resolve({ outcome: 'connect_failure', returnValue: null, reason: `UnitID 0 isn't supported, use 100 instead` });
                return;
            } else if (unitId < 1 || unitId > 255) {
                resolve({ outcome: 'connect_failure', returnValue: null, reason: 'UnitID must be between 1 and 255' });
                return;
            }

            const socket = new net.Socket();
            // Set socket-level timeout
            socket.setTimeout(DISCOVERY_TIMEOUT_MS);
            this.#socket = socket;
            const client = new modbus.client.TCP(socket, unitId, DISCOVERY_TIMEOUT_MS);
            let returnValue = null;

            socket.on('connect', async () => {
                console.log(`IP '${address}' and port ${port} validated successfully`);

                // Validate UnitID using passed modbus registry
                try {
                    const result = await client.readHoldingRegisters(registry.registryId, registry.count);
                    returnValue = registry.readData(getRegisterBuffer(result));
                    this.#disconnect();
                    resolve({ outcome: 'success', returnValue: returnValue, reason: null });
                } catch (error) {
                    this.#disconnect();
                    // Prefer the public getters, fall back to the private fields.
                    const body = error?.response?.body ?? error?.response?._body;
                    const code = body?.code ?? body?._code;
                    const reason = code !== undefined
                        ? getModbusExceptionMessage(code)
                        : (error.message || 'Unknown error occurred during Modbus communication');
                    resolve({ outcome: 'connect_failure', returnValue: null, reason });
                }
            });

            socket.on('error', error => {
                console.log(`Error: ${error}`);
                this.#disconnect();
                resolve({ outcome: 'connect_failure', returnValue: null, reason: formatSocketError(error, address, port) });
            });

            socket.on('close', function () {
                console.log(`Client closed for IP '${address}'`);
            });

            socket.on('timeout', () => {
                this.#disconnect();
                resolve({ outcome: 'connect_failure', returnValue: null, reason: `Connection timeout to ${address}:${port} after ${DISCOVERY_TIMEOUT_MS / 1000} seconds` });
            });

            socket.connect({
                host: address,
                port: port,
                timeout: DISCOVERY_TIMEOUT_MS
            });
        });
    }

    #disconnect() {
        if (this.#socket) {
            try {
                this.#socket.destroy();
            } catch (ignore) { }
            this.#socket = null;
        }
    }
}
module.exports = Discovery;
