import "dotenv/config";
import { API_ERROR } from "./errors.js";
import ApiError from "../utils/error/api-error.js";
import type { Environment } from "../types/environment.js";

const {
    THUMBNAIL_INITIAL_CONCURRENCY,
    THUMBNAIL_CPU_TARGET,
    THUMBNAIL_MEMORY_TARGET,
    THUMBNAIL_SCHEDULER_INTERVAL,
    THUMBNAIL_MAX_OUTPUT_SIZE,
    THUMBNAIL_MAX_PIXELS,
    THUMBNAIL_TIMEOUT
} = process.env;
const ENV: Environment = Object.freeze({
    port: Number(process.env.PORT),
    apiUrl: process.env.API_URL,
    thumbnailInitialConcurrency: Number(THUMBNAIL_INITIAL_CONCURRENCY),
    thumbnailCpuTarget: Number(THUMBNAIL_CPU_TARGET),
    thumbnailMemoryTarget: Number(THUMBNAIL_MEMORY_TARGET),
    thumbnailSchedulerInterval: Number(THUMBNAIL_SCHEDULER_INTERVAL),
    thumbnailMaxOutputSize: Number(THUMBNAIL_MAX_OUTPUT_SIZE),
    thumbnailMaxPixels: Number(THUMBNAIL_MAX_PIXELS),
    thumbnailTimeout: Number(THUMBNAIL_TIMEOUT)
});

validateConfiguration(ENV);

function validateConfiguration(environment: Environment): void {
    const {
        port,
        apiUrl,
        thumbnailInitialConcurrency,
        thumbnailCpuTarget,
        thumbnailMemoryTarget,
        thumbnailSchedulerInterval,
        thumbnailMaxOutputSize,
        thumbnailMaxPixels,
        thumbnailTimeout
    } = environment;
    const VALID_NUMBERS = [
        port,
        thumbnailInitialConcurrency,
        thumbnailCpuTarget,
        thumbnailMemoryTarget,
        thumbnailSchedulerInterval,
        thumbnailMaxOutputSize,
        thumbnailMaxPixels,
        thumbnailTimeout
    ].every((value) => Number.isInteger(value) && value > 0);
    const VALID_TARGETS = thumbnailCpuTarget <= 100 && thumbnailMemoryTarget <= 100;
    const VALID_URLS = typeof apiUrl === "string" && apiUrl.length > 0;
    ApiError.handle([
        {
            condition: !VALID_NUMBERS || !VALID_TARGETS || !VALID_URLS,
            message: "La configuración del generador de miniaturas no es válida",
            apiError: API_ERROR.configurationInvalid
        }
    ]);
}

export { ENV };
