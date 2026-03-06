package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

var serverUpTime = time.Now().UTC().Format(time.RFC3339)

const (
	streamModeChannel uint8 = 2
	chatRoomLabel           = "world"
	groundSize              = 100
	opBlockUpdate     int64 = 4
)

// 地面セル: blockID (uint16) + RGBA 各1バイト
type blockData struct {
	BlockID    uint16
	R, G, B, A uint8
}

// 地面テーブル: groundTable[gx][gz]
var (
	groundMu    sync.RWMutex
	groundTable [groundSize][groundSize]blockData
)

// groundTableToFlat: 6バイト/セル (lo,hi,R,G,B,A) へ変換。呼び出し元がRLock保持
func groundTableToFlat() []uint8 {
	flat := make([]uint8, groundSize*groundSize*6)
	for gx := 0; gx < groundSize; gx++ {
		for gz := 0; gz < groundSize; gz++ {
			i := (gx*groundSize + gz) * 6
			c := groundTable[gx][gz]
			flat[i] = uint8(c.BlockID & 0xFF)
			flat[i+1] = uint8(c.BlockID >> 8)
			flat[i+2] = c.R
			flat[i+3] = c.G
			flat[i+4] = c.B
			flat[i+5] = c.A
		}
	}
	return flat
}

// groundTableFromFlat: 6バイト/セル の []uint8 から復元
func groundTableFromFlat(flat []uint8) bool {
	if len(flat) != groundSize*groundSize*6 {
		return false
	}
	groundMu.Lock()
	defer groundMu.Unlock()
	for gx := 0; gx < groundSize; gx++ {
		for gz := 0; gz < groundSize; gz++ {
			i := (gx*groundSize + gz) * 6
			groundTable[gx][gz] = blockData{
				BlockID: uint16(flat[i]) | uint16(flat[i+1])<<8,
				R: flat[i+2], G: flat[i+3], B: flat[i+4], A: flat[i+5],
			}
		}
	}
	return true
}

// groundTableFromFlatOld: 旧フォーマット (blockIDのみ uint16 x 10000) から復元
func groundTableFromFlatOld(old []uint16) {
	groundMu.Lock()
	defer groundMu.Unlock()
	for gx := 0; gx < groundSize; gx++ {
		for gz := 0; gz < groundSize; gz++ {
			groundTable[gx][gz] = blockData{BlockID: old[gx*groundSize+gz], R: 51, G: 102, B: 255, A: 255}
		}
	}
}

// rpcGetServerInfo はサーバ情報（ノード名・バージョン・起動時刻・プレイヤー数）を返す
func rpcGetServerInfo(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	playerCount, err := nk.StreamCount(streamModeChannel, "", "", chatRoomLabel)
	if err != nil {
		logger.Warn("StreamCount error: %v", err)
		playerCount = 0
	}

	env, _ := ctx.Value(runtime.RUNTIME_CTX_ENV).(map[string]string)
	node, _ := ctx.Value(runtime.RUNTIME_CTX_NODE).(string)

	version := "unknown"
	if v, ok := env["NAKAMA_VERSION"]; ok {
		version = v
	}

	info := map[string]interface{}{
		"name":         node,
		"version":      version,
		"serverUpTime": serverUpTime,
		"playerCount":  playerCount,
	}
	b, err := json.Marshal(info)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// rpcGetWorldMatch は稼働中の "world" マッチを探し、なければ新規作成して返す
func rpcGetWorldMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	matches, err := nk.MatchList(ctx, 1, true, "world", nil, nil, "")
	if err != nil {
		logger.Warn("MatchList failed: %v", err)
	} else if len(matches) > 0 {
		matchID := matches[0].GetMatchId()
		logger.Info("Found active world match: %s", matchID)
		b, _ := json.Marshal(map[string]string{"matchId": matchID})
		return string(b), nil
	}

	matchID, err := nk.MatchCreate(ctx, "world", map[string]interface{}{})
	if err != nil {
		return "", err
	}
	logger.Info("Created world match: %s", matchID)
	b, _ := json.Marshal(map[string]string{"matchId": matchID})
	return string(b), nil
}

// worldMatch は Nakama マッチハンドラの実装
type worldMatch struct{}

func (m *worldMatch) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	return map[string]interface{}{}, 10, "world"
}

func (m *worldMatch) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	return state, true, ""
}

func (m *worldMatch) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	return state
}

func (m *worldMatch) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	return state
}

func (m *worldMatch) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	for _, msg := range messages {
		if err := dispatcher.BroadcastMessage(msg.GetOpCode(), msg.GetData(), nil, msg, true); err != nil {
			logger.Warn("BroadcastMessage error: %v", err)
		}
	}
	return state
}

func (m *worldMatch) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	return state
}

func (m *worldMatch) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	// ブロック更新シグナルを全プレイヤーへブロードキャスト
	if err := dispatcher.BroadcastMessage(opBlockUpdate, []byte(data), nil, nil, false); err != nil {
		logger.Warn("MatchSignal BroadcastMessage error: %v", err)
	}
	return state, data
}

// rpcPing はクライアントのラウンドトリップ時間計測用 RPC
func rpcPing(_ context.Context, _ runtime.Logger, _ *sql.DB, _ runtime.NakamaModule, _ string) (string, error) {
	return "{}", nil
}

type blockReq struct {
	GX      int    `json:"gx"`
	GZ      int    `json:"gz"`
	BlockID uint16 `json:"blockId"`
	R       uint8  `json:"r"`
	G       uint8  `json:"g"`
	B       uint8  `json:"b"`
	A       uint8  `json:"a"`
}

