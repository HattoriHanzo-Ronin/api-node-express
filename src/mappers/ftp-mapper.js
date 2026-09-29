import { FILE_TYPE } from "../config/constants.js";

/**
 * Maps FTP data to domain representations
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpMapper {
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
        return source.map((entry) => this.entryToDomain(entry));
    }
}
