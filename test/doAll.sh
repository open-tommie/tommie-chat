#!/bin/bash
# 全テスト一括実行
# Usage: ./test/doAll.sh [-h]
case "${1:-}" in
    -h|--help)
        echo "Usage: $0"
        echo "  全テストスクリプトを順番に実行します"
        echo ""
        echo "  1. doTest-concurrent-login.sh  同時接続テスト (1/10/100/1000人)"
        echo "  2. doTest-sustain.sh           持続接続テスト (100人×90秒)"
        echo "  3. doTest-ccu-db.sh            同接履歴 DB永続化テスト"
        echo ""
        echo "  前提: nakama サーバが 127.0.0.1:7350 で起動していること"
        exit 0 ;;
esac

SCRIPT_DIR="$(dirname "$0")"
FAILED=0
PASSED=0
TOTAL=0
RESULTS=()

run_test() {
    local name="$1"
    shift
    TOTAL=$((TOTAL + 1))
    echo ""
    echo "========================================"
    echo "[$TOTAL] $name"
    echo "========================================"
    echo ""
    bash "$SCRIPT_DIR/$name" "$@"
    local rc=$?
    if [ $rc -eq 0 ]; then
        PASSED=$((PASSED + 1))
        RESULTS+=("✅ $name")
    else
        FAILED=$((FAILED + 1))
        RESULTS+=("❌ $name (exit=$rc)")
    fi
    return $rc
}

# 1. 同時接続テスト
run_test "doTest-concurrent-login.sh"

# サーバ側の切断処理完了を待つ
echo "  テスト間クールダウン (3秒)..."
sleep 3

# 2. 持続接続テスト
run_test "doTest-sustain.sh"

# サーバ側の切断処理完了を待つ
echo "  テスト間クールダウン (3秒)..."
sleep 3

# 3. 同接履歴 DB永続化テスト
run_test "doTest-ccu-db.sh"

# サマリー
echo ""
echo "========================================"
echo "全テスト結果: ${PASSED}/${TOTAL} passed"
echo "========================================"
for r in "${RESULTS[@]}"; do
    echo "  $r"
done
echo ""

if [ $FAILED -gt 0 ]; then
    echo "❌ ${FAILED}件のテストが失敗しました"
    exit 1
else
    echo "✅ 全テスト成功"
    exit 0
fi
