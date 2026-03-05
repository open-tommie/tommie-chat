function rpcGetServerInfo(
    ctx: nkruntime.Context,
    _logger: nkruntime.Logger,
    _nk: nkruntime.Nakama,
    _payload: string
): string {
    var info = {
        name: ctx.node || "nakama",
        version: (ctx.env && ctx.env["NAKAMA_VERSION"]) || "unknown",
        serverTime: new Date().toISOString(),
    };
    return JSON.stringify(info);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function InitModule(
    _ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    _nk: nkruntime.Nakama,
    initializer: nkruntime.Initializer
): void {
    initializer.registerRpc("getServerInfo", rpcGetServerInfo);
    logger.info("server_info module loaded");
}
