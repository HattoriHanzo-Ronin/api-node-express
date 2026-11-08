import { describe, expect, it } from "vitest";
import DefaultUsersMapper from "../../src/mappers/impl/default-users-mapper.js";
import type UsersMapper from "../../src/mappers/users-mapper.js";
import type { UserAclByUser } from "../../src/types/user-roles/user-roles-facade.js";
import type { UserAcl } from "../../src/types/user-roles/user-roles-mapper.js";
import type { UserBasicInfo } from "../../src/types/users/users-model.js";

const mapper: UsersMapper = DefaultUsersMapper;

describe("UsersMapper", () => {
    it("maps an authenticated user identity with its ACL", () => {
        const source = { id: "1", username: "user" };
        const acl: UserAcl = { roles: ["ADMIN"], scope: ["FTP"] };
        expect(mapper.userToDomain({ source, acl })).toEqual({ ...source, ...acl });
    });

    it("maps persisted users with their corresponding ACL", () => {
        const first: UserBasicInfo = {
            id: "1",
            username: "first",
            active: true,
            created_at: new Date("2024-01-01T00:00:00Z"),
            updated_at: new Date("2024-01-01T00:00:00Z")
        };
        const second: UserBasicInfo = { ...first, id: "2", username: "second" };
        const acl: UserAcl = { roles: ["FTP"] };
        const secondAcl: UserAcl = { roles: ["NET"] };
        const aclByUser = new Map([
            ["1", acl],
            ["2", secondAcl]
        ]) as UserAclByUser;
        expect(mapper.usersToDomain({ users: [first, second], aclByUser })).toEqual([
            { ...first, ...acl },
            { ...second, ...secondAcl }
        ]);
    });
});
