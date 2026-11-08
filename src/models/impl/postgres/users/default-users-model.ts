import type { ITask } from "pg-promise";
import PostgresClient from "../../../../utils/connection/postgres/postgres-client.js";
import usersColumns from "./columns.js";
import type {
    InsertUserParams,
    PasswordCheckResult,
    UpdateUserParams,
    UserAuthentication,
    UserBasicInfo,
    UserCredentials,
    UserId,
    UserPasswordCheck
} from "../../../../types/users/users-model.js";

const { basicInfo, authentication, insert, update } = usersColumns;

/**
 * Default PostgreSQL users model
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultUsersModel {
    private static readonly CLIENT = PostgresClient.getClient();

    static async getAll() {
        return DefaultUsersModel.CLIENT.any<UserBasicInfo>(
            `select ${basicInfo.names} from users`
        );
    }

    static async getById({ id }: UserId) {
        return DefaultUsersModel.CLIENT.oneOrNone<UserBasicInfo>(
            `select ${basicInfo.names} from users where id = $1`,
            [id]
        );
    }

    static async authenticate({ username, password }: UserCredentials) {
        return DefaultUsersModel.CLIENT.oneOrNone<UserAuthentication>(
            `select ${authentication.names} from users
             where username = $1 and password = crypt($2, password)`,
            [username, password]
        );
    }

    static async checkPassword({ id, password }: UserPasswordCheck) {
        return DefaultUsersModel.CLIENT.oneOrNone<PasswordCheckResult>(
            "select true from users where id = $1 and password = crypt($2, password)",
            [id, password]
        );
    }

    static async insert({ clientTx, user }: InsertUserParams<ITask<unknown>>) {
        return clientTx.one<UserBasicInfo>(
            PostgresClient.helpers().insert(user, insert) + ` returning ${basicInfo.names}`
        );
    }

    static async update({ clientTx, id, data }: UpdateUserParams<ITask<unknown>>) {
        return clientTx.oneOrNone<UserBasicInfo>(
            PostgresClient.helpers().update(data, update) + ` where id = $1 returning ${basicInfo.names}`,
            [id]
        );
    }

    static async delete({ id }: UserId) {
        return DefaultUsersModel.CLIENT.oneOrNone<UserId>("delete from users where id = $1 returning id", [id]);
    }
}
