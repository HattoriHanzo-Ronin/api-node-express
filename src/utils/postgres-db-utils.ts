import type { ColumnSet, IColumnConfig, IColumnDescriptor } from "pg-promise";
import PostgresClient from "./connection/postgres/postgres-client.js";

/**
 * PostgreSQL database utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class PostgresDbUtils {
    /**
     * pg-promise ColumnSet skip callback
     *
     * @param column ColumnSet value descriptor
     * @returns Indicates whether the field should be skipped
     */
    static skipNullOrUndefined<T>(column: IColumnDescriptor<T>): boolean {
        return column.value == null;
    }

    /**
     * Builds aliased column names from a ColumnSet
     *
     * @param columnSet Column set
     * @param alias SQL table alias
     * @returns Aliased column names
     */
    static columnsWithAlias<T>(columnSet: ColumnSet<T>, alias: string): string {
        return columnSet.columns.map((column) => `${alias}.${column.name}`).join(", ");
    }

    /**
     * Creates a pg-promise ColumnSet for a database table
     *
     * @param columns Column definitions
     * @param table Database table name
     * @returns Configured ColumnSet
     */
    static createColumnSet<T>(columns: IColumnConfig<T>[], table: string): ColumnSet<T> {
        const helpers = PostgresClient.helpers();
        return new helpers.ColumnSet(columns, { table });
    }
}
