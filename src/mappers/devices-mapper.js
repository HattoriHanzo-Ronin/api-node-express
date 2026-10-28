/**
 * Maps device data between persistence and domain representations
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesMapper {
    constructor({ routerAutomation }) {
        this.routerAutomation = routerAutomation;
    }

    /**
     * Creates a device source from persistence source
     *
     * @param {Object[]} source Persistence source
     * @returns {{ devices: Object[], connections: Object[] }} Devices source
     */
    createDeviceSource(source) {
        const connections = [];
        const deviceIds = new Set();
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

    /**
     * Maps persistence router rows to automation sources
     *
     * @param {Object[]} source Persistence router rows
     * @returns {Object[]} Router automation sources
     */
    routersToAutomation(source) {
        const routers = new Map();
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

    /**
     * Maps a persistence device to the domain model
     *
     * @param {Object} params.source Persistence device
     * @param {Object[]} params.connections Domain device connections
     * @returns {Object} Domain device
     */
    deviceToDomain({ source, connections }) {
        const device = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== null));
        if (!device.mac_filter) {
            return { ...device, connections };
        }

        const routerImpl = new this.routerAutomation({ router: device });
        return { ...device, capabilities: routerImpl.getCapabilities(), connections };
    }

    /**
     * Maps persistence devices to the domain model
     *
     * @param {Object[]} params.devices Persistence devices
     * @param {Map<string, Object[]>} params.connectionsByDevice Domain connections by device identifier
     * @returns {Object[]} Domain devices
     */
    devicesToDomain({ devices, connectionsByDevice }) {
        return devices.map((device) =>
            this.deviceToDomain({ source: device, connections: connectionsByDevice.get(device.id) ?? [] })
        );
    }
}
