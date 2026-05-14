import z from "zod"
import crypto from "node:crypto"
import Response from "../../utils/ResponseUtils.js"
import Validate from "../../utils/ValidateUtils.js"
import AdminRepPasillo from "../../utils/AdminRouterUtils.js"


// el esquema que validará los datos
const devSche = () => {
    const err = { req: { invalid_type_error: "Error de formato", required_error: "Requerido" }, notReq: { invalid_type_error: "Error de formato" } }
    return z.object({
        id: z.uuid().default(crypto.randomUUID()),
        name: z.string(err.req).regex(/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]+$/),
        mac: z.string(err.req).regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
        intrface: z.string(err.req).regex(/^[A-Za-z]+$/).max(4),
        type: z.string(err.notReq).regex(/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]+$/).default(""),
        ip: z.string(err.notReq).regex(/^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/).default("")
    })
}

export class DeviceController {
    constructor({ devModel }) {
        this.devModel = devModel
    }

    getAll = async (req, res) => {
        const resp = new Response({ res })
        try {
            const { intrface, allow, notAllow } = req.query, model = await this.devModel.getAll({ intrface, allow, notAllow })

            if (model) return res.json(model)

            resp.notFound()
        } catch {
            resp.notFound(500, "Error inesperado")
        }
    }
    getId = async (req, res) => {
        const resp = new Response({ res })
        try {
            const { id } = req.params, model = await this.devModel.getId({ id })

            if (model) return res.json(model)

            resp.notFound()
        } catch {
            resp.notFound(500, "Error inesperado")
        }
    }

    create = async (req, res) => {
        const resp = new Response({ res })
        try {
            const validate = new Validate({ input: req.body }).validateData(devSche())

            if (validate.error) return resp.notFound(400)

            const model = await this.devModel.create({ input: validate.data })

            if (model) return resp.found()

            resp.notFound(400)
        } catch {
            resp.notFound(500, "Error inesperado")
        }
    }

    addAllow = async (req, res) => {
        const resp = new Response({ res })
        try {
            const validate = new Validate({ input: req.body }).validateData(devSche())

            if (validate.error) return resp.notFound(400)

            const { id } = req.params, devId = await this.devModel.getId({ id }), allowDev = await this.devModel.getId({ id: validate.data.id })

            if (devId && allowDev) {
                let key = `archer${crypto.randomBytes(6).toString("hex")}`, addAllowOnRout = true

                // esto controla si se añade un dispotivo al RepPasillo
                if (devId.name === "RepPasillo") {
                    const { pass } = await this.devModel.getAll({ passw: true }), rout = new AdminRepPasillo({ dev: devId, passw: pass })
                    key = `white_list_${await rout.getKey(await this.devModel.getAll({ whitelist: devId.id }))}`

                    addAllowOnRout = await rout.addAllow({ input: { key: key, dev: req.body } })
                }

                if (addAllowOnRout) {
                    const addAllowOnDb = await this.devModel.addAllow({ input: { device_id: devId.id, allow_device_id: allowDev.id, key: key } })

                    if (addAllowOnDb) return resp.found()
                }
            }
            return resp.notFound(400)
        } catch {
            resp.notFound(500, "Error inesperado")
        }
    }

    delAllow = async (req, res) => {
        const resp = new Response({ res })
        try {
            const { id, allowId } = req.params, { key } = await this.devModel.getAll({ whitelist: id, white: allowId })

            if (key) {
                let delAllowOnRout = true

                if (!key.includes("archer")) {
                    const { pass } = await this.devModel.getAll({ passw: true }), devId = await this.devModel.getId({ id })
                    delAllowOnRout = await new AdminRepPasillo({ dev: devId, passw: pass }).delAllow(key)
                }

                if (delAllowOnRout) {
                    const delAllowOnDb = await this.devModel.delAllow({ id, allowId })

                    if (delAllowOnDb) return resp.found()

                }
            }
            return resp.notFound(400)
        } catch {
            resp.notFound(500, "Error inesperado")
        }
    }

    update = async (req, res) => {
        const resp = new Response({ res })
        try {
            const { id } = req.params, validate = new Validate({ input: { id: id, ...req.body } }).validateData(devSche(), "partial")

            if (validate.error) return resp.notFound(400)

            const model = await this.devModel.update({ id, input: validate.data }), isAllow = await this.devModel.getAll({ white: id })

            if (model && isAllow) {
                let upAllow = true

                // actulizará si se encuentra en RepPasillo
                for (const it of isAllow) {
                    const { device_id, key } = it, rout = await this.devModel.getId({ id: device_id })

                    if (!key.includes("archer")) {
                        const { pass } = await this.devModel.getAll({ passw: true })

                        upAllow = await new AdminRepPasillo({ dev: rout, passw: pass }).updateAllow({ input: { key: key, dev: validate.data } })
                    }
                }

                if (upAllow) return resp.found()

            }

            if (model) return resp.found()

            return resp.notFound(400)
        } catch {
            resp.notFound(500, "Error inesperado")
        }
    }

    del = async (req, res) => {
        const resp = new Response({ res })
        try {
            const { id } = req.params, isAllow = await this.devModel.getAll({ white: id }), model = await this.devModel.del({ id })

            if (model && isAllow.length > 0) {
                let delAllow = false

                // borrará si se encuentra en RepPasillo
                for (const it of isAllow) {
                    const { device_id, key } = it, rout = await this.devModel.getId({ id: device_id })

                    if (!key.includes("archer")) {
                        const { pass } = await this.devModel.getAll({ passw: true })

                        delAllow = await new AdminRepPasillo({ dev: rout, passw: pass }).delAllow(key)
                    }
                    
                }

                if (delAllow) return resp.found()
            }

            if (model) return resp.found()

            resp.notFound(400)
        } catch {
            resp.notFound(500, "Error inesperado")
        }
    }
} 
