import DevicesSchema from "../schemas/devices-schema.js";
import ApiError from "../utils/error/api-error.js";
import ValidateUtils from "../utils/validate-utils.js";
import ZodUtils from "../utils/zod-utils.js";
import { API_ERROR } from "../config/errors.js";

/**
 * Devices service
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesService {
    constructor({ devicesModel, entityError }) {
        this.devicesModel = devicesModel;
        this.entityError = entityError;
    }

    /**
     * Returns all devices
     *
     * @returns {Promise<Object[]>} Devices
     */
    async getAll() {
        return this.devicesModel.getAll();
    }

    /**
     * Returns a device by its identifier
     *
     * @param {string} params.id Device identifier
     * @returns {Promise<Object>} Device
     */
    async getById({ id }) {
        const result = await this.devicesModel.getById({ id });
        ApiError.handle([
            {
                condition: !result,
                message: "El dispositivo no existe",
                status: 404,
                apiError: deviceNotFound
            }
        ]);
        return result;
    }

    /**
     * Returns the devices allowed on a router
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<Object[]>} Device rows
     */
    async getAllowedDevices({ routerId }) {
        return this.devicesModel.getAllowedDevices({ routerId });
    }

    /**
     * Returns the devices not allowed on a router
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<Object[]>} Device rows
     */
    async getNotAllowedDevices({ routerId }) {
        return this.devicesModel.getNotAllowedDevices({ routerId });
    }

    /**
     * Returns the routers associated with an allowed device
     *
     * @param {string} params.allowedDeviceId Allowed device identifier
     * @returns {Promise<Object[]>} Associated routers
     */
    async getRoutersByAllowedDevice({ allowedDeviceId }) {
        return this.devicesModel.getRoutersByAllowedDevice({ allowedDeviceId });
    }

    /**
     * Creates a device
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {Object} params.device Device data
     * @returns {Promise<Object>} Created device
     */
    async create({ clientTx, device }) {
        try {
            return await this.devicesModel.insert({ clientTx, device });
        } catch (err) {
            this.entityError(err);
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
            validateNotEmptyObject(data, deviceEmptyUpdate);
            const result = await this.devicesModel.update({ clientTx, id, data });
            return validateData(result, DevicesSchema.getDeviceSchema());
        } catch (err) {
            this.entityError(err);
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

const { deviceNotFound, deviceEmptyUpdate } = API_ERROR;

const { validateNotEmptyObject } = ValidateUtils;
const { validateData } = ZodUtils;
