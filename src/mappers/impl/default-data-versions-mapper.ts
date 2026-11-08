import type { DataVersion } from "../../types/data-versions/data-versions-model.js";

/**
 * Default data versions mapper
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultDataVersionsMapper {
    static versionsToDomain(source: DataVersion[]): Record<string, string> {
        return Object.fromEntries(source.map(({ id, version }) => [id, version]));
    }
}
