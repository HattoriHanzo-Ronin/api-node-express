import type { DataVersionId } from "./data-versions-model.js";

export type DataVersionsId = { id: DataVersionId["id"][] };
export type DataVersionsParams = DataVersionId | DataVersionsId;
