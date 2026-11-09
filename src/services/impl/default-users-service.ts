import type { GetAllUsersParams } from "../../types/users/users-service.js";
import type UsersService from "../users-service.js";
import type { UsersServiceDependencies } from "../../types/users/default-users-service.js";
import type {
    InsertUserParams,
    UpdateUserParams,
    UserCredentials,
    UserId,
    UserPasswordCheck
} from "../../types/users/users-model.js";
import type { PostgresError } from "../../types/utils/postgres-error.js";
import ApiError from "../../utils/error/api-error.js";
import ValidateUtils from "../../utils/validate-utils.js";
import { API_ERROR } from "../../config/errors.js";

const { userNotFound, userInvalidCredentials, userIncorrectPassword, userEmptyUpdate } = API_ERROR;

/**
 * Default users service
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultUsersService<Transaction> implements UsersService<Transaction> {
    constructor(private readonly dependencies: UsersServiceDependencies<Transaction>) {}

    async getAll({}: GetAllUsersParams = {}) {
        return this.dependencies.usersModel.getAll();
    }

    async getById({ id }: UserId) {
        const result = await this.dependencies.usersModel.getById({ id });
        ApiError.handle([
            {
                condition: !result,
                message: "El usuario no existe",
                status: 404,
                apiError: userNotFound
            }
        ]);

        return result!;
    }

    async authenticate({ username, password }: UserCredentials) {
        const result = await this.dependencies.usersModel.authenticate({ username, password });
        ApiError.handle([
            {
                condition: !result || !result.active,
                message: "Usuario o contraseña incorrectos",
                status: 401,
                apiError: userInvalidCredentials
            }
        ]);

        return result!;
    }

    async checkPassword({ id, password }: UserPasswordCheck) {
        const result = await this.dependencies.usersModel.checkPassword({ id, password });
        ApiError.handle([
            {
                condition: !result,
                message: "Contraseña incorrecta",
                status: 401,
                apiError: userIncorrectPassword
            }
        ]);
    }

    async create({ clientTx, user }: InsertUserParams<Transaction>) {
        try {
            return await this.dependencies.usersModel.insert({ clientTx, user });
        } catch (err) {
            this.dependencies.entityError(err as PostgresError);
            throw err;
        }
    }

    async update({ clientTx, id, data }: UpdateUserParams<Transaction>) {
        try {
            ValidateUtils.validateNotEmptyObject(data, userEmptyUpdate);
            return await this.dependencies.usersModel.update({ clientTx, id, data });
        } catch (err) {
            this.dependencies.entityError(err as PostgresError);
            throw err;
        }
    }

    async delete({ id }: UserId) {
        return this.dependencies.usersModel.delete({ id });
    }
}
