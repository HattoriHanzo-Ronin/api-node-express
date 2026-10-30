import type { API_ERROR } from "../config/errors.js";

export type ApiErrorCode = (typeof API_ERROR)[keyof typeof API_ERROR];

export type ApiErrorOptions = {
    message: string;
    status?: number;
    apiError?: ApiErrorCode;
};

export type ErrorCondition = {
    condition: boolean;
    execute?: () => void;
    message?: string;
    status?: number;
    apiError?: ApiErrorCode;
};
