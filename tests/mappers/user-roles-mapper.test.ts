import { describe, expect, it } from "vitest";
import UserRolesMapper from "../../src/mappers/impl/default-user-roles-mapper.js";

describe("UserRolesMapper", () => {
    it("groups roles by user and splits the admin scope", () => {
        const source = [
            { user_id: "1", role: "FTP" as const, scope: null },
            { user_id: "1", role: "ADMIN" as const, scope: "FTP,NET" },
            { user_id: "2", role: "NET" as const, scope: null }
        ];
        expect(UserRolesMapper.rolesByUsersToDomain(source)).toEqual(new Map([
            ["1", { roles: ["FTP", "ADMIN"], scope: ["FTP", "NET"] }],
            ["2", { roles: ["NET"] }]
        ]));
    });

    it("serializes scope only for admin roles", () => {
        expect(UserRolesMapper.rolesToPersistence({ userId: "1", roles: ["FTP", "ADMIN"], scope: ["FTP", "NET"] })).toEqual([
            { user_id: "1", role: "FTP", scope: null },
            { user_id: "1", role: "ADMIN", scope: "FTP,NET" }
        ]);
    });
});
