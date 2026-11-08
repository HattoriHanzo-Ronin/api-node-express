import { API_ERROR } from "../../../config/errors.js";
import ApiError from "../api-error.js";
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
    private static readonly UNIQUE_VIOLATION = "23505";
    private static readonly FOREIGN_KEY_VIOLATION = "23503";

    /**
     * Translates whitelist PostgreSQL errors
     *
     * @param code PostgreSQL error code
     * @param constraint PostgreSQL constraint
     */
    static whitelist({ code, constraint }: PostgresError): void {
        ApiError.handle([
            {
                condition: code === PostgresErrors.UNIQUE_VIOLATION,
                execute: () => {
                    ApiError.handle([
                        {
                            condition: constraint === "whitelist_pk",
                            message: "El dispositivo ya se encuentra autorizado",
                            status: 400,
                            apiError: whitelistAlreadyAllowed
                        },
                        {
                            condition: constraint === "whitelist_router_id_key_unique",
                            message: "Error al generar la clave de autorización",
                            apiError: whitelistKeyGenerationFailed
                        }
                    ]);
                }
            }
        ]);
    }

    /**
     * Translates device PostgreSQL errors
     *
     * @param code PostgreSQL error code
     * @param constraint PostgreSQL constraint
     */
    static devices({ code, constraint }: PostgresError): void {
        ApiError.handle([
            {
                condition: code === PostgresErrors.UNIQUE_VIOLATION,
                execute: () => {
                    ApiError.handle([
                        {
                            condition: constraint === "devices_name_unique",
                            message: "El nombre del dispositivo ya está en uso",
                            status: 409,
                            apiError: deviceNameAlreadyExists
                        },
                        {
                            condition: constraint === "devices_ip_unique",
                            message: "La ip ya está en uso",
                            status: 409,
                            apiError: deviceIpAlreadyInUse
                        }
                    ]);
                }
            }
        ]);
    }

    /**
     * Translates connection PostgreSQL errors
     *
     * @param code PostgreSQL error code
     */
    static connections({ code }: PostgresError): void {
        ApiError.handle([
            {
                condition: code === PostgresErrors.UNIQUE_VIOLATION,
                message: "La mac ya está en uso",
                status: 409,
                apiError: connectionMacAlreadyExists
            }
        ]);
    }

    /**
     * Translates user PostgreSQL errors
     *
     * @param code PostgreSQL error code
     */
    static users({ code }: PostgresError): void {
        ApiError.handle([
            {
                condition: code === PostgresErrors.UNIQUE_VIOLATION,
                message: "El nombre de usuario ya está en uso",
                status: 409,
                apiError: userUsernameAlreadyExists
            }
        ]);
    }

    /**
     * Translates refresh token PostgreSQL errors
     *
     * @param code PostgreSQL error code
     */
    static refreshTokens({ code }: PostgresError): void {
        ApiError.handle([
            {
                condition: code === PostgresErrors.FOREIGN_KEY_VIOLATION,
                message: "El usuario no existe",
                status: 404,
                apiError: refreshTokenUserNotFound
            }
        ]);
    }
}
