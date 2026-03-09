#!/usr/bin/env node
/**
 * AOI (Area of Interest) 自動テスト
 *
 * テスト対象:
 *   1. クライアント側 AOI 計算ロジック (updateAOI 相当)
 *   2. サーバ側 containsChunk 判定ロジック
 *   3. サーバ側 AOI クランプ（境界値処理）
 *   4. setBlock:signal のターゲットフィルタリング
 *
 * 実行: node tesst/test-aoi.mjs
 */

// ─── 定数（GameScene.ts / main.go と同一） ───
const CHUNK_SIZE  = 16;
const CHUNK_COUNT = 64;
const WORLD_SIZE  = CHUNK_SIZE * CHUNK_COUNT; // 1024

// ─── テストユーティリティ ───
let passed = 0;
let failed = 0;

function assert(cond, msg) {
    if (cond) {
        passed++;
    } else {
        failed++;
        console.error(`  FAIL: ${msg}`);
    }
}

function assertEqual(actual, expected, msg) {
    if (actual === expected) {
        passed++;
    } else {
        failed++;
        console.error(`  FAIL: ${msg} — expected ${expected}, got ${actual}`);
    }
}

function assertDeepEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        passed++;
    } else {
        failed++;
        console.error(`  FAIL: ${msg}\n    expected: ${e}\n    actual:   ${a}`);
    }
}

// ─── 1. クライアント側 AOI 計算 (updateAOI 相当) ───

function calcAOI(playerX, playerZ, farClip) {
    const half = WORLD_SIZE / 2;  // 128
    const px = playerX + half;
    const pz = playerZ + half;
    const r = farClip;
    return {
        minCX: Math.max(0, Math.floor((px - r) / CHUNK_SIZE)),
        minCZ: Math.max(0, Math.floor((pz - r) / CHUNK_SIZE)),
        maxCX: Math.min(CHUNK_COUNT - 1, Math.floor((px + r) / CHUNK_SIZE)),
        maxCZ: Math.min(CHUNK_COUNT - 1, Math.floor((pz + r) / CHUNK_SIZE)),
    };
}

console.log("=== 1. クライアント AOI 計算テスト ===");

// 1-1: 原点(0,0) FarClip=200 → 一部（1024ワールドでは全体カバーしない）
{
    const aoi = calcAOI(0, 0, 200);
    // px=512, r=200 → minCX=floor(312/16)=19, maxCX=floor(712/16)=44
    assertEqual(aoi.minCX, 19, "1-1 minCX");
    assertEqual(aoi.maxCX, 44, "1-1 maxCX");
    assertEqual(aoi.minCZ, 19, "1-1 minCZ");
    assertEqual(aoi.maxCZ, 44, "1-1 maxCZ");
    console.log("  1-1 原点 FarClip=200:", JSON.stringify(aoi));
}

// 1-2: 原点(0,0) FarClip=50 → 狭い範囲
{
    const aoi = calcAOI(0, 0, 50);
    // px=512, r=50 → minCX=floor(462/16)=28, maxCX=floor(562/16)=35
    assertEqual(aoi.minCX, 28, "1-2 minCX");
    assertEqual(aoi.minCZ, 28, "1-2 minCZ");
    assertEqual(aoi.maxCX, 35, "1-2 maxCX");
    assertEqual(aoi.maxCZ, 35, "1-2 maxCZ");
    console.log("  1-2 原点 FarClip=50:", JSON.stringify(aoi));
}

// 1-3: 左端(-512, 0) FarClip=50 → minCX=0にクランプ
{
    const aoi = calcAOI(-512, 0, 50);
    // px=0, r=50 → floor(-50/16)=-4 → clamp 0
    assertEqual(aoi.minCX, 0, "1-3 minCX clamp at world edge");
    // floor(50/16)=3
    assertEqual(aoi.maxCX, 3, "1-3 maxCX");
    console.log("  1-3 左端 FarClip=50:", JSON.stringify(aoi));
}

// 1-4: 右端(511, 0) FarClip=50 → maxCX=63にクランプ
{
    const aoi = calcAOI(511, 0, 50);
    // px=1023, r=50 → floor(1073/16)=67 → clamp 63
    assertEqual(aoi.maxCX, 63, "1-4 maxCX clamp at world edge");
    // floor(973/16)=60
    assertEqual(aoi.minCX, 60, "1-4 minCX");
    console.log("  1-4 右端 FarClip=50:", JSON.stringify(aoi));
}

