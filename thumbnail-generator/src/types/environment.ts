export type Environment = Readonly<{
    port: number;
    apiUrl: string | undefined;
    thumbnailInitialConcurrency: number;
    thumbnailCpuTarget: number;
    thumbnailMemoryTarget: number;
    thumbnailSchedulerInterval: number;
    thumbnailMaxOutputSize: number;
    thumbnailMaxPixels: number;
    thumbnailTimeout: number;
}>;
