import { POSTGRES_ERROR } from "../config/constants.js";
import ValidateUtils from "./validate-utils.js";

/**
 * Centralizes the translation of PostgreSQL errors into application errors
 *
 * @author HattoriHanzo-Ronin
 */
export default class PostgresErrors {
    /**
     * Translates whitelist PostgreSQL errors
     *
     * @param {Object} err PostgreSQL error
     */
    static whitelist(err) {
        handleApiErrors([
            {
                condition: err.code === uniqueViolation,
                execute: () => {
                    handleApiErrors([
                        {
                            condition: err.constraint === "whitelist_pk",
                            message: "El dispositivo ya se encuentra autorizado",
                            status: 400,
                            code: "WHITELIST_ALREADY_ALLOWED"
                        },
                        {
                            condition: err.constraint === "whitelist_router_id_key_unique",
                            message: "Error al generar la clave de autorización",
                            code: "WHITELIST_KEY_GENERATION_FAILED"
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
        handleApiErrors([
            {
                condition: err.code === uniqueViolation,
                execute: () => {
                    handleApiErrors([
                        {
                            condition: err.constraint === "devices_name_unique",
                            message: "El nombre del dispositivo ya está en uso",
                            status: 409,
                            code: "DEVICE_NAME_ALREADY_EXISTS"
                        },
                        {
                            condition: err.constraint === "devices_ip_unique",
                            message: "La ip ya está en uso",
                            status: 409,
                            code: "DEVICE_IP_ALREADY_IN_USE"
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
        handleApiErrors([
            {
                condition: err.code === uniqueViolation,
                message: "La mac ya está en uso",
                status: 409,
                code: "CONNECTION_MAC_ALREADY_EXISTS"
            }
        ]);
    }

    /**
     * Translates user PostgreSQL errors
     *
     * @param {Object} err PostgreSQL error
     */
    static users(err) {
        handleApiErrors([
            {
                condition: err.code === uniqueViolation,
                message: "El nombre de usuario ya está en uso",
                status: 409,
                code: "USER_USERNAME_ALREADY_EXISTS"
            }
        ]);
    }

    /**
     * Translates refresh token PostgreSQL errors
     *
     * @param {Object} err PostgreSQL error
     */
    static refreshTokens(err) {
        handleApiErrors([
            {
                condition: err.code === foreignKeyViolation,
                message: "El usuario no existe",
                status: 404,
                code: "REFRESH_TOKEN_USER_NOT_FOUND"
            }
        ]);
    }
}

const { uniqueViolation, foreignKeyViolation } = POSTGRES_ERROR;
const { handleApiErrors } = ValidateUtils;
