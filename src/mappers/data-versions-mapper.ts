import type { DataVersion } from "../types/data-versions-model.js";

export default interface DataVersionsMapper {
    /**
     * Maps data versions by entity identifier
     *
     * @param source Persistence versions
     * @returns Data versions
     */
    versionsToDomain(source: DataVersion[]): Record<string, string>;
}
