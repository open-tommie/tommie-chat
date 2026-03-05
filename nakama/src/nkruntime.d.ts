declare namespace nkruntime {
    interface Context {
        node: string;
        env: Record<string, string>;
        [key: string]: unknown;
    }
    interface Logger {
        info(msg: string, ...args: unknown[]): void;
        warn(msg: string, ...args: unknown[]): void;
        error(msg: string, ...args: unknown[]): void;
    }
    interface Stream {
        mode: number;
        subject?: string;
        subcontext?: string;
        label?: string;
    }
    interface Nakama {
        streamCount(stream: Stream): number;
    }
    interface Initializer {
        registerRpc(id: string, fn: RpcFunction): void;
    }
    type RpcFunction = (
        ctx: Context,
        logger: Logger,
        nk: Nakama,
        payload: string
    ) => string | void;
}
