/**
 * Database utility helpers, provides reusable database helper methods
 *
 * @author HattoriHanzo-Ronin
 */
export default class DbUtils {
    /**
     * pg-promise ColumnSet skip callback
     *
     * @param {{ value: unknown }} c ColumnSet value descriptor
     * @returns {boolean} Indicates whether the field should be skipped
     */
    static skipNullOrUndefined(c) {
        return c.value == null;
    }

    /**
     * Builds aliased column names from a ColumnSet
     *
     * @param {import("pg-promise").IColumnSet} columnSet Column set
     * @param {string} alias SQL table alias
     * @returns {string} Aliased column names
     */
    static pgPromiseColumnsWithAlias(columnSet, alias) {
        return columnSet.columns.map((c) => `${alias}.${c.name}`).join(", ");
    }
}
