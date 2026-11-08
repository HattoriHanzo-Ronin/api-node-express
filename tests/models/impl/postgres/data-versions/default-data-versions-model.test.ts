import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ one: vi.fn(), any: vi.fn() }));
vi.mock("../../../../../src/utils/connection/postgres/postgres-client.js", () => ({
    default: { getClient: () => client }
}));

import DefaultDataVersionsModel from "../../../../../src/models/impl/postgres/data-versions/default-data-versions-model.js";

describe("DataVersionsModel", () => {
    beforeEach(() => vi.resetAllMocks());

    it("returns the requested version from one row", async () => {
        client.one.mockResolvedValue({ version: "2" });
        await expect(DefaultDataVersionsModel.getById({ id: "devices" })).resolves.toEqual({ version: "2" });
        expect(client.one).toHaveBeenCalledWith("select version from data_versions where id = $1", ["devices"]);
    });

    it("propagates an error when the version does not exist", async () => {
        const error = new Error("No data returned from the query");
        client.one.mockRejectedValue(error);
        await expect(DefaultDataVersionsModel.getById({ id: "missing" })).rejects.toBe(error);
    });

    it("returns versions for multiple identifiers", async () => {
        const versions = [{ id: "devices", version: "2" }];
        client.any.mockResolvedValue(versions);
        await expect(DefaultDataVersionsModel.getByIds({ ids: ["devices"] })).resolves.toEqual(versions);
        expect(client.any).toHaveBeenCalledWith("select id, version from data_versions where id in ($1:csv)", [
            ["devices"]
        ]);
    });
});
