const ENV = Object.freeze({
    port: Number(process.env.PORT),
    apiUrl: process.env.API_URL,
    thumbnailGeneratorUrl: process.env.THUMBNAIL_GENERATOR_URL,
    thumbnailInitialConcurrency: Number(process.env.THUMBNAIL_INITIAL_CONCURRENCY),
    thumbnailCpuTarget: Number(process.env.THUMBNAIL_CPU_TARGET),
    thumbnailMemoryTarget: Number(process.env.THUMBNAIL_MEMORY_TARGET),
    thumbnailSchedulerInterval: Number(process.env.THUMBNAIL_SCHEDULER_INTERVAL)
});

validateConfiguration(ENV);

function validateConfiguration(environment) {
    const validNumbers = [
        environment.port,
        environment.thumbnailInitialConcurrency,
        environment.thumbnailCpuTarget,
        environment.thumbnailMemoryTarget,
        environment.thumbnailSchedulerInterval
    ].every((value) => Number.isInteger(value) && value > 0);
    const validTargets = environment.thumbnailCpuTarget <= 100 && environment.thumbnailMemoryTarget <= 100;
    const validUrls = [environment.apiUrl, environment.thumbnailGeneratorUrl].every((value) => typeof value === "string" && value.length > 0);
    if (!validNumbers || !validTargets || !validUrls) {
        const error = new Error("La configuración del generador de miniaturas no es válida");
        error.code = "CONFIGURATION_INVALID";
        throw error;
    }
}

export { ENV };
