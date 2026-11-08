import type { DataVersion, DataVersionId, DataVersionIds } from "../types/data-versions-model.js";

export default interface DataVersionsService {
    /**
     * Returns a data version by its resource identifier
     *
     * @param params.id Resource identifier
     * @returns Data version
     */
    getById(params: DataVersionId): Promise<Pick<DataVersion, "version">>;

    /**
     * Returns data versions by their resource identifiers
     *
     * @param params.ids Resource identifiers
     * @returns Data versions
     */
    getByIds(params: DataVersionIds): Promise<DataVersion[]>;
}
