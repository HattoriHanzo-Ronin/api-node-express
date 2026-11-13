import type { CreateThumbnailParams } from "./thumbnail-service.js";

export type ThumbnailJob = CreateThumbnailParams & {
    cancel: () => void;
    resolve: (thumbnail: Buffer) => void;
    reject: (reason?: unknown) => void;
};

export type ThumbnailBatch = {
    startedAt: number;
    pending: number;
    userId: string;
    files: Map<string, NodeJS.Timeout>;
    totalFiles: number;
    totalSize: number;
    generated: number;
    failed: number;
    expired: number;
    peakCpu?: number;
    peakMemory?: number;
    peakActive: number;
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
