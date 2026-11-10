import type { CreateThumbnailParams } from "./thumbnail-service.js";

export type ThumbnailJob = CreateThumbnailParams & {
    cancel: () => void;
    resolve: (thumbnail: Buffer) => void;
    reject: (reason?: unknown) => void;
};

export type ResourceUsage = {
    cpu: number;
    memory: number;
};

export type ResourceUsageParams = {
    cpuUsage: number;
    cpuLimit: number;
    memoryCurrent: number;
    memoryLimit: number;
};

export type CpuSample = {
    usage: number;
    time: number;
};
