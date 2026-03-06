#!/bin/bash
# Nakama Go プラグインをビルドするスクリプト
# nakama-pluginbuilder イメージを使って、Nakama サーバと同じ Go バージョンでコンパイルする

set -e

NAKAMA_VERSION="3.35.0"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/modules"
mkdir -p "$OUT_DIR"

docker run --rm \
  -v "$(cd "$(dirname "$0")" && pwd)":/go_src \
  -w /go_src \
  registry.heroiclabs.com/heroiclabs/nakama-pluginbuilder:${NAKAMA_VERSION} \
  sh -c "go mod download && go build -buildmode=plugin -trimpath -o /go_src/world.so ."

mv "$(cd "$(dirname "$0")" && pwd)/world.so" "$OUT_DIR/world.so"
echo "Built: $OUT_DIR/world.so"
