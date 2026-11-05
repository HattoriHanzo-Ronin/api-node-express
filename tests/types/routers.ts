import type { RequestHandler } from "express";

export type FtpRouterController = {
    streamMedia: RequestHandler;
    dir: RequestHandler;
    getThumbnail: RequestHandler;
    makeDir: RequestHandler;
    move: RequestHandler;
    rename: RequestHandler;
    createUpload: RequestHandler;
    uploadEntry: RequestHandler;
    completeUpload: RequestHandler;
    cancelTransfer: RequestHandler;
    createDownload: RequestHandler;
    downloadEntry: RequestHandler;
    delete: RequestHandler;
};

export type SocketSessionsRouterController = {
    create: RequestHandler;
    refresh: RequestHandler;
    close: RequestHandler;
};
