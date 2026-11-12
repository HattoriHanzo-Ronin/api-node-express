const LOG_EVENT = Object.freeze({
    serviceStarted: "service.started",
    httpRequestFailed: "http.request.failed",
    thumbnailGenerationFailed: "thumbnail.generation.failed",
    thumbnailGenerationTimeout: "thumbnail.generation.timeout",
    thumbnailSchedulerStarted: "thumbnail.scheduler.started",
    thumbnailSchedulerStopped: "thumbnail.scheduler.stopped",
    thumbnailSchedulerFailed: "thumbnail.scheduler.failed",
    thumbnailSchedulerResourcesUnavailable: "thumbnail.scheduler.resources_unavailable"
} as const);

export { LOG_EVENT };
