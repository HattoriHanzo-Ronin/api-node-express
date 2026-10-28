import path from "node:path";
import FtpSchema from "../schemas/ftp-schema.js";
import ZodUtils from "../utils/zod-utils.js";

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

    streamMedia = async (req, res) => {
        const { params, headers, method } = req;
        const { id } = validateData(params, getMediaSchema());
        await this.ftpFacade.streamMedia({ id, range: headers.range, method, stream: res });
    };

    getThumbnail = async (req, res) => {
        const { params, query, user: authUser } = req;
        const { dir, name } = validateData({ ...query, ...params }, getThumbnailSchema());
        const thumbnail = await this.ftpFacade.getThumbnail({ dir, name, authUser });
        if (thumbnail === null) {
            res.status(204).send();
            return;
        }

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
        await this.ftpFacade.move({ dir, entries, destination, authUser, stream: res });
    };

    rename = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entry, newName } = validateData(body, getRenameSchema());
        const { hash, data } = await this.ftpFacade.rename({ dir, entry, newName, authUser });
        res.set("Data-Version", hash).json(data);
    };

    createUpload = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entries } = validateData(body, getCreateUploadSchema());
        res.status(201).json(await this.ftpFacade.createUpload({ dir, entries, authUser }));
    };

    uploadEntry = async (req, res) => {
        const { params, query, file, user: authUser } = req;
        try {
            const { id, path, offset } = validateData({ ...params, ...query }, getUploadEntrySchema());
            res.json(await this.ftpFacade.uploadEntry({ id, entryPath: path, offset, file, authUser }));
        } catch (error) {
            file?.stream.resume();
            throw error;
        }
    };

    completeUpload = async (req, res) => {
        const { params, user: authUser } = req;
        const { id } = validateData(params, getTransferSchema());
        const { hash, data } = await this.ftpFacade.completeUpload({ id, authUser });
        res.set("Data-Version", hash).json(data);
    };

    cancelTransfer = async (req, res) => {
        const { params, user: authUser } = req;
        const { id } = validateData(params, getTransferSchema());
        await this.ftpFacade.cancelTransfer({ id, authUser });
        res.status(204).send();
    };

    createDownload = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entries } = validateData(body, getCreateDownloadSchema());
        res.status(201).json(await this.ftpFacade.createDownload({ dir, entries, authUser }));
    };

    downloadEntry = async (req, res) => {
        const { params, query, user: authUser } = req;
        const { id, path: entryPath, offset } = validateData({ ...params, ...query }, getDownloadEntrySchema());
        res.attachment(path.posix.basename(entryPath));
        await this.ftpFacade.downloadEntry({ id, entryPath, offset, authUser, stream: res });
    };

    delete = async (req, res) => {
        const { body, user: authUser } = req;
        const { dir, entries } = validateData(body, getDeleteSchema());
        await this.ftpFacade.delete({ dir, entries, authUser, stream: res });
    };
}

const {
    getDeleteSchema,
    getMediaSchema,
    getThumbnailSchema,
    getDirSchema,
    getMoveSchema,
    getRenameSchema,
    getCreateDownloadSchema,
    getCreateUploadSchema,
    getDownloadEntrySchema,
    getMakeDirSchema,
    getTransferSchema,
    getUploadEntrySchema
} = FtpSchema;
const { validateData } = ZodUtils;
