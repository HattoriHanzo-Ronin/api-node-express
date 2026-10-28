import ZodUtils from "../utils/zod-utils.js";
import DevicesSchema from "../schemas/devices-schema.js";
import idSchema from "../schemas/common/id-schema.js";
import { routerCpanelNavigationSchema, routerCpanelSessionSchema } from "../schemas/router-cpanel-schema.js";

const { validateData } = ZodUtils;
const { getValidatedSchema, getPartialSchema } = DevicesSchema;

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
        const { version, data } = await this.devicesFacade.getAll();
        res.set("Data-Version", version).json(data);
    };

    getById = async (req, res) => {
        const { id } = validateData(req.params, idSchema);
        res.json(await this.devicesFacade.getById({ id }));
    };

    getAllowedDevices = async (req, res) => {
        const routerId = this.#validateRouterId(req);
        const { version: { devices, whitelist }, data } = await this.devicesFacade.getAllowedDevices({ routerId });
        res.set({ "Devices-Version": devices, "Whitelist-Version": whitelist }).json(data);
    };

    getNotAllowedDevices = async (req, res) => {
        const routerId = this.#validateRouterId(req);
        const { version: { devices, whitelist }, data } = await this.devicesFacade.getNotAllowedDevices({ routerId });
        res.set({ "Devices-Version": devices, "Whitelist-Version": whitelist }).json(data);
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

    createRouterCpanel = async (req, res) => {
        const { params, body, user: authUser } = req;
        const { id: routerId } = validateData({ id: params.routerId }, idSchema);
        const { language, clientType, theme } = validateData(body, routerCpanelSessionSchema);
        res.status(201).json(await this.devicesFacade.createRouterCpanel({ authUser, routerId, language, clientType, theme }));
    };

    navigateRouterCpanel = async (req, res) => {
        const { params, body, user: authUser } = req;
        const { id: sessionId } = validateData({ id: params.sessionId }, idSchema);
        const { action } = validateData(body, routerCpanelNavigationSchema);
        await this.devicesFacade.navigateRouterCpanel({ authUser, sessionId, action });
        res.status(204).send();
    };

    closeRouterCpanel = async (req, res) => {
        const { params, user: authUser } = req;
        const { id: sessionId } = validateData({ id: params.sessionId }, idSchema);
        await this.devicesFacade.closeRouterCpanel({ authUser, sessionId });
        res.status(204).send();
    };

    #validateRouterId({ params }) {
        const { id: routerId } = validateData(params, idSchema);
        return routerId;
    }
}
