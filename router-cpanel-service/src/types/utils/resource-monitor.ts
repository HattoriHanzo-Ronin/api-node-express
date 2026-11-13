export type ResourceMonitorDependencies = { reportHour: number; activeSessions: () => number };
export type ResourceSample = { cpuUsage: number; cpuLimit: number; memoryBytes: number; memoryLimit: number };
export type ResourcePeak = { value: number; sessions: number; timestamp: string };
