import "dotenv/config";
import { API_ERROR } from "./errors.js";
import ApiError from "../utils/error/api-error.js";
import type { Environment } from "../types/environment.js";

const ENV: Environment = Object.freeze({
    port: Number(process.env.PORT),
    apiUrl: process.env.API_URL,
    thumbnailInitialConcurrency: Number(process.env.THUMBNAIL_INITIAL_CONCURRENCY),
    thumbnailCpuTarget: Number(process.env.THUMBNAIL_CPU_TARGET),
    thumbnailMemoryTarget: Number(process.env.THUMBNAIL_MEMORY_TARGET),
    thumbnailSchedulerInterval: Number(process.env.THUMBNAIL_SCHEDULER_INTERVAL),
    thumbnailMaxOutputSize: Number(process.env.THUMBNAIL_MAX_OUTPUT_SIZE),
    thumbnailMaxPixels: Number(process.env.THUMBNAIL_MAX_PIXELS),
    thumbnailTimeout: Number(process.env.THUMBNAIL_TIMEOUT)
});

validateConfiguration(ENV);

function validateConfiguration(environment: Environment): void {
    const validNumbers = [
        environment.port,
        environment.thumbnailInitialConcurrency,
        environment.thumbnailCpuTarget,
        environment.thumbnailMemoryTarget,
        environment.thumbnailSchedulerInterval,
        environment.thumbnailMaxOutputSize,
        environment.thumbnailMaxPixels,
        environment.thumbnailTimeout
    ].every((value) => Number.isInteger(value) && value > 0);
    const validTargets = environment.thumbnailCpuTarget <= 100 && environment.thumbnailMemoryTarget <= 100;
    const validUrls = typeof environment.apiUrl === "string" && environment.apiUrl.length > 0;
    ApiError.handle([{
        condition: !validNumbers || !validTargets || !validUrls,
        message: "La configuración del generador de miniaturas no es válida",
        apiError: API_ERROR.configurationInvalid
    }]);
}

export { ENV };