// 1-5: FarClip=10 (非常に狭い)
{
    const aoi = calcAOI(0, 0, 10);
    // px=512, r=10 → minCX=floor(502/16)=31, maxCX=floor(522/16)=32
    assertEqual(aoi.minCX, 31, "1-5 minCX narrow");
    assertEqual(aoi.maxCX, 32, "1-5 maxCX narrow");
    assertEqual(aoi.minCZ, 31, "1-5 minCZ narrow");
    assertEqual(aoi.maxCZ, 32, "1-5 maxCZ narrow");
    console.log("  1-5 原点 FarClip=10:", JSON.stringify(aoi));
}

// 1-6: FarClip=2000 (非常に広い) → 全チャンク
{
    const aoi = calcAOI(50, -30, 2000);
    assertDeepEqual(aoi, { minCX: 0, minCZ: 0, maxCX: 63, maxCZ: 63 }, "1-6 huge FarClip covers all");
    console.log("  1-6 FarClip=2000 (全範囲):", JSON.stringify(aoi));
}

// 1-7: チャンク境界ぴったり
{
    // px=512, r=48 → 464/16=29.0 → floor=29, 560/16=35.0 → floor=35
    const aoi = calcAOI(0, 0, 48);
    assertEqual(aoi.minCX, 29, "1-7 exact boundary minCX");
    assertEqual(aoi.maxCX, 35, "1-7 exact boundary maxCX");
    console.log("  1-7 境界ぴったり FarClip=48:", JSON.stringify(aoi));
}

// ─── 2. サーバ側 containsChunk ───

console.log("\n=== 2. サーバ側 containsChunk テスト ===");

function containsChunk(aoi, cx, cz) {
    return cx >= aoi.minCX && cx <= aoi.maxCX && cz >= aoi.minCZ && cz <= aoi.maxCZ;
}

// 2-1: AOI内
{
    const aoi = { minCX: 4, minCZ: 4, maxCX: 11, maxCZ: 11 };
    assert(containsChunk(aoi, 5, 5), "2-1 center chunk is inside");
    assert(containsChunk(aoi, 4, 4), "2-1 min corner is inside");
    assert(containsChunk(aoi, 11, 11), "2-1 max corner is inside");
    assert(containsChunk(aoi, 7, 7), "2-1 middle is inside");
    console.log("  2-1 AOI内のチャンク: OK");
}

// 2-2: AOI外
{
    const aoi = { minCX: 4, minCZ: 4, maxCX: 11, maxCZ: 11 };
    assert(!containsChunk(aoi, 3, 5), "2-2 left outside");
    assert(!containsChunk(aoi, 12, 5), "2-2 right outside");
    assert(!containsChunk(aoi, 5, 3), "2-2 top outside");
    assert(!containsChunk(aoi, 5, 12), "2-2 bottom outside");
    assert(!containsChunk(aoi, 0, 0), "2-2 origin outside");
    assert(!containsChunk(aoi, 63, 63), "2-2 far corner outside");
    console.log("  2-2 AOI外のチャンク: OK");
}

// 2-3: 全範囲AOI
{
    const aoi = { minCX: 0, minCZ: 0, maxCX: 63, maxCZ: 63 };
    assert(containsChunk(aoi, 0, 0), "2-3 full AOI origin");
    assert(containsChunk(aoi, 63, 63), "2-3 full AOI far corner");
    assert(containsChunk(aoi, 32, 32), "2-3 full AOI center");
    console.log("  2-3 全範囲AOI: OK");
}

// 2-4: 最小AOI (1チャンク)
{
    const aoi = { minCX: 7, minCZ: 7, maxCX: 7, maxCZ: 7 };
    assert(containsChunk(aoi, 7, 7), "2-4 single chunk inside");
    assert(!containsChunk(aoi, 6, 7), "2-4 single chunk left outside");
    assert(!containsChunk(aoi, 8, 7), "2-4 single chunk right outside");
    assert(!containsChunk(aoi, 7, 6), "2-4 single chunk top outside");
    assert(!containsChunk(aoi, 7, 8), "2-4 single chunk bottom outside");
    console.log("  2-4 最小AOI (1チャンク): OK");
}

// ─── 3. サーバ側 AOI クランプ ───

console.log("\n=== 3. サーバ側 AOI クランプテスト ===");

function clampAOI(minCX, minCZ, maxCX, maxCZ) {
    return {
        minCX: Math.max(0, minCX),
        minCZ: Math.max(0, minCZ),
        maxCX: Math.min(CHUNK_COUNT - 1, maxCX),
        maxCZ: Math.min(CHUNK_COUNT - 1, maxCZ),
    };
}

