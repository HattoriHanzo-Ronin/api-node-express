export type Environment = Readonly<{
    port: number;
    apiUrl: string;
    thumbnailInitialConcurrency: number;
    thumbnailCpuTarget: number;
    thumbnailMemoryTarget: number;
    thumbnailSchedulerInterval: number;
    thumbnailMaxOutputSize: number;
    thumbnailMaxPixels: number;
    thumbnailTimeout: number;
}>;