// dumpGroundTableCSV は地面テーブルを /nakama/data/log/groundTable.csv に書き出す
func dumpGroundTableCSV(logger runtime.Logger) {
	const path = "/nakama/data/log/groundTable.csv"
	if err := os.MkdirAll("/nakama/data/log", 0755); err != nil {
		logger.Warn("dumpGroundTableCSV MkdirAll: %v", err)
		return
	}
	groundMu.RLock()
	var sb strings.Builder
	for gz := 0; gz < groundSize; gz++ {
		cols := make([]string, groundSize)
		for gx := 0; gx < groundSize; gx++ {
			c := groundTable[gx][gz]
			cols[gx] = fmt.Sprintf("%d", c.BlockID)
		}
		sb.WriteString(strings.Join(cols, ","))
		sb.WriteByte('\n')
	}
	groundMu.RUnlock()
	if err := os.WriteFile(path, []byte(sb.String()), 0644); err != nil {
		logger.Warn("dumpGroundTableCSV WriteFile: %v", err)
	}
}

const (
	groundCollection = "world_data"
	groundKey        = "ground_table"
	systemUserID     = "00000000-0000-0000-0000-000000000000"
)

// flatToInts は []uint8 を JSON 数値配列として出力するための []int に変換する
// Go の json.Marshal は []uint8 を base64 文字列にしてしまうため必要
func flatToInts(flat []uint8) []int {
	ints := make([]int, len(flat))
	for i, v := range flat {
		ints[i] = int(v)
	}
	return ints
}

func saveGroundTableToStorage(ctx context.Context, nk runtime.NakamaModule, logger runtime.Logger) {
	groundMu.RLock()
	flat := groundTableToFlat()
	groundMu.RUnlock()
	data, err := json.Marshal(struct {
		Table []int `json:"table"`
	}{Table: flatToInts(flat)})
	if err != nil {
		logger.Warn("saveGroundTable marshal: %v", err)
		return
	}
	if _, err := nk.StorageWrite(ctx, []*runtime.StorageWrite{{
		Collection:      groundCollection,
		Key:             groundKey,
		UserID:          systemUserID,
		Value:           string(data),
		PermissionRead:  2,
		PermissionWrite: 1,
	}}); err != nil {
		logger.Warn("saveGroundTable StorageWrite: %v", err)
	}
}

// rpcSetBlock はブロックを地面テーブルに書き込み、全プレイヤーへ通知する
func rpcSetBlock(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var req blockReq
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		return "", err
	}
	if req.GX < 0 || req.GX >= groundSize || req.GZ < 0 || req.GZ >= groundSize {
		return "", fmt.Errorf("setBlock: out of bounds gx=%d gz=%d", req.GX, req.GZ)
	}
	a := req.A
	if a == 0 {
		a = 255
	}
	groundMu.Lock()
	groundTable[req.GX][req.GZ] = blockData{BlockID: req.BlockID, R: req.R, G: req.G, B: req.B, A: a}
	groundMu.Unlock()
	saveGroundTableToStorage(ctx, nk, logger)
	dumpGroundTableCSV(logger)

	// ワールドマッチへシグナル送信
	matches, err := nk.MatchList(ctx, 1, true, "world", nil, nil, "")
	if err != nil || len(matches) == 0 {
		return "{}", nil
	}
	sigData, _ := json.Marshal(req)
	if _, err := nk.MatchSignal(ctx, matches[0].GetMatchId(), string(sigData)); err != nil {
		logger.Warn("setBlock MatchSignal error: %v", err)
	}
	return "{}", nil
}

// rpcGetGroundTable は現在の地面テーブルを6バイト/セルのフラット配列で返す
func rpcGetGroundTable(_ context.Context, _ runtime.Logger, _ *sql.DB, _ runtime.NakamaModule, _ string) (string, error) {
	groundMu.RLock()
	flat := groundTableToFlat()
	groundMu.RUnlock()
	b, err := json.Marshal(map[string]interface{}{"table": flatToInts(flat)})
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// InitModule は Nakama プラグインのエントリポイント
func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	// ストレージから地面テーブルを復元
	objs, err := nk.StorageRead(ctx, []*runtime.StorageRead{{
		Collection: groundCollection,
		Key:        groundKey,
		UserID:     systemUserID,
	}})
	if err != nil {
		logger.Warn("InitModule StorageRead error: %v", err)
	} else if len(objs) > 0 {
		// 新フォーマット: table = []int (6バイト/セル, JSON数値配列)
		var newData struct {
			Table []int `json:"table"`
		}
		if err := json.Unmarshal([]byte(objs[0].Value), &newData); err == nil && len(newData.Table) == groundSize*groundSize*6 {
			flat8 := make([]uint8, len(newData.Table))
			for i, v := range newData.Table {
				flat8[i] = uint8(v)
			}
			if groundTableFromFlat(flat8) {
				logger.Info("ground_table loaded from storage (new format, %d cells)", groundSize*groundSize)
			}
		} else {
			// 旧フォーマット: table = []uint16 (blockIDのみ)
			var oldData struct {
				Table []uint16 `json:"table"`
			}
			if err2 := json.Unmarshal([]byte(objs[0].Value), &oldData); err2 == nil && len(oldData.Table) == groundSize*groundSize {
				groundTableFromFlatOld(oldData.Table)
				logger.Info("ground_table loaded from storage (old format, %d blocks)", groundSize*groundSize)
			}
		}
	}

	if err := initializer.RegisterMatch("world", func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
		return &worldMatch{}, nil
	}); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("getServerInfo", rpcGetServerInfo); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("getWorldMatch", rpcGetWorldMatch); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("ping", rpcPing); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("setBlock", rpcSetBlock); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("getGroundTable", rpcGetGroundTable); err != nil {
		return err
	}
	logger.Info("server_info module loaded")
	return nil
}
