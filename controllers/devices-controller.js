import ValidateUtils from "../utils/validate-utils.js";
import DevicesSchema from "../schemas/devices-schema.js";
import idSchema from "../schemas/id-schema.js";

/**
 * Devices controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesController {
    constructor({ devicesService }) {
        this.devicesService = devicesService;
    }

    getAll = async (req, res, next) => {
        const result = await this.devicesService.getAll();
        res.json(result);
    };

    getById = async (req, res, next) => {
        const { id } = req.params;
        validateData({ id }, idSchema);
        const result = await this.devicesService.getById({ id });
        res.json(result);
    };

    getAllowDevices = async (req, res, next) => {
        const { routerId } = req.params;
        validateData({ id: routerId }, idSchema);
        const result = await this.devicesService.getAllowedDevices({ routerId });
        res.json(result);
    };

    getNotAllowDevices = async (req, res, next) => {
        const { routerId } = req.params;
        validateData({ id: routerId }, idSchema);
        const result = await this.devicesService.getNotAllowedDevices({ routerId });
        res.json(result);
    };

    create = async (req, res, next) => {
        const device = validateData(req.body, getCreateSchema());
        const result = await this.devicesService.create({ device });
        res.json(result);
    };

    update = async (req, res, next) => {
        const data = validateData(req.body, getUpdateSchema());
        const result = await this.devicesService.update({ data });
        res.json(result);
    };

    delete = async (req, res, next) => {
        const { id } = req.params;
        validateData({ id }, idSchema);
        const result = await this.devicesService.delete({ id });
        res.json(result);
    };
}

const { validateData } = ValidateUtils;
const { getCreateSchema, getUpdateSchema } = DevicesSchema;
