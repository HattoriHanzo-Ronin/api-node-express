import z from "zod";
import crypto from "node:crypto";
import Response from "../../utils/response-utils.js";
import Validate from "../../utils/validate-utils.js";
import MacFilterUtils from "../../utils/mac-filter-utils.js";

const devSche = () => {
    const err = {
        req: { invalid_type_error: "Error de formato", required_error: "Requerido" },
        notReq: { invalid_type_error: "Error de formato" }
    };
    return z.object({
        id: z.uuid().default(crypto.randomUUID()),
        name: z.string(err.req).regex(/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]+$/),
        mac: z.string(err.req).regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
        intrface: z
            .string(err.req)
            .regex(/^[A-Za-z]+$/)
            .max(4),
        type: z
            .string(err.notReq)
            .regex(/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]+$/)
            .default(""),
        ip: z
            .string(err.notReq)
            .regex(/^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/)
            .default("")
    });
};

/**
 * Controller for Devices
 *
 * @author HattoriHanzo-Ronin
 */
export class DeviceController {
    constructor({ devModel }) {
        this.devModel = devModel;
    }

    getAll = async (req, res) => {
        const resp = new Response({ res });
        try {
            const { intrface, allow, notAllow } = req.query;
            const model = await this.devModel.getAll({ intrface, allow, notAllow });

            if (model) return res.json(model);

            resp.notFound();
        } catch {
            resp.notFound(500, "Error inesperado");
        }
    };
    getId = async (req, res) => {
        const resp = new Response({ res });
        try {
            const { id } = req.params,
                model = await this.devModel.getId({ id });

            if (model) return res.json(model);

            resp.notFound();
        } catch {
            resp.notFound(500, "Error inesperado");
        }
    };

    create = async (req, res) => {
        const resp = new Response({ res });
        try {
            const validate = new Validate({ input: req.body }).validateData(devSche());

            if (validate.error) return resp.notFound(400);

            const model = await this.devModel.create({ input: validate.data });

            if (model) return resp.found();

            resp.notFound(400);
        } catch {
            resp.notFound(500, "Error inesperado");
        }
    };

    addAllow = async (req, res) => {
        const resp = new Response({ res });
        try {
            const validate = new Validate({ input: req.body }).validateData(devSche());

            if (validate.error) return resp.notFound(400);

            const { id } = req.params;
            const devId = await this.devModel.getId({ id });
            const allowDev = await this.devModel.getId({ id: validate.data.id });

            if (devId && allowDev) {
                let key = `archer${crypto.randomBytes(6).toString("hex")}`;
                let addAllowOnRout = true;

                if (devId.name === "RepPasillo") {
                    const { pass } = await this.devModel.getAll({ passw: true });
                    const rout = new MacFilterUtils({ dev: devId, passw: pass });
                    key = `white_list_${await rout.getKey(await this.devModel.getAll({ whitelist: devId.id }))}`;

                    addAllowOnRout = await rout.addAllow({ input: { key: key, dev: req.body } });
                }

                if (addAllowOnRout) {
                    const addAllowOnDb = await this.devModel.addAllow({
                        input: { device_id: devId.id, allow_device_id: allowDev.id, key: key }
                    });

                    if (addAllowOnDb) return resp.found();
                }
            }
            return resp.notFound(400);
        } catch {
            resp.notFound(500, "Error inesperado");
        }
    };

    delAllow = async (req, res) => {
        const resp = new Response({ res });
        try {
            const { id, allowId } = req.params;
            const { key } = await this.devModel.getAll({ whitelist: id, white: allowId });

            if (key) {
                let delAllowOnRout = true;

                if (!key.includes("archer")) {
                    const { pass } = await this.devModel.getAll({ passw: true });
                    const devId = await this.devModel.getId({ id });
                    delAllowOnRout = await new MacFilterUtils({ dev: devId, passw: pass }).delAllow(key);
                }

                if (delAllowOnRout) {
                    const delAllowOnDb = await this.devModel.delAllow({ id, allowId });

                    if (delAllowOnDb) return resp.found();
                }
            }
            return resp.notFound(400);
        } catch {
            resp.notFound(500, "Error inesperado");
        }
    };

    update = async (req, res) => {
        const resp = new Response({ res });
        try {
            const { id } = req.params;
            const validate = new Validate({ input: { id: id, ...req.body } }).validateData(devSche(), "partial");

            if (validate.error) return resp.notFound(400);

            const model = await this.devModel.update({ id, input: validate.data });
            const isAllow = await this.devModel.getAll({ white: id });

            if (model && isAllow) {
                let upAllow = true;

                for (const it of isAllow) {
                    const { device_id, key } = it;
                    const rout = await this.devModel.getId({ id: device_id });

                    if (!key.includes("archer")) {
                        const { pass } = await this.devModel.getAll({ passw: true });

                        upAllow = await new MacFilterUtils({ dev: rout, passw: pass }).updateAllow({
                            input: { key: key, dev: validate.data }
                        });
                    }
                }

                if (upAllow) return resp.found();
            }

            if (model) return resp.found();

            return resp.notFound(400);
        } catch {
            resp.notFound(500, "Error inesperado");
        }
    };

    del = async (req, res) => {
        const resp = new Response({ res });
        try {
            const { id } = req.params;
            const isAllow = await this.devModel.getAll({ white: id });
            const model = await this.devModel.del({ id });

            if (model && isAllow.length > 0) {
                let delAllow = false;

                for (const it of isAllow) {
                    const { device_id, key } = it;
                    const rout = await this.devModel.getId({ id: device_id });

                    if (!key.includes("archer")) {
                        const { pass } = await this.devModel.getAll({ passw: true });

                        delAllow = await new MacFilterUtils({ dev: rout, passw: pass }).delAllow(key);
                    }
                }

                if (delAllow) return resp.found();
            }

            if (model) return resp.found();

            resp.notFound(400);
        } catch {
            resp.notFound(500, "Error inesperado");
        }
    };
}
