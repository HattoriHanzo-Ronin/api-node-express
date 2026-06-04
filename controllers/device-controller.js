import ValidateUtils from "../utils/validate-utils.js";
import DeviceSchema from "../schemas/device-schema.js";

/**
 * Controller for Devices
 *
 * @author HattoriHanzo-Ronin
 */
export default class DeviceController {
    constructor({ deviceService }) {
        this.deviceService = deviceService;
    }

    getAll = async (req, res, next) => {
        const result = await this.deviceService.getAll();
        res.json(result);
    };

    getById = async (req, res, next) => {
        const { id } = req.params;
        validateData({ id }, getPartialDeviceSchemaWithId());
        const result = await this.deviceService.getById({ id });
        res.json(result);
    };

    getAllowDevices = async (req, res, next) => {
        const { routerId } = req.params;
        validateData({ id: routerId }, getPartialDeviceSchemaWithId());
        const result = await this.deviceService.getAllowedDevices({ routerId });
        res.json(result);
    };

    getNotAllowDevices = async (req, res, next) => {
        const { routerId } = req.params;
        validateData({ id: routerId }, getPartialDeviceSchemaWithId());
        const result = await this.deviceService.getNotAllowedDevices({ routerId });
        res.json(result);
    };

    create = async (req, res, next) => {
        const device = validateData(req.body, getDeviceSchema());
        const result = await this.deviceService.create({ device });
        res.json(result);
    };

    update = async (req, res, next) => {
        const data = validateData(req.body, getPartialDeviceSchemaWithId());
        const result = await this.deviceService.update({ data });
        res.json(result);
    };

    delete = async (req, res, next) => {
        const { id } = req.params;
        validateData({ id }, getPartialDeviceSchemaWithId());
        const result = await this.deviceService.delete({ id });
        res.json(result);
    };
}

const { validateData } = ValidateUtils;
const { getDeviceSchema, getPartialDeviceSchemaWithId } = DeviceSchema;
