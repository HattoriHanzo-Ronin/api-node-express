import type UsersService from "../services/users-service.js";
import type UsersMapper from "../mappers/users-mapper.js";
import type UserRolesFacade from "../facades/user-roles-facade.js";
import type DataVersionsFacade from "../facades/data-versions-facade.js";
import type SocketSessionsFacade from "../facades/socket-sessions-facade.js";
import type { AuthAccessTokenPayload } from "./auth.js";
import type { Role } from "./user-roles-model.js";
import type { UserBasicInfo } from "./users-model.js";
import type { UserAcl } from "./user-roles-facade.js";

export type UsersFacadeDependencies<Transaction> = {
    usersService: UsersService<Transaction>;
    usersMapper: UsersMapper;
    dataVersionsFacade: DataVersionsFacade;
    userRolesFacade: UserRolesFacade<Transaction>;
    socketSessionsFacade: SocketSessionsFacade;
    tx: <Result>(callback: (clientTx: Transaction) => Result | Promise<Result>) => Promise<Result>;
};

export type AllowedManageParams = { authUser: AuthAccessTokenPayload; userRoles: Role[] };
export type FilterAclParams = { authUser?: AuthAccessTokenPayload; source: UserBasicInfo & Partial<UserAcl> };
export type ForbiddenParams = { condition: unknown };
