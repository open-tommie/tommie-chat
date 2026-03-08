#!/bin/bash
# Nakama Go プラグインを再ビルドするスクリプト
# Nakama サーバと同じ Go バージョンでコンパイルするために、nakama-pluginbuilder イメージを使用する
cd ~/24-mmo-Tommie-chat/nakama/go_src && bash build.sh && cd .. && docker compose restart nakama


