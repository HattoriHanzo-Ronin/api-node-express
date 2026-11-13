export type CreateThumbnailParams = {
    id: string;
    batchId?: string;
    signal?: AbortSignal;
};

export type RegisterThumbnailBatchParams = {
    id: string;
    userId: string;
    files: { id: string; size: number }[];
};
