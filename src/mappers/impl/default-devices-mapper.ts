import type DevicesMapper from "../devices-mapper.js";
import type { DevicesMapperDependencies } from "../../types/default-devices-mapper.js";
import type { DeviceMapperParams, DevicesMapperParams, DeviceWithoutConnections, RouterAutomationSource } from "../../types/devices-mapper.js";
import type { AllowedDevice, RouterAllowedDevice } from "../../types/devices-model.js";
import type { Connection } from "../../types/connections-model.js";
import type { RouterAutomationPayload } from "../../types/router-automation.js";

/**
 * Default devices mapper
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultDevicesMapper implements DevicesMapper {
    private readonly routerAutomation: DevicesMapperDependencies["routerAutomation"];

    constructor({ routerAutomation }: DevicesMapperDependencies) {
        this.routerAutomation = routerAutomation;
    }

    createDeviceSource(source: AllowedDevice[]) {
        const connections: Connection[] = [];
        const deviceIds = new Set<string>();
        const devices = source
            .map(({ ctype, mac, ...device }) => {
                connections.push({ device_id: device.id, ctype, mac });
                return device;
            })
            .filter(({ id }) => {
                if (deviceIds.has(id)) {
                    return false;
                }

                deviceIds.add(id);
                return true;
            });
        return { devices, connections };
    }

    routersToAutomation(source: RouterAllowedDevice[]) {
        const routers = new Map<string, RouterAutomationSource>();
        for (const row of source) {
            const { ctype, mac, key, ...router } = row;
            let routerEntry = routers.get(router.id);
            if (!routerEntry) {
                routerEntry = { ...router, connections: [] };
                routers.set(router.id, routerEntry);
            }

            routerEntry.connections.push({ ctype, mac, key });
        }
        return [...routers.values()];
    }

    deviceToDomain({ source, connections }: DeviceMapperParams) {
        const device = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== null)) as DeviceWithoutConnections;
        if (!device.mac_filter) {
            return { ...device, connections };
        }

        const routerImpl = new this.routerAutomation({ router: device as RouterAutomationPayload });
        return { ...device, capabilities: routerImpl.getCapabilities(), connections };
    }

    devicesToDomain({ devices, connectionsByDevice }: DevicesMapperParams) {
        return devices.map((device) =>
            this.deviceToDomain({ source: device, connections: connectionsByDevice.get(device.id) ?? [] })
        );
    }
}
