import type { API_ERROR } from "../../config/errors.js";

export type ApiErrorCode = (typeof API_ERROR)[keyof typeof API_ERROR];
export type ErrorDetail = { field?: string; message: string };

export type ApiErrorOptions = {
    message: string;
    details?: ErrorDetail | ErrorDetail[];
    status?: number;
    apiError?: ApiErrorCode;
};

export type ApiErrorResponse = {
    code: ApiErrorCode;
    message: string;
    details?: ErrorDetail | ErrorDetail[];
};

export type ErrorCondition = {
    condition: boolean;
    execute?: () => void;
    message?: string;
    status?: number;
    apiError?: ApiErrorCode;
};
