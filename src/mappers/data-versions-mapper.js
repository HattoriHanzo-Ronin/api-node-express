/**
 * Maps data versions to domain representations
 *
 * @author HattoriHanzo-Ronin
 */
export default class DataVersionsMapper {
    /**
     * Maps persistence versions by entity identifier
     *
     * @param {Object[]} source Persistence versions
     * @returns {Object<string, string>} Data versions
     */
    static versionsToDomain(source) {
        return Object.fromEntries(source.map(({ id, version }) => [id, version]));
    }
}
