import DevicesSchema from "../schemas/devices-schema.js";
import PostgresErrors from "../utils/postgres-errors.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * Devices service
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesService {
    constructor({ devicesModel }) {
        this.devicesModel = devicesModel;
    }

    /**
     * Retrieves all devices
     *
     * @returns {Promise<Object[]>} List of devices
     */
    async getAll() {
        return this.devicesModel.getAll();
    }

    /**
     * Retrieves a device by identifier
     *
     * @param {string} params.id Device identifier
     * @returns {Promise<Object>} Device
     */
    async getById({ id }) {
        const result = await this.devicesModel.getById({ id });
        handleApiErrors([
            { condition: !result, message: "El dispositivo no existe", status: 404, code: "DEVICE_NOT_FOUND" }
        ]);
        return result;
    }

    /**
     * Retrieves allowed devices for a router
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<Object[]>} List of allowed devices
     */
    async getAllowedDevices({ routerId }) {
        return this.devicesModel.getAllowedDevices({ routerId });
    }

    /**
     * Retrieves devices not allowed on a router
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<Object[]>} List of devices not allowed on the router
     */
    async getNotAllowedDevices({ routerId }) {
        return this.devicesModel.getNotAllowedDevices({ routerId });
    }

    /**
     * Retrieves routers associated with an allowed device
     *
     * @param {string} params.allowedDeviceId Allowed device identifier
     * @returns {Promise<Object[]>} Routers associated with the allowed device
     */
    async getRoutersByAllowedDevice({ allowedDeviceId }) {
        return this.devicesModel.getRoutersByAllowedDevice({ allowedDeviceId });
    }

    /**
     * Creates a device
     *
     * @param {Object} params.device Device data
     * @returns {Promise<Object>} Created device
     */
    async create({ device }) {
        try {
            return await this.devicesModel.insert({ device });
        } catch (err) {
            postgresError(err);
            throw err;
        }
    }

    /**
     * Updates a device
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {string} params.id Device identifier
     * @param {Object} params.data Device data
     * @returns {Promise<Object>} Updated device
     */
    async update({ clientTx, id, data }) {
        try {
            const result = await this.devicesModel.update({ clientTx, id, data });
            validateData(result, DevicesSchema.getValidatedSchema());
            return result;
        } catch (err) {
            postgresError(err);
            throw err;
        }
    }

    /**
     * Deletes a device
     *
     * @param {string} params.id Device identifier
     * @returns {Promise<{ id: string }>} Deleted device identifier
     */
    async delete({ id }) {
        return this.devicesModel.delete({ id });
    }
}

const { handleApiErrors, validateData } = ValidateUtils;
const { devices: postgresError } = PostgresErrors;
