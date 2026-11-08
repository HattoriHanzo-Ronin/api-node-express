import type DataVersionsFacade from "../data-versions-facade.js";
import type { DataVersion, DataVersionId } from "../../types/data-versions/data-versions-model.js";
import type { DataVersionsId, DataVersionsParams } from "../../types/data-versions/data-versions-facade.js";
import type { DataVersionsFacadeDependencies } from "../../types/data-versions/default-data-versions-facade.js";
import type { FtpFacadeDirectoryParams } from "../../types/ftp/ftp-facade.js";

/**
 * Default data versions facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultDataVersionsFacade implements DataVersionsFacade {
    constructor(private readonly dependencies: DataVersionsFacadeDependencies) {}

    async getById(params: DataVersionId): Promise<Pick<DataVersion, "version">>;
    async getById(params: DataVersionsId): Promise<Record<string, string>>;
    async getById({ id }: DataVersionsParams): Promise<Pick<DataVersion, "version"> | Record<string, string>> {
        if (Array.isArray(id)) {
            return this.dependencies.dataVersionsMapper.versionsToDomain(
                await this.dependencies.dataVersionsService.getByIds({ ids: id })
            );
        }

        return this.dependencies.dataVersionsService.getById({ id });
    }

    async getFtp({ dir, authUser }: FtpFacadeDirectoryParams) {
        return { version: await this.dependencies.ftpFacade.getHash({ dir, authUser }) };
    }
}
