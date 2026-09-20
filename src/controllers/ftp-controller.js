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
        const { hash, data } = await this.ftpFacade.dir({ dir, authUser });
        res.set("Data-Version", hash).json(data);
    };

    getThumbnail = async (req, res) => {
        const { params, query, user: authUser } = req;
        const { dir, name } = validateData({ ...query, ...params }, getThumbnailSchema());
        const thumbnail = await this.ftpFacade.getThumbnail({ dir, name, authUser });
        res.type("jpeg").send(thumbnail);
    };

    makeDir = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, name } = validateData(body, getMakeDirSchema());
        const { hash, data } = await this.ftpFacade.makeDir({ dir, name, authUser });
        res.set("Data-Version", hash).status(201).json(data);
    };

    move = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entries, destination } = validateData(body, getMoveSchema());
        const { hash, data } = await this.ftpFacade.move({ dir, entries, destination, authUser });
        res.set("Data-Version", hash).json(data);
    };

    rename = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entry, newName } = validateData(body, getRenameSchema());
        const { hash, data } = await this.ftpFacade.rename({ dir, entry, newName, authUser });
        res.set("Data-Version", hash).json(data);
    };

    upload = async (req, res) => {
        const { body, file, user: authUser } = req;
        const { dir } = validateData(body, getUploadSchema());
        const { hash, data } = await this.ftpFacade.upload({ dir, file, authUser });
        res.set("Data-Version", hash).status(201).json(data);
    };

    download = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entries } = validateData(body, getDownloadSchema());
        res.download(await this.ftpFacade.download({ dir, entries, authUser }));
    };

    delete = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entries } = validateData(body, getDeleteSchema());
        const { hash, data } = await this.ftpFacade.delete({ dir, entries, authUser });
        res.set("Data-Version", hash).json(data);
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
