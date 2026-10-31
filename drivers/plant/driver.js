'use strict';

const BaseDriver = require('../baseDriver.js');
const { PlantRegistry } = require('../../lib/modbus/registry/plant.js');

class PlantDriver extends BaseDriver {

    async onInit() {
        this._registerFlows();
    }

    _registerFlows() {
        this.log('Registering flows');

        // Action: Cap the battery's discharging power (0 = no discharging)
        this.homey.flow.getActionCard('set_ess_max_discharge_power')
            .registerRunListener(async (args) => {
                return await args.device.setEssMaxDischargePower(args.power);
            });

        // Action: Cap the battery's charging power (0 = no charging)
        this.homey.flow.getActionCard('set_ess_max_charge_power')
            .registerRunListener(async (args) => {
                return await args.device.setEssMaxChargePower(args.power);
            });

        // Action: Restore unrestricted discharging
        this.homey.flow.getActionCard('remove_ess_discharge_limit')
            .registerRunListener(async (args) => {
                return await args.device.removeEssDischargeLimit();
            });

        // Action: Restore unrestricted charging
        this.homey.flow.getActionCard('remove_ess_charge_limit')
            .registerRunListener(async (args) => {
                return await args.device.removeEssChargeLimit();
            });

        // Action: Hand battery control to Homey, or back to mySigen
        this.homey.flow.getActionCard('set_remote_ems')
            .registerRunListener(async (args) => {
                return await args.device.setRemoteEms(args.state === 'on');
            });

        // Action: Pick what the plant does while under remote EMS
        this.homey.flow.getActionCard('set_remote_ems_control_mode')
            .registerRunListener(async (args) => {
                return await args.device.setRemoteEmsControlMode(args.mode);
            });

        // Action: Stop the battery discharging without leaving AI mode
        this.homey.flow.getActionCard('hold_battery_level')
            .registerRunListener(async (args) => {
                return await args.device.holdBatteryLevel();
            });

        // Action: Undo hold_battery_level
        this.homey.flow.getActionCard('release_battery_hold')
            .registerRunListener(async (args) => {
                return await args.device.releaseBatteryHold();
            });

        // Action: Charge the battery from the grid at a given rate
        this.homey.flow.getActionCard('force_charge_from_grid')
            .registerRunListener(async (args) => {
                return await args.device.forceChargeFromGrid(args.power);
            });
    }

    async onPair(session) {
        return await super.pair(PlantRegistry.gridPower, 'Plant', session, true);
    }
}
module.exports = PlantDriver;
