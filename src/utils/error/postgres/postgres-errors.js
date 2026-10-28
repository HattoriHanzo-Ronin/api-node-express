import { API_ERROR } from "../../../config/errors.js";
import ApiError from "../api-error.js";

/**
 * Centralizes the translation of PostgreSQL errors into application errors
 *
 * @author HattoriHanzo-Ronin
 */
export default class PostgresErrors {
    static #UNIQUE_VIOLATION = "23505";
    static #FOREIGN_KEY_VIOLATION = "23503";

    /**
     * Translates whitelist PostgreSQL errors
     *
     * @param {Object} err PostgreSQL error
     */
    static whitelist(err) {
        ApiError.handle([
            {
                condition: err.code === PostgresErrors.#UNIQUE_VIOLATION,
                execute: () => {
                    ApiError.handle([
                        {
                            condition: err.constraint === "whitelist_pk",
                            message: "El dispositivo ya se encuentra autorizado",
                            status: 400,
                            apiError: whitelistAlreadyAllowed
                        },
                        {
                            condition: err.constraint === "whitelist_router_id_key_unique",
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
     * @param {Object} err PostgreSQL error
     */
    static devices(err) {
        ApiError.handle([
            {
                condition: err.code === PostgresErrors.#UNIQUE_VIOLATION,
                execute: () => {
                    ApiError.handle([
                        {
                            condition: err.constraint === "devices_name_unique",
                            message: "El nombre del dispositivo ya está en uso",
                            status: 409,
                            apiError: deviceNameAlreadyExists
                        },
                        {
                            condition: err.constraint === "devices_ip_unique",
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
     * @param {Object} err PostgreSQL error
     */
    static connections(err) {
        ApiError.handle([
            {
                condition: err.code === PostgresErrors.#UNIQUE_VIOLATION,
                message: "La mac ya está en uso",
                status: 409,
                apiError: connectionMacAlreadyExists
            }
        ]);
    }

    /**
     * Translates user PostgreSQL errors
     *
     * @param {Object} err PostgreSQL error
     */
    static users(err) {
        ApiError.handle([
            {
                condition: err.code === PostgresErrors.#UNIQUE_VIOLATION,
                message: "El nombre de usuario ya está en uso",
                status: 409,
                apiError: userUsernameAlreadyExists
            }
        ]);
    }

    /**
     * Translates refresh token PostgreSQL errors
     *
     * @param {Object} err PostgreSQL error
     */
    static refreshTokens(err) {
        ApiError.handle([
            {
                condition: err.code === PostgresErrors.#FOREIGN_KEY_VIOLATION,
                message: "El usuario no existe",
                status: 404,
                apiError: refreshTokenUserNotFound
            }
        ]);
    }
}

const {
    whitelistAlreadyAllowed,
    whitelistKeyGenerationFailed,
    deviceNameAlreadyExists,
    deviceIpAlreadyInUse,
    connectionMacAlreadyExists,
    userUsernameAlreadyExists,
    refreshTokenUserNotFound
} = API_ERROR;
