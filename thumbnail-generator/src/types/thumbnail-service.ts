import type { ApiErrorCode } from "./api-error.js";

export type CreateThumbnailParams = {
    id: string;
    signal?: AbortSignal;
};

export type ThumbnailErrorParams = {
    message: string;
    status?: number;
    apiError?: ApiErrorCode;
};

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
