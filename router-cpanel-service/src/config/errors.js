const API_ERROR = Object.freeze({
    internalError: { code: "INTERNAL_ERROR" },
    routeNotFound: { code: "ROUTE_NOT_FOUND" },
    configurationInvalid: { code: "CONFIGURATION_INVALID" },
    routerSessionInvalid: { code: "ROUTER_SESSION_INVALID" },
    routerSessionNotFound: { code: "ROUTER_SESSION_NOT_FOUND" },
    routerSessionCapacityReached: { code: "ROUTER_SESSION_CAPACITY_REACHED" },
    routerSessionFailed: { code: "ROUTER_SESSION_FAILED" }
});

export { API_ERROR };
