const API_ERROR = Object.freeze({
    internalError: "INTERNAL_ERROR",
    routeNotFound: "ROUTE_NOT_FOUND",
    configurationInvalid: "CONFIGURATION_INVALID",
    routerSessionInvalid: "ROUTER_SESSION_INVALID",
    routerSessionNotFound: "ROUTER_SESSION_NOT_FOUND",
    routerSessionCapacityReached: "ROUTER_SESSION_CAPACITY_REACHED",
    routerSessionConnectionCapacityReached: "ROUTER_SESSION_CONNECTION_CAPACITY_REACHED",
    routerSessionFailed: "ROUTER_SESSION_FAILED"
} as const);

export { API_ERROR };
