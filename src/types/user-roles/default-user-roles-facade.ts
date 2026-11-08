import type UserRolesService from "../../services/user-roles-service.js";
import type UserRolesMapper from "../../mappers/user-roles-mapper.js";

export type UserRolesFacadeDependencies<Transaction> = {
    userRolesService: UserRolesService<Transaction>;
    userRolesMapper: UserRolesMapper;
};
