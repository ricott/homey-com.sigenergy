'use strict';

const Plant = require('../../lib/devices/plant.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

class PlantDevice extends BaseDevice {

    async onInit() {
        await this.upgradeDevice();
        await super.onInit();
    }

    async upgradeDevice() {
        this.logMessage('Upgrading existing device');

    }

    async setupSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new Plant({
            host: host,
            port: port,
            modbus_unitId: modbus_unitId,
            refreshInterval: refreshInterval,
            device: this
        });

        await this.api.initialize();
        await this._initializeEventListeners();
    }

    async _initializeEventListeners() {
        this.api.on('readings', this._handleReadingsEvent.bind(this));
        this.api.on('error', this._handleErrorEvent.bind(this));
    }

    async _handleReadingsEvent(message) {
        try {
            await this._updatePlantProperties(message);
        } catch (error) {
            this.error('Failed to process inverter readings event:', error);
        }
    }

    async _updatePlantProperties(message) {

        const evChargerPower = await this.calculateEVChargerPower();

        await Promise.all([
            this._updateProperty('measure_power.grid', message.gridPower),
            this._updateProperty('measure_power.battery', message.batteryPower),
            this._updateProperty('measure_power.solar', message.solarPower),
            this._updateProperty('measure_power.load', message.generalLoadPower),
            this._updateProperty('measure_power.evcharger', evChargerPower),
            this._updateProperty('measure_battery', message.batterySoc),
            this.setStoreValue('grid_status', enums.decodeGridStatus(message.gridStatus)),
        ]);

        await this.sendLiveViewData();
    }

    async sendLiveViewData() {
        this.homey.api.realtime('liveview.data.update', await this.getLiveViewData());
    }

    async getLiveViewData() {
        return {
            grid: {
                power: this.getCapabilityValue('measure_power.grid') / 1000,
                status: this.getStoreValue('grid_status')
            },
            solar: {
                power: this.getCapabilityValue('measure_power.solar') / 1000
            },
            home: {
                power: this.getCapabilityValue('measure_power.load') / 1000
            },
            evcharger: {
                power: this.getCapabilityValue('measure_power.evcharger') / 1000
            },
            battery: {
                power: this.getCapabilityValue('measure_power.battery') / 1000,
                soc: this.getCapabilityValue('measure_battery')
            }
        }
    }

    async calculateEVChargerPower() {
        let power = 0;

        const dcchargerDevices = this.homey.drivers.getDriver('evdccharger').getDevices();
        for (const charger of dcchargerDevices) {
            power = power + charger.getCapabilityValue('measure_power');
        }

        const acchargerDevices = this.homey.drivers.getDriver('evaccharger').getDevices();
        for (const charger of acchargerDevices) {
            power = power + charger.getCapabilityValue('measure_power');
        }

        return power;
    }
}
module.exports = PlantDevice;
