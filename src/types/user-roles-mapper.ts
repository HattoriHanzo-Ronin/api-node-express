import type { UserAcl } from "./user-roles-facade.js";

export type UserRolesMapperParams = {
    userId: string;
    roles?: UserAcl["roles"];
    scope?: UserAcl["scope"];
};
