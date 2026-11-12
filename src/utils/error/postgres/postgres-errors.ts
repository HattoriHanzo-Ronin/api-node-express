import { API_ERROR } from "../../../config/errors.js";
import ApiError from "../api-error.js";
import Logger from "../../logger/logger.js";
import { LOG_EVENT } from "../../../config/log-events.js";
import type { PostgresError } from "../../../types/utils/postgres-error.js";

const {
    whitelistAlreadyAllowed,
    whitelistKeyGenerationFailed,
    deviceNameAlreadyExists,
    deviceIpAlreadyInUse,
    connectionMacAlreadyExists,
    userUsernameAlreadyExists,
    refreshTokenUserNotFound
} = API_ERROR;

/**
 * Centralizes the translation of PostgreSQL errors into application errors
 *
 * @author HattoriHanzo-Ronin
 */
export default class PostgresErrors {
    private static readonly LOGGER = Logger.getLogger(PostgresErrors);
    private static readonly UNIQUE_VIOLATION = "23505";
    private static readonly FOREIGN_KEY_VIOLATION = "23503";

    /**
     * Translates whitelist PostgreSQL errors
     *
     * @param error PostgreSQL error
     */
    static whitelist(error: PostgresError): void {
        const { code, constraint } = error;
        ApiError.handle([
            {
                condition: code === PostgresErrors.UNIQUE_VIOLATION,
                execute: () => {
                    ApiError.handle([
                        {
                            condition: constraint === "whitelist_pk",
                            message: "El dispositivo ya se encuentra autorizado",
                            status: 400,
                            apiError: whitelistAlreadyAllowed,
                            cause: error
                        },
                        {
                            condition: constraint === "whitelist_router_id_key_unique",
                            execute: () => {
                                PostgresErrors.LOGGER.error({
                                    event: LOG_EVENT.databaseOperationFailed,
                                    message: "Failed to generate whitelist key",
                                    error
                                });
                            },
                            message: "Error al generar la clave de autorización",
                            apiError: whitelistKeyGenerationFailed,
                            cause: error
                        }
                    ]);
                }
            }
        ]);
    }

    /**
     * Translates device PostgreSQL errors
     *
     * @param error PostgreSQL error
     */
    static devices(error: PostgresError): void {
        const { code, constraint } = error;
        ApiError.handle([
            {
                condition: code === PostgresErrors.UNIQUE_VIOLATION,
                execute: () => {
                    ApiError.handle([
                        {
                            condition: constraint === "devices_name_unique",
                            message: "El nombre del dispositivo ya está en uso",
                            status: 409,
                            apiError: deviceNameAlreadyExists,
                            cause: error
                        },
                        {
                            condition: constraint === "devices_ip_unique",
                            message: "La ip ya está en uso",
                            status: 409,
                            apiError: deviceIpAlreadyInUse,
                            cause: error
                        }
                    ]);
                }
            }
        ]);
    }

    /**
     * Translates connection PostgreSQL errors
     *
     * @param error PostgreSQL error
     */
    static connections(error: PostgresError): void {
        const { code } = error;
        ApiError.handle([
            {
                condition: code === PostgresErrors.UNIQUE_VIOLATION,
                message: "La mac ya está en uso",
                status: 409,
                apiError: connectionMacAlreadyExists,
                cause: error
            }
        ]);
    }

    /**
     * Translates user PostgreSQL errors
     *
     * @param error PostgreSQL error
     */
    static users(error: PostgresError): void {
        const { code } = error;
        ApiError.handle([
            {
                condition: code === PostgresErrors.UNIQUE_VIOLATION,
                message: "El nombre de usuario ya está en uso",
                status: 409,
                apiError: userUsernameAlreadyExists,
                cause: error
            }
        ]);
    }

    /**
     * Translates refresh token PostgreSQL errors
     *
     * @param error PostgreSQL error
     */
    static refreshTokens(error: PostgresError): void {
        const { code } = error;
        ApiError.handle([
            {
                condition: code === PostgresErrors.FOREIGN_KEY_VIOLATION,
                message: "El usuario no existe",
                status: 404,
                apiError: refreshTokenUserNotFound,
                cause: error
            }
        ]);
    }
}
