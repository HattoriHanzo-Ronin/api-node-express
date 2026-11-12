import type { WebSocket } from "ws";
import type UsersService from "../../services/users-service.js";
import type UsersMapper from "../../mappers/users-mapper.js";
import type UserRolesFacade from "../../facades/user-roles-facade.js";
import type DataVersionsFacade from "../../facades/data-versions-facade.js";
import type SocketSessionsFacade from "../../facades/socket-sessions-facade.js";
import type { AuthUserParams } from "../auth/auth-facade.js";
import type { Role } from "../user-roles/user-roles-model.js";
import type { UserBasicInfo } from "./users-model.js";
import type { UserAcl } from "../user-roles/user-roles-mapper.js";

export type UsersFacadeDependencies<Transaction> = {
    usersService: UsersService<Transaction>;
    usersMapper: UsersMapper;
    dataVersionsFacade: DataVersionsFacade;
    userRolesFacade: UserRolesFacade<Transaction>;
    socketSessionsFacade: SocketSessionsFacade<WebSocket>;
    tx: <Result>(callback: (clientTx: Transaction) => Result | Promise<Result>) => Promise<Result>;
};

export type AllowedManageParams = AuthUserParams & { userRoles: Role[] };
export type FilterAclParams = Partial<AuthUserParams> & { source: UserBasicInfo & Partial<UserAcl> };
export type ForbiddenParams = AuthUserParams & { condition: unknown };
