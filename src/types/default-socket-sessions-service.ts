import type { WebSocket } from "ws";

export type SocketSession = {
    id: string;
    ownerId: string;
    webSocket: WebSocket | null;
    entities: Set<string>;
    timeout: NodeJS.Timeout | null;
    expiresAt: number;
    exp: number;
};
export type ConnectedSocketSession = SocketSession & { webSocket: WebSocket };
export type SocketSessionParams = { session: SocketSession };
export type SocketSessionMaybeParams = { session?: SocketSession };
export type SocketSessionDisconnectParams = SocketSessionMaybeParams & {
    webSocket: WebSocket;
    terminate?: boolean;
};
export type SocketSessionTouchParams = SocketSessionParams & { exp: number };
export type SocketSessionOwnerParams = { ownerId?: string };
export type SocketSessionRequiredOwnerParams = Required<SocketSessionOwnerParams>;
export type SocketSessionRelease = () => void;
