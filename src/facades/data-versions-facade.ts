import type { DataVersion, DataVersionId } from "../types/data-versions/data-versions-model.js";
import type { DataVersionsId } from "../types/data-versions/data-versions-facade.js";

export default interface DataVersionsFacade {
    /**
     * Returns data versions by their resource identifiers
     *
     * @param params.id Resource identifier or identifiers
     * @returns Data version or versions
     */
    getById(params: DataVersionId): Promise<Pick<DataVersion, "version">>;
    getById(params: DataVersionsId): Promise<Record<string, string>>;
}
