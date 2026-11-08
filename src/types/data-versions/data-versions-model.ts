export type DataVersion = { id: string; version: string };
export type DataVersionId = Pick<DataVersion, "id">;
export type DataVersionIds = { ids: DataVersion["id"][] };
