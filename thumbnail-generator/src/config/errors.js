const API_ERROR = Object.freeze({
    internalError: { code: "INTERNAL_ERROR" },
    routeNotFound: { code: "ROUTE_NOT_FOUND" },
    configurationInvalid: { code: "CONFIGURATION_INVALID" },
    thumbnailRequestCancelled: { code: "THUMBNAIL_REQUEST_CANCELLED" },
    thumbnailGenerationTimeout: { code: "THUMBNAIL_GENERATION_TIMEOUT" },
    thumbnailOutputTooLarge: { code: "THUMBNAIL_OUTPUT_TOO_LARGE" },
    thumbnailMediaInvalid: { code: "THUMBNAIL_MEDIA_INVALID" },
    thumbnailGenerationFailed: { code: "THUMBNAIL_GENERATION_FAILED" }
});

export { API_ERROR };
