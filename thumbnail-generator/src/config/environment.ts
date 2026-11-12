import "dotenv/config";
import { API_ERROR } from "./errors.js";
import ApiError from "../utils/error/api-error.js";
import type { Environment } from "../types/config/environment.js";
import type { LogLevel } from "../types/logger/logger.js";

const {
    THUMBNAIL_INITIAL_CONCURRENCY,
    THUMBNAIL_CPU_TARGET,
    THUMBNAIL_MEMORY_TARGET,
    THUMBNAIL_SCHEDULER_INTERVAL,
    THUMBNAIL_MAX_OUTPUT_SIZE,
    THUMBNAIL_MAX_PIXELS,
    THUMBNAIL_TIMEOUT,
    LOG_LEVEL,
    LOG_DIRECTORY,
    LOG_RETENTION_WEEKS
} = process.env;
const ENV: Environment = Object.freeze(
    validateConfiguration({
        port: Number(process.env.PORT),
        apiUrl: process.env.API_URL,
        thumbnailInitialConcurrency: Number(THUMBNAIL_INITIAL_CONCURRENCY),
        thumbnailCpuTarget: Number(THUMBNAIL_CPU_TARGET),
        thumbnailMemoryTarget: Number(THUMBNAIL_MEMORY_TARGET),
        thumbnailSchedulerInterval: Number(THUMBNAIL_SCHEDULER_INTERVAL),
        thumbnailMaxOutputSize: Number(THUMBNAIL_MAX_OUTPUT_SIZE),
        thumbnailMaxPixels: Number(THUMBNAIL_MAX_PIXELS),
        thumbnailTimeout: Number(THUMBNAIL_TIMEOUT),
        logLevel: toLogLevel(LOG_LEVEL),
        logDirectory: LOG_DIRECTORY,
        logRetentionWeeks: Number(LOG_RETENTION_WEEKS)
    })
);

function validateConfiguration(environment: Partial<Environment>): Environment {
    const {
        port,
        apiUrl,
        thumbnailInitialConcurrency,
        thumbnailCpuTarget,
        thumbnailMemoryTarget,
        thumbnailSchedulerInterval,
        thumbnailMaxOutputSize,
        thumbnailMaxPixels,
        thumbnailTimeout,
        logLevel,
        logDirectory,
        logRetentionWeeks
    } = environment;
    const VALID_NUMBERS = [
        port,
        thumbnailInitialConcurrency,
        thumbnailCpuTarget,
        thumbnailMemoryTarget,
        thumbnailSchedulerInterval,
        thumbnailMaxOutputSize,
        thumbnailMaxPixels,
        thumbnailTimeout,
        logRetentionWeeks
    ].every((value) => typeof value === "number" && Number.isInteger(value) && value > 0);
    const VALID_TARGETS =
        typeof thumbnailCpuTarget === "number" &&
        typeof thumbnailMemoryTarget === "number" &&
        thumbnailCpuTarget <= 100 &&
        thumbnailMemoryTarget <= 100;
    const VALID_URLS = typeof apiUrl === "string" && apiUrl.length > 0;
    const VALID_LOGGER = Boolean(logDirectory?.trim()) && logLevel !== undefined;
    ApiError.handle([
        {
            condition: !VALID_NUMBERS || !VALID_TARGETS || !VALID_URLS || !VALID_LOGGER,
            message: "La configuración del generador de miniaturas no es válida",
            apiError: API_ERROR.configurationInvalid
        }
    ]);
    return environment as Environment;
}

function toLogLevel(level: string | undefined): LogLevel | undefined {
    if (level === "debug" || level === "info" || level === "warn" || level === "error") {
        return level;
    }

    return undefined;
}

export { ENV };
