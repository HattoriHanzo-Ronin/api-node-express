import type { ServerResponse } from "node:http";
import type DataVersionsService from "../services/data-versions-service.js";
import type DataVersionsMapper from "../mappers/data-versions-mapper.js";
import type FtpFacade from "../facades/ftp-facade.js";
import type { FtpProgressStream } from "./default-ftp-facade.js";
import type { FtpDownloadStream } from "./default-ftp-service.js";
import type { UploadedFile } from "./middlewares.js";

export type DataVersionsFacadeDependencies = {
    dataVersionsService: DataVersionsService;
    dataVersionsMapper: DataVersionsMapper;
    ftpFacade: FtpFacade<ServerResponse, FtpProgressStream, FtpDownloadStream, UploadedFile, Buffer>;
};
