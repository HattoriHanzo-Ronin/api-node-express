import type DevicesService from "../devices-service.js";
import type { DevicesServiceDependencies } from "../../types/devices/default-devices-service.js";
import type { AllowedDeviceIdParams, DeviceId, InsertDeviceParams, RouterIdParams, UpdateDeviceParams } from "../../types/devices/devices-model.js";
import type { PostgresError } from "../../types/utils/postgres-error.js";
import type { GetAllDevicesParams } from "../../types/devices/devices-service.js";
import DevicesSchema from "../../schemas/devices-schema.js";
import ApiError from "../../utils/error/api-error.js";
import ValidateUtils from "../../utils/validate-utils.js";
import ZodUtils from "../../utils/zod-utils.js";
import { API_ERROR } from "../../config/errors.js";

const { deviceNotFound, deviceEmptyUpdate } = API_ERROR;
const { validateNotEmptyObject } = ValidateUtils;
const { validateData } = ZodUtils;

/**
 * Default devices service
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultDevicesService<Transaction> implements DevicesService<Transaction> {
    constructor(private readonly dependencies: DevicesServiceDependencies<Transaction>) {}

    async getAll({}: GetAllDevicesParams = {}) {
        return this.dependencies.devicesModel.getAll();
    }

    async getById({ id }: DeviceId) {
        const result = await this.dependencies.devicesModel.getById({ id });
        ApiError.handle([
            {
                condition: !result,
                message: "El dispositivo no existe",
                status: 404,
                apiError: deviceNotFound
            }
        ]);
        return result!;
    }

    async getAllowedDevices({ routerId }: RouterIdParams) {
        return this.dependencies.devicesModel.getAllowedDevices({ routerId });
    }

    async getNotAllowedDevices({ routerId }: RouterIdParams) {
        return this.dependencies.devicesModel.getNotAllowedDevices({ routerId });
    }

    async getRoutersByAllowedDevice({ allowedDeviceId }: AllowedDeviceIdParams) {
        return this.dependencies.devicesModel.getRoutersByAllowedDevice({ allowedDeviceId });
    }

    async create({ clientTx, device }: InsertDeviceParams<Transaction>) {
        try {
            return await this.dependencies.devicesModel.insert({ clientTx, device });
        } catch (err) {
            this.dependencies.entityError(err as PostgresError);
            throw err;
        }
    }

    async update({ clientTx, id, data }: UpdateDeviceParams<Transaction>) {
        try {
            validateNotEmptyObject(data, deviceEmptyUpdate);
            const result = await this.dependencies.devicesModel.update({ clientTx, id, data });
            return validateData(result, DevicesSchema.getDeviceSchema());
        } catch (err) {
            this.dependencies.entityError(err as PostgresError);
            throw err;
        }
    }

    async delete({ id }: DeviceId) {
        return this.dependencies.devicesModel.delete({ id });
    }
}
