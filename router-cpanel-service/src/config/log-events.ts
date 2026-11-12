const LOG_EVENT = Object.freeze({
    serviceStarted: "service.started",
    authorizationDenied: "authorization.denied",
    httpRequestFailed: "http.request.failed",
    sessionCapacityReached: "router.session.capacity_reached",
    vncCapacityReached: "router.vnc.capacity_reached",
    sessionCreated: "router.session.created",
    sessionClosed: "router.session.closed",
    sessionNavigated: "router.session.navigated",
    sessionCleanupFailed: "router.session.cleanup_failed",
    sessionAutofillFailed: "router.session.autofill_failed",
    sessionOperationFailed: "router.session.operation_failed",
    vncConnectionFailed: "router.vnc.connection_failed",
    vncDisconnected: "router.vnc.disconnected",
    vncSocketFailed: "router.vnc.socket_failed"
} as const);

export { LOG_EVENT };
