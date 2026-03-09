# tommieChat

ブラウザで動く3D MMOチャットゲームです。
Babylon.js + Nakama で構築されたリアルタイムマルチプレイヤー環境で、ブロックを置いたりチャットしたりできます。

## スクリーンショット

（準備中）

## 特徴

- ブラウザだけで動作（インストール不要）
- 3Dワールドでリアルタイムチャット
- ブロック配置によるワールド編集
- 複数ユーザーの同時接続に対応
- デバイス認証によるかんたんログイン

## 技術スタック

| 項目 | 技術 |
|---|---|
| 3Dエンジン | [Babylon.js](https://www.babylonjs.com/) 8.x |
| ゲームサーバー | [Nakama](https://heroiclabs.com/nakama/) 3.35 |
| サーバーロジック | Go |
| フロントエンド | TypeScript |
| ビルドツール | Vite |
| データベース | PostgreSQL 16 |
| コンテナ | Docker Compose |

## 必要な環境

- Node.js v24 LTS
- Docker / Docker Compose
- Go（サーバープラグインのビルドに必要）

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/open-tommie/tommieChat.git
cd tommieChat
```

### 2. クライアント（フロントエンド）

```bash
npm install
npx vite
```

ブラウザで http://localhost:5173 を開きます。

### 3. サーバー（Nakama）

```bash
cd nakama

# 環境変数の設定
cp .env.example .env

# Go プラグインのビルド
cd go_src && bash build.sh && cd ..

# サーバー起動
docker compose up -d
```

### 4. 本番ビルド

```bash
npm run build
```

`dist/` にビルド成果物が出力されます。

## ポート番号

| ポート | 用途 |
|---|---|
| 5173 | Vite 開発サーバー |
| 7350 | Nakama クライアント API |
| 7351 | Nakama 管理ダッシュボード |
| 5432 | PostgreSQL |
| 9090 | Prometheus |

## 操作方法

- **ログイン**: ユーザIDを入力してログインボタン
- **ブロック配置**: Bキー + クリック
- **チャット**: 下部のテキスト入力欄からメッセージ送信

## ディレクトリ構成

```text
tommieChat/
├── src/                # クライアント側ソースコード (TypeScript)
│   ├── main.ts         # エントリーポイント
│   ├── GameScene.ts    # Babylon.js ゲームシーン
│   ├── NakamaService.ts# Nakama サーバー通信
│   ├── UIPanel.ts      # UI パネル
│   └── DebugOverlay.ts # デバッグツール
├── public/             # 静的アセット
│   └── textures/       # テクスチャ (.ktx2)
├── nakama/             # サーバー側
│   ├── docker-compose.yml
│   ├── go_src/         # Go サーバープラグイン
│   └── nginx.conf
├── index.html          # メイン HTML
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 貢献

[CONTRIBUTING.md](CONTRIBUTING.md) をご覧ください。

## ライセンス

[MIT License](LICENSE)

## 作者

- tommie.jp
- X: [@tommie_nico](https://x.com/tommie_nico)
