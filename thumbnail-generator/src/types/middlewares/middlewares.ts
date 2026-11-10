import type ApiError from "../../utils/error/api-error.js";

export type MiddlewareError = Error & Partial<Pick<ApiError, "status">>;
