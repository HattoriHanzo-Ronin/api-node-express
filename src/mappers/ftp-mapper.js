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
        const { thumbnail, ...entry } = source;
        return entry.type === FILE_TYPE.file ? { ...entry, hasThumbnail: thumbnail !== null && thumbnail !== undefined } : entry;
    }

    /**
     * Maps FTP entries to the domain model
     *
     * @param {Object} source FTP entries and thumbnails
     * @returns {Object[]} Domain FTP entries
     */
    static entriesToDomain(source) {
        const { entries, bufferMap } = source;
        return entries.map((entry) => this.entryToDomain({ ...entry, thumbnail: bufferMap.get(entry.name) }));
    }
}
