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

    dir = async (req, res) => {
        const { query, user: authUser } = req;
        const { dir } = validateData(query, getDirSchema());
        res.json(await this.ftpService.dir({ dir, authUser }));
    };

    makeDir = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, name } = validateData(body, getMakeDirSchema());
        res.status(201).json(await this.ftpService.makeDir({ dir, name, authUser }));
    };

    move = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entries, destination } = validateData(body, getMoveSchema());
        res.json(await this.ftpService.move({ dir, entries, destination, authUser }));
    };

    rename = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entry, newName } = validateData(body, getRenameSchema());
        res.json(await this.ftpService.rename({ dir, entry, newName, authUser }));
    };

    upload = async (req, res) => {
        const { body, file, user: authUser } = req;
        const { dir } = validateData(body, getUploadSchema());
        res.status(201).json(await this.ftpService.upload({ dir, file, authUser }));
    };

    download = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entries } = validateData(body, getDownloadSchema());
        res.download(await this.ftpService.download({ dir, entries, authUser }));
    };

    delete = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entries } = validateData(body, getDeleteSchema());
        res.json(await this.ftpService.delete({ dir, entries, authUser }));
    };
}

const {
    getDeleteSchema,
    getDirSchema,
    getMoveSchema,
    getRenameSchema,
    getDownloadSchema,
    getMakeDirSchema,
    getUploadSchema
} = FtpSchema;
const { validateData } = ValidateUtils;
