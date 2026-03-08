// FNV-1a 64bit ハッシュ（サーバ側 Go の hash/fnv と同一アルゴリズム）
export function fnv1a64(data: Uint8Array): bigint {
    let h = 0xcbf29ce484222325n;
    for (let i = 0; i < data.length; i++) {
        h ^= BigInt(data[i]);
        h = BigInt.asUintN(64, h * 0x100000001b3n);
    }
    return h;
}

// 64x64チャンク × 16x16セル = 1024x1024セル
export const CHUNK_SIZE = 16;
export const CHUNK_COUNT = 64;
export const WORLD_SIZE = 1024; // CHUNK_SIZE * CHUNK_COUNT