// 3-1: 負の値
{
    const aoi = clampAOI(-5, -3, 10, 10);
    assertEqual(aoi.minCX, 0, "3-1 negative minCX clamped");
    assertEqual(aoi.minCZ, 0, "3-1 negative minCZ clamped");
    assertEqual(aoi.maxCX, 10, "3-1 maxCX unchanged");
    console.log("  3-1 負のクランプ:", JSON.stringify(aoi));
}

// 3-2: 大きすぎる値
{
    const aoi = clampAOI(0, 0, 70, 80);
    assertEqual(aoi.maxCX, 63, "3-2 large maxCX clamped");
    assertEqual(aoi.maxCZ, 63, "3-2 large maxCZ clamped");
    console.log("  3-2 大きすぎる値のクランプ:", JSON.stringify(aoi));
}

// 3-3: 正常範囲
{
    const aoi = clampAOI(4, 4, 11, 11);
    assertDeepEqual(aoi, { minCX: 4, minCZ: 4, maxCX: 11, maxCZ: 11 }, "3-3 normal range unchanged");
    console.log("  3-3 正常範囲:", JSON.stringify(aoi));
}

// ─── 4. setBlock:signal ターゲットフィルタリング ───

console.log("\n=== 4. setBlock:signal ターゲットフィルタリングテスト ===");

function filterTargets(players, blockGX, blockGZ) {
    const cx = Math.floor(blockGX / CHUNK_SIZE);
    const cz = Math.floor(blockGZ / CHUNK_SIZE);
    const targets = [];
    for (const [sid, aoi] of Object.entries(players)) {
        if (containsChunk(aoi, cx, cz)) {
            targets.push(sid);
        }
    }
    return { cx, cz, targets, total: Object.keys(players).length };
}

// 4-1: 2プレイヤー、片方だけAOI内
{
    const players = {
        "tommie1": { minCX: 0, minCZ: 0, maxCX: 7, maxCZ: 7 },   // 左上半分
        "tommie2": { minCX: 8, minCZ: 8, maxCX: 63, maxCZ: 63 },  // 右下半分
    };
    // ブロック(10, 10) → chunk(0, 0) → tommie1のみ
    const r1 = filterTargets(players, 10, 10);
    assertEqual(r1.targets.length, 1, "4-1a targets=1");
    assertEqual(r1.targets[0], "tommie1", "4-1a only tommie1");
    console.log(`  4-1a block(10,10) chunk(${r1.cx},${r1.cz}) targets=${r1.targets.length}/${r1.total}: [${r1.targets}]`);

    // ブロック(200, 200) → chunk(12, 12) → tommie2のみ
    const r2 = filterTargets(players, 200, 200);
    assertEqual(r2.targets.length, 1, "4-1b targets=1");
    assertEqual(r2.targets[0], "tommie2", "4-1b only tommie2");
    console.log(`  4-1b block(200,200) chunk(${r2.cx},${r2.cz}) targets=${r2.targets.length}/${r2.total}: [${r2.targets}]`);
}

// 4-2: 両方AOI内
{
    const players = {
        "tommie1": { minCX: 0, minCZ: 0, maxCX: 10, maxCZ: 10 },
        "tommie2": { minCX: 5, minCZ: 5, maxCX: 63, maxCZ: 63 },
    };
    // ブロック(100, 100) → chunk(6, 6) → 両方
    const r = filterTargets(players, 100, 100);
    assertEqual(r.targets.length, 2, "4-2 both targets");
    console.log(`  4-2 block(100,100) chunk(${r.cx},${r.cz}) targets=${r.targets.length}/${r.total}: [${r.targets}]`);
}

// 4-3: 誰もAOI内にいない
{
    const players = {
        "tommie1": { minCX: 0, minCZ: 0, maxCX: 3, maxCZ: 3 },
        "tommie2": { minCX: 0, minCZ: 0, maxCX: 3, maxCZ: 3 },
    };
    // ブロック(200, 200) → chunk(12, 12) → 誰もいない
    const r = filterTargets(players, 200, 200);
    assertEqual(r.targets.length, 0, "4-3 no targets");
    console.log(`  4-3 block(200,200) chunk(${r.cx},${r.cz}) targets=${r.targets.length}/${r.total}`);
}

