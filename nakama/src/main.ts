var serverUpTime = new Date().toISOString();

// チャットルーム "world" (type=Room) のストリーム定数
var STREAM_MODE_CHANNEL = 2;
var CHAT_ROOM_LABEL = "world";

function rpcGetServerInfo(
    ctx: nkruntime.Context,
    _logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    _payload: string
): string {
    var playerCount = nk.streamCount({ mode: STREAM_MODE_CHANNEL, label: CHAT_ROOM_LABEL });
    var info = {
        name: ctx.node || "nakama",
        version: (ctx.env && ctx.env["NAKAMA_VERSION"]) || "unknown",
        serverUpTime: serverUpTime,
        playerCount: playerCount,
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
