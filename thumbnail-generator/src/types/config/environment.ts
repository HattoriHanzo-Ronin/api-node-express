import type { LogLevel } from "../logger/logger.js";

export type Environment = Readonly<{
    port: number;
    apiUrl: string;
    thumbnailInitialConcurrency: number;
    thumbnailCpuTarget: number;
    thumbnailMemoryTarget: number;
    thumbnailSchedulerInterval: number;
    thumbnailMaxOutputSize: number;
    thumbnailMaxPixels: number;
    thumbnailTimeout: number;
    logLevel: LogLevel;
    logDirectory: string;
    logRetentionWeeks: number;
}>;
