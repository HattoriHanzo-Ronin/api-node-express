import path from "node:path";
import { FILE_TYPE } from "../config/constants.js";

/**
 * Maps FTP data to domain representations
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpMapper {
    static #MEDIA_EXTENSION = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif|mp4|m4v|mov|mkv|webm|avi|mpeg|mpg|wmv|flv|3gp|mts|m2ts|ogv)$/i;

    /**
     * Maps SFTP entries to FTP sources
     *
     * @param {Object[]} source SFTP entries
     * @returns {Object[]} FTP entry sources
     */
    static entriesFromSftp(source) {
        return source.map(({ name, type, size, modifyTime }) => {
            const normalizedType = type === "d" ? FILE_TYPE.dir : FILE_TYPE.file;
            return {
                name,
                type: normalizedType,
                size,
                modifyTime,
                supportsThumbnail: normalizedType === FILE_TYPE.file && FtpMapper.#MEDIA_EXTENSION.test(path.extname(name))
            };
        });
    }

    /**
     * Maps a FTP entry to the domain model
     *
     * @param {Object} source FTP entry source
     * @returns {Object} Domain FTP entry
     */
    static entryToDomain(source) {
        const { name, type, supportsThumbnail } = source;
        const entry = { name, type };
        return type === FILE_TYPE.file ? { ...entry, supportsThumbnail } : entry;
    }

    /**
     * Maps FTP entries to the domain model
     *
     * @param {Object[]} source FTP entries
     * @returns {Object[]} Domain FTP entries
     */
    static entriesToDomain(source) {
        return source.map((entry) => FtpMapper.entryToDomain(entry));
    }
}
