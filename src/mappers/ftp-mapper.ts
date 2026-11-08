import type { FtpDomainEntry, FtpEntrySource } from "../types/ftp/ftp-mapper.js";

export default interface FtpMapper<SourceEntry> {
    /**
     * Maps entries to FTP sources
     *
     * @param source Source entries
     * @returns FTP entry sources
     */
    entriesFromSource(source: SourceEntry[]): FtpEntrySource[];

    /**
     * Maps a FTP entry to the domain model
     *
     * @param source FTP entry source
     * @returns Domain FTP entry
     */
    entryToDomain(source: FtpEntrySource): FtpDomainEntry;

    /**
     * Maps FTP entries to the domain model
     *
     * @param source FTP entry sources
     * @returns Domain FTP entries
     */
    entriesToDomain(source: FtpEntrySource[]): FtpDomainEntry[];
}
