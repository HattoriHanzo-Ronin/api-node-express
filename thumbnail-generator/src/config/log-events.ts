const LOG_EVENT = Object.freeze({
    serviceStarted: "service.started",
    httpRequestFailed: "http.request.failed",
    thumbnailGenerationFailed: "thumbnail.generation.failed",
    thumbnailGenerationTimeout: "thumbnail.generation.timeout",
    thumbnailBatchStarted: "thumbnail.batch.started",
    thumbnailBatchCompleted: "thumbnail.batch.completed",
    thumbnailBatchFailed: "thumbnail.batch.failed",
    thumbnailBatchExpired: "thumbnail.batch.expired",
    thumbnailSchedulerFailed: "thumbnail.scheduler.failed",
    thumbnailSchedulerResourcesUnavailable: "thumbnail.scheduler.resources_unavailable"
} as const);

export { LOG_EVENT };
