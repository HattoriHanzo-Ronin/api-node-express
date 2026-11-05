import type { ITask } from "pg-promise";
import type { Role } from "./user-roles-model.js";

type UserRolesWriteParams = {
    clientTx: ITask<unknown>;
    userId: string;
    roles: Role[] | undefined;
    scope: Role[] | undefined;
};

export default UserRolesWriteParams;
