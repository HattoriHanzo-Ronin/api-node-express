import ValidateUtils from "../utils/validate-utils.js";
import DevicesSchema from "../schemas/devices-schema.js";
import idSchema from "../schemas/id-schema.js";

/**
 * Devices controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesController {
    constructor({ devicesFacade }) {
        this.devicesFacade = devicesFacade;
    }

    getAll = async (req, res) => {
        const result = await this.devicesFacade.getAll();
        res.json(result);
    };

    getById = async (req, res) => {
        const { id } = validateData(req.params, idSchema);
        res.json(await this.devicesFacade.getById({ id }));
    };

    getAllowedDevices = async (req, res) => {
        const routerId = validateRouterId(req);
        res.json(await this.devicesFacade.getAllowedDevices({ routerId }));
    };

    getNotAllowedDevices = async (req, res) => {
        const routerId = validateRouterId(req);
        res.json(await this.devicesFacade.getNotAllowedDevices({ routerId }));
    };

    create = async (req, res) => {
        const device = validateData(req.body, getValidatedSchema());
        res.status(201).json(await this.devicesFacade.create({ device }));
    };

    update = async (req, res) => {
        const data = validateData(req.body, getPartialSchema());
        res.json(await this.devicesFacade.update({ data }));
    };

    delete = async (req, res) => {
        const { id } = validateData(req.params, idSchema);
        res.json(await this.devicesFacade.delete({ id }));
    };
}

function validateRouterId({ params }) {
    const { id: routerId } = validateData(params, idSchema);
    return routerId;
}

const { validateData } = ValidateUtils;
const { getValidatedSchema, getPartialSchema } = DevicesSchema;
