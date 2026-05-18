import FtpSchema from "../schemas/ftp-schema.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * FTP controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpController {
    constructor({ ftpService }) {
        this.ftpService = ftpService;
    }

    dir = async (req, res, next) => {
        const { query } = req;
        const { dir } = validateData({ dir: query.dir }, getDirSchema());
        const result = await this.ftpService.dir({ dir });
        res.status(200).json(result);
    };

    makeDir = async (req, res, next) => {
        const { query, body } = req;
        const { dir, name } = validateData({ dir: query.dir, name: body.name }, getMakeDirSchema());
        await this.ftpService.makeDir({ dir, name });
        res.status(201).json({ message: "Carpeta creada" });
    };

    upload = async (req, res, next) => {
        const { query, file } = req;
        const { dir } = validateData({ dir: query.dir }, getUploadSchema());
        await this.ftpService.upload({ dir, file });
        res.status(201).json({ message: "Datos subidos correctamente" });
    };

    download = async (req, res, next) => {
        const { query, body } = req;
        const { dir, paths } = validateData({ dir: query.dir, paths: body.paths }, getDownloadSchema());
        const result = await this.ftpService.download({ dir, paths });
        res.status(200).download(result);
    };

    delete = async (req, res, next) => {
        const { params, query } = req;
        const { path, type } = validateData({ path: query.path, type: params.type }, getDeleteSchema());
        await this.ftpService.delete({ path, type });
        res.status(200).json({ message: "Borrado existoso" });
    };
}

const { getDeleteSchema, getDirSchema, getDownloadSchema, getMakeDirSchema, getUploadSchema } = FtpSchema;
const { validateData } = ValidateUtils;
