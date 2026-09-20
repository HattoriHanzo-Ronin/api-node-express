import FtpSchema from "../schemas/ftp-schema.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * FTP controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpController {
    constructor({ ftpFacade }) {
        this.ftpFacade = ftpFacade;
    }

    dir = async (req, res) => {
        const { query, user: authUser } = req;
        const { dir } = validateData(query, getDirSchema());
        const { version, data } = await this.ftpFacade.dir({ dir, authUser });
        res.set("Data-Version", version).json(data);
    };

    getThumbnail = async (req, res) => {
        const { params, query, user: authUser } = req;
        const { dir, name } = validateData({ ...query, ...params }, getThumbnailSchema());
        res.type("jpeg").send(await this.ftpFacade.getThumbnail({ dir, name, authUser }));
    };

    makeDir = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, name } = validateData(body, getMakeDirSchema());
        res.status(201).json(await this.ftpFacade.makeDir({ dir, name, authUser }));
    };

    move = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entries, destination } = validateData(body, getMoveSchema());
        res.json(await this.ftpFacade.move({ dir, entries, destination, authUser }));
    };

    rename = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entry, newName } = validateData(body, getRenameSchema());
        res.json(await this.ftpFacade.rename({ dir, entry, newName, authUser }));
    };

    upload = async (req, res) => {
        const { body, file, user: authUser } = req;
        const { dir } = validateData(body, getUploadSchema());
        res.status(201).json(await this.ftpFacade.upload({ dir, file, authUser }));
    };

    download = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entries } = validateData(body, getDownloadSchema());
        res.download(await this.ftpFacade.download({ dir, entries, authUser }));
    };

    delete = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entries } = validateData(body, getDeleteSchema());
        res.json(await this.ftpFacade.delete({ dir, entries, authUser }));
    };
}

const {
    getDeleteSchema,
    getThumbnailSchema,
    getDirSchema,
    getMoveSchema,
    getRenameSchema,
    getDownloadSchema,
    getMakeDirSchema,
    getUploadSchema
} = FtpSchema;
const { validateData } = ValidateUtils;
