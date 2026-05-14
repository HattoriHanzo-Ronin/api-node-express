import Response from "../../utils/ResponseUtils.js";

const downloads = new Map()

export class FtpController {

    constructor({ ftpModel }) {
        this.ftpModel = ftpModel;
    }

    dir = async (req, res) => {
        const resp = new Response({ res })
        try {
            const { dir } = req.query, list = await this.ftpModel.dir({ dir })

            if (list) return res.json(list)

            resp.notFound()
        } catch {
            resp.notFound(500, "Error inesperado")
        }
    }

    makeDir = async (req, res) => {
        const resp = new Response({ res })
        try {
            const { query, body } = req
            const mkDir = await this.ftpModel.makeDir({ dir: query.dir, name: body.name })

            if (mkDir) return resp.found()

            resp.notFound(400)
        } catch {
            resp.notFound(500, "Error inesperado")
        }
    }

    upload = async (req, res) => {
        const resp = new Response({ res })
        try {
            const { file, params, query } = req, upload = await this.ftpModel.upload({ dir: query.dir, type: params.type, input: file })

            if (upload) return resp.found()

            return resp.notFound(400)
        } catch {
            resp.notFound(500, "Error inesperado")
        }
    }

    download = async (req, res) => {
        try {
            const { query, body } = req
            const download = await this.ftpModel.download({ dir: query.dir, input: body.data })

            if (download) {
                const id = crypto.randomUUID()
                downloads.set(id, download)
                return res.json({ id: id })
            }

        } catch {
            new Response({ res }).notFound(500, "Error inesperado")
        }
    }

    getFile = async (req, res) => {
        const resp = new Response({ res })
        try {
            const { params, query } = req, id = params.id, dir = query.dir, file = query.file

            if (id) {
                const zipFile = downloads.get(id)

                if (zipFile) return res.download(zipFile.url, () => { downloads.delete(id) })
                    
            }

            if (file) {
                const donwloadFile = await this.ftpModel.getFile({ dir: dir, file: file })

                if (donwloadFile) return res.download(donwloadFile)
                else console.log("Error")

            }

            return resp.notFound()
        } catch {
            resp.notFound(500, "Error inesperado")
        }
    }

    delete = async (req, res) => {
        const resp = new Response({ res })
        try {
            const { query, params } = req, del = this.ftpModel.delete({ path: query.path, type: params.type })

            if (del) return resp.found()

            return resp.notFound(400)
        } catch {
            new Response({ res }).notFound(500, "Error inesperado")
        }
    }
}