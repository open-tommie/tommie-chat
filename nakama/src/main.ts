var serverUpTime = new Date().toISOString();

// チャットルーム "world" (type=Room) のストリーム定数
var STREAM_MODE_CHANNEL = 2;
var CHAT_ROOM_LABEL = "world";

// 地面テーブル (100x100、6バイト/セル: lo,hi,R,G,B,A)
var GROUND_SIZE = 100;
var OP_BLOCK_UPDATE = 4;
var groundTable = new Uint8Array(GROUND_SIZE * GROUND_SIZE * 6);

var GROUND_COLLECTION = "world_data";
var GROUND_KEY        = "ground_table";

function getCell(gx: number, gz: number): { blockId: number; r: number; g: number; b: number; a: number } {
    var i = (gx * GROUND_SIZE + gz) * 6;
    return { blockId: groundTable[i] | (groundTable[i+1] << 8), r: groundTable[i+2], g: groundTable[i+3], b: groundTable[i+4], a: groundTable[i+5] };
}

function setCell(gx: number, gz: number, blockId: number, r: number, g: number, b: number, a: number): void {
    var i = (gx * GROUND_SIZE + gz) * 6;
    groundTable[i]   = blockId & 0xFF;
    groundTable[i+1] = (blockId >> 8) & 0xFF;
    groundTable[i+2] = r; groundTable[i+3] = g; groundTable[i+4] = b; groundTable[i+5] = a;
}

function saveGroundTable(nk: nkruntime.Nakama, logger: nkruntime.Logger): void {
    try {
        var flat: number[] = [];
        for (var fi = 0; fi < groundTable.length; fi++) flat.push(groundTable[fi]);
        nk.storageWrite([{
            collection: GROUND_COLLECTION,
            key: GROUND_KEY,
            userId: SYSTEM_USER_ID,
            value: { table: flat },
            permissionRead: 2,
            permissionWrite: 1,
        }]);
    } catch (e) {
        logger.warn("saveGroundTable failed: " + e);
    }
}

function rpcSetBlock(
    _ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string {
    var req = JSON.parse(payload) as { gx: number; gz: number; blockId: number; r: number; g: number; b: number; a: number };
    var gx = req.gx, gz = req.gz, blockId = req.blockId;
    var r = req.r || 0, g = req.g || 0, b = req.b || 0, a = (req.a !== undefined && req.a !== 0) ? req.a : 255;
    if (gx < 0 || gx >= GROUND_SIZE || gz < 0 || gz >= GROUND_SIZE) {
        throw new Error("setBlock: out of bounds gx=" + gx + " gz=" + gz);
    }
    setCell(gx, gz, blockId, r, g, b, a);
    saveGroundTable(nk, logger);

    // ワールドマッチへシグナルを送信 → worldMatchSignal が全員へブロードキャスト
    try {
        var active = nk.matchList(1, true, "world", null, null, "");
        if (active && active.length > 0) {
            (nk as any).matchSignal(active[0].matchId, JSON.stringify({ gx: gx, gz: gz, blockId: blockId, r: r, g: g, b: b, a: a }));
        }
    } catch (e) {
        logger.warn("setBlock matchSignal failed: " + e);
    }
    return "{}";
}

function rpcGetGroundTable(
    _ctx: nkruntime.Context,
    _logger: nkruntime.Logger,
    _nk: nkruntime.Nakama,
    _payload: string
): string {
    var flat: number[] = [];
    for (var i = 0; i < groundTable.length; i++) flat.push(groundTable[i]);
    return JSON.stringify({ table: flat }); // 6バイト/セル
}

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

var WORLD_COLLECTION = "world_state";
var WORLD_KEY        = "match_id";
var SYSTEM_USER_ID   = "00000000-0000-0000-0000-000000000000";

function rpcGetWorldMatch(
    _ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    _payload: string
): string {
    // 稼動中のマッチを matchList で探す（Storage は再起動後に古くなるため使わない）
    try {
        var active = nk.matchList(1, true, "world", null, null, "");
        if (active && active.length > 0) {
            var activeId = active[0].matchId;
            logger.info("Found active world match: " + activeId);
            return JSON.stringify({ matchId: activeId });
        }
    } catch (e) {
        logger.warn("matchList failed: " + e);
    }

    // 存在しなければ新規作成
    var matchId = nk.matchCreate("world", {});
    logger.info("Created world match: " + matchId);
    return JSON.stringify({ matchId: matchId });
}

// ワールドマッチハンドラ — Nakamaはトップレベル関数を参照する必要がある
function worldMatchInit(
    _ctx: nkruntime.Context,
    _logger: nkruntime.Logger,
    _nk: nkruntime.Nakama,
    _params: { [key: string]: string }
) {
    return { state: {}, tickRate: 10, label: "world" };
}

function worldMatchJoinAttempt(
    _ctx: nkruntime.Context,
    _logger: nkruntime.Logger,
    _nk: nkruntime.Nakama,
    _dispatcher: nkruntime.MatchDispatcher,
    _tick: number,
    state: object,
    _presence: nkruntime.MatchPresence,
    _metadata: { [key: string]: string }
) {
    return { state: state, accept: true };
}

function worldMatchJoin(
    _ctx: nkruntime.Context,
    _logger: nkruntime.Logger,
    _nk: nkruntime.Nakama,
    _dispatcher: nkruntime.MatchDispatcher,
    _tick: number,
    state: object,
    _presences: nkruntime.MatchPresence[]
) {
    return { state: state };
}

function worldMatchLeave(
    _ctx: nkruntime.Context,
    _logger: nkruntime.Logger,
    _nk: nkruntime.Nakama,
    _dispatcher: nkruntime.MatchDispatcher,
    _tick: number,
    state: object,
    _presences: nkruntime.MatchPresence[]
) {
    return { state: state };
}

function worldMatchLoop(
    _ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    _nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    _tick: number,
    state: object,
    messages: nkruntime.MatchMessage[]
) {
    try {
        var msgs = messages || [];
        for (var i = 0; i < msgs.length; i++) {
            var msg = msgs[i];
            dispatcher.broadcastMessage(msg.opCode, msg.data, null, msg.sender, true);
        }
    } catch (e) {
        logger.warn("worldMatchLoop error: " + e);
    }
    return { state: state };
}

function worldMatchTerminate(
    _ctx: nkruntime.Context,
    _logger: nkruntime.Logger,
    _nk: nkruntime.Nakama,
    _dispatcher: nkruntime.MatchDispatcher,
    _tick: number,
    state: object,
    _graceSeconds: number
) {
    return { state: state };
}

function worldMatchSignal(
    _ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    _nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    _tick: number,
    state: object,
    data: string
) {
    // ブロック更新シグナルを全プレイヤーへブロードキャスト
    try {
        dispatcher.broadcastMessage(OP_BLOCK_UPDATE, data, null, null, false);
    } catch (e) {
        logger.warn("worldMatchSignal broadcastMessage failed: " + e);
    }
    return { state: state, data: data };
}

function rpcPing(
    _ctx: nkruntime.Context,
    _logger: nkruntime.Logger,
    _nk: nkruntime.Nakama,
    _payload: string
): string {
    return "{}";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function InitModule(
    _ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    initializer: nkruntime.Initializer
): void {
    // 地面テーブルをストレージから復元
    try {
        var stored = nk.storageRead([{ collection: GROUND_COLLECTION, key: GROUND_KEY, userId: SYSTEM_USER_ID }]);
        if (stored && stored.length > 0) {
            var val = stored[0].value as { table?: number[] };
            if (val && val.table) {
                if (val.table.length === GROUND_SIZE * GROUND_SIZE * 6) {
                    // 新フォーマット (6バイト/セル)
                    for (var i = 0; i < val.table.length; i++) groundTable[i] = val.table[i];
                    logger.info("ground_table loaded from storage (new format)");
                } else if (val.table.length === GROUND_SIZE * GROUND_SIZE) {
                    // 旧フォーマット (blockIDのみ)
                    for (var j = 0; j < val.table.length; j++) {
                        var base = j * 6;
                        var oldId = val.table[j];
                        groundTable[base]   = oldId & 0xFF;
                        groundTable[base+1] = (oldId >> 8) & 0xFF;
                        groundTable[base+2] = 51; groundTable[base+3] = 102; groundTable[base+4] = 255; groundTable[base+5] = 255;
                    }
                    logger.info("ground_table loaded from storage (old format)");
                }
            }
        }
    } catch (e) {
        logger.warn("failed to load ground_table: " + e);
    }

    initializer.registerMatch("world", {
        matchInit: worldMatchInit,
        matchJoinAttempt: worldMatchJoinAttempt,
        matchJoin: worldMatchJoin,
        matchLeave: worldMatchLeave,
        matchLoop: worldMatchLoop,
        matchTerminate: worldMatchTerminate,
        matchSignal: worldMatchSignal,
    });
    initializer.registerRpc("getServerInfo", rpcGetServerInfo);
    initializer.registerRpc("getWorldMatch", rpcGetWorldMatch);
    initializer.registerRpc("ping", rpcPing);
    // setBlock / getGroundTable は Go プラグインが処理するため登録しない
    logger.info("server_info module loaded");
}
