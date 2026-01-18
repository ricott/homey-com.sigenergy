'use strict';

const EVACCharger = require('../../lib/devices/evACCharger.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

class EvACChargerDevice extends BaseDevice {

    async onInit() {
        await this.upgradeDevice();
        await this.setupCapabilityListeners();
        await super.onInit();
    }

    async upgradeDevice() {
        this.logMessage('Upgrading existing device');
    }

    async setupSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new EVACCharger({
            host: host,
            port: port,
            modbus_unitId: modbus_unitId,
            refreshInterval: refreshInterval,
            device: this
        });

        await this.api.initialize();
        await this._initializeEventListeners();
    }

    async setupCapabilityListeners() {
        this.registerCapabilityListener('evcharger_charging', async (value) => {
            if (value) {
                // Start
                await this.api.startCharging()
                    .catch(reason => {
                        this.error('Failed to start charging!', reason);
                        throw new Error(`Failed to start charging! ${reason.message}`);
                    });

            } else {
                // Stop
                await this.api.stopCharging()
                    .catch(reason => {
                        this.error('Failed to stop charging!', reason);
                        throw new Error(`Failed to stop charging! ${reason.message}`);
                    });
            }
        });
    }

    async _initializeEventListeners() {
        //this.api.on('properties', this._handlePropertiesEvent.bind(this));
        this.api.on('readings', this._handleReadingsEvent.bind(this));
        this.api.on('error', this._handleErrorEvent.bind(this));
    }

    // async _handlePropertiesEvent(message) {
    //     try {
    //         await this.setSettings({
    //             serial: String(message.serial)
    //         });
    //     } catch (error) {
    //         this.error('Failed to update EV DC charger properties settings:', error);
    //     }
    // }

    async _handleReadingsEvent(message) {
        try {
            await this._updateEvChargerProperties(message);
        } catch (error) {
            this.error('Failed to process EV DC charger readings event:', error);
        }
    }

    async _updateEvChargerProperties(message) {
        const isCharging = message.power > 0;
        const chargingState = enums.mapACChargerStatusToChargingState(message.status, message.power);

        await Promise.all([
            // EV charger specific capabilities
            this._updateProperty('evcharger_charging', isCharging),
            this._updateProperty('evcharger_charging_state', chargingState),

            // Standard measurements
            this._updateProperty('measure_power', message.power),
            this._updateProperty('meter_power.charged', message.totalChargeEnergy)
        ]);
    }
}
module.exports = EvACChargerDevice;