// 4-4: 3プレイヤー、AOI重複あり
{
    const players = {
        "p1": { minCX: 0, minCZ: 0, maxCX: 8, maxCZ: 8 },
        "p2": { minCX: 4, minCZ: 4, maxCX: 12, maxCZ: 12 },
        "p3": { minCX: 10, minCZ: 10, maxCX: 63, maxCZ: 63 },
    };
    // chunk(6,6) → p1, p2
    const r1 = filterTargets(players, 96, 96);
    assertEqual(r1.targets.length, 2, "4-4a p1+p2");
    assert(r1.targets.includes("p1"), "4-4a includes p1");
    assert(r1.targets.includes("p2"), "4-4a includes p2");
    console.log(`  4-4a chunk(${r1.cx},${r1.cz}) targets=${r1.targets.length}/${r1.total}: [${r1.targets}]`);

    // chunk(11,11) → p2, p3
    const r2 = filterTargets(players, 176, 176);
    assertEqual(r2.targets.length, 2, "4-4b p2+p3");
    assert(r2.targets.includes("p2"), "4-4b includes p2");
    assert(r2.targets.includes("p3"), "4-4b includes p3");
    console.log(`  4-4b chunk(${r2.cx},${r2.cz}) targets=${r2.targets.length}/${r2.total}: [${r2.targets}]`);
}

// ─── 5. AOI変化検出テスト ───

console.log("\n=== 5. AOI 変化検出テスト ===");

function aoiChanged(prev, next) {
    return prev.minCX !== next.minCX || prev.minCZ !== next.minCZ ||
           prev.maxCX !== next.maxCX || prev.maxCZ !== next.maxCZ;
}

// 5-1: 同じ位置 → 変化なし
{
    const a1 = calcAOI(0, 0, 50);
    const a2 = calcAOI(0, 0, 50);
    assert(!aoiChanged(a1, a2), "5-1 same position no change");
    console.log("  5-1 同じ位置: 変化なし");
}

// 5-2: 少し移動（チャンク内移動） → 変化なし
{
    const a1 = calcAOI(0, 0, 50);
    const a2 = calcAOI(1, 1, 50);  // 1ユニットだけ移動
    assert(!aoiChanged(a1, a2), "5-2 small move within chunk no change");
    console.log("  5-2 チャンク内移動: 変化なし");
}

// 5-3: チャンク境界を超える移動 → 変化あり
{
    const a1 = calcAOI(0, 0, 50);
    const a2 = calcAOI(16, 0, 50);  // 16ユニット（1チャンク分）移動
    assert(aoiChanged(a1, a2), "5-3 cross chunk boundary changes AOI");
    console.log("  5-3 チャンク境界越え移動: 変化あり");
    console.log(`    移動前: ${JSON.stringify(a1)}`);
    console.log(`    移動後: ${JSON.stringify(a2)}`);
}

// 5-4: FarClip変更 → 変化あり
{
    const a1 = calcAOI(0, 0, 50);
    const a2 = calcAOI(0, 0, 100);
    assert(aoiChanged(a1, a2), "5-4 FarClip change changes AOI");
    console.log("  5-4 FarClip変更: 変化あり");
    console.log(`    FarClip=50: ${JSON.stringify(a1)}`);
    console.log(`    FarClip=100: ${JSON.stringify(a2)}`);
}

// ─── 6. 距離テスト: 2プレイヤーがどのくらい離れたらAOIが分離するか ───

console.log("\n=== 6. 距離によるAOI分離テスト ===");

function findSeparationDistance(farClip) {
    // プレイヤー1を原点に固定、プレイヤー2を+X方向に移動
    const aoi1 = calcAOI(0, 0, farClip);
    for (let dx = 0; dx <= WORLD_SIZE; dx++) {
        const aoi2 = calcAOI(dx, 0, farClip);
        // aoi1.maxCX < aoi2.minCX なら完全分離
        if (aoi1.maxCX < aoi2.minCX) {
            return { dx, aoi1, aoi2 };
        }
    }
    return null;
}

for (const fc of [10, 50, 100, 200]) {
    const result = findSeparationDistance(fc);
    if (result) {
        console.log(`  FarClip=${fc}: ${result.dx}ユニット離れるとAOI分離`);
        console.log(`    p1: ${JSON.stringify(result.aoi1)}`);
        console.log(`    p2: ${JSON.stringify(result.aoi2)}`);
    } else {
        console.log(`  FarClip=${fc}: ワールド内では分離不可能（AOIが広すぎる）`);
    }
}

// FarClip=60でテスト（ユーザが以前テストに使った値）
{
    const result = findSeparationDistance(60);
    if (result) {
        assert(result.dx > 0, "6-1 separation distance is positive");
        console.log(`  FarClip=60: 分離距離=${result.dx}ユニット`);
    }
}

// ─── 結果 ───

console.log("\n========================================");
console.log(`結果: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
} else {
    console.log("ALL TESTS PASSED");
}
