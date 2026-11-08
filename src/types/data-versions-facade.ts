import type { DataVersionId } from "./data-versions-model.js";

export type DataVersionsId = { id: string[] };
export type DataVersionsParams = DataVersionId | DataVersionsId;
