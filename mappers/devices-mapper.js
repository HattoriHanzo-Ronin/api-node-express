import RouterResolver from "../devices-routers/router-resolver.js";

/**
 * Maps device data between persistence and domain representations
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesMapper {
    /**
     * Maps a persistence device to the domain model
     *
     * @param {Object} source Persistence device
     * @returns {Object} Domain device
     */
    static deviceToDomain(source) {
        const device = Object.fromEntries(Object.entries(source).filter(([, it]) => it !== null));
        if (device.mac_filter) {
            const routerImpl = new RouterResolver(device);
            return { ...device, capabilities: routerImpl.getCapabilities() };
        }

        return device;
    }

    /**
     * Maps persistence devices to the domain model
     *
     * @param {Object[]} source Persistence devices
     * @returns {Object[]} Domain devices
     */
    static devicesToDomain(source) {
        return source.map((it) => this.deviceToDomain(it));
    }
}
