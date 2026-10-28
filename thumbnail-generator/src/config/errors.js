const API_ERROR = Object.freeze({
    internalError: "INTERNAL_ERROR",
    routeNotFound: "ROUTE_NOT_FOUND",
    configurationInvalid: "CONFIGURATION_INVALID",
    thumbnailRequestCancelled: "THUMBNAIL_REQUEST_CANCELLED",
    thumbnailGenerationTimeout: "THUMBNAIL_GENERATION_TIMEOUT",
    thumbnailOutputTooLarge: "THUMBNAIL_OUTPUT_TOO_LARGE",
    thumbnailMediaInvalid: "THUMBNAIL_MEDIA_INVALID",
    thumbnailGenerationFailed: "THUMBNAIL_GENERATION_FAILED"
});

export { API_ERROR };
