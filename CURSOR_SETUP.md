# SALON AI — Cursor セットアップ指示書

## プロジェクト概要
- **プロダクト名:** SALON AI（by LENARD Corporation）
- **技術スタック:** Next.js 14 / TypeScript / Tailwind CSS / Claude API / Supabase
- **現在のフェーズ:** Phase 1 MVP — LEO GRANT チャット稼働

---

## ファイル構成

```
salon-ai/
├── app/
│   ├── layout.tsx              # ルートレイアウト
│   ├── page.tsx                # / → /dashboard リダイレクト
│   ├── globals.css             # グローバルスタイル
│   ├── dashboard/
│   │   └── page.tsx            # ダッシュボードトップ
│   ├── leo/
│   │   └── page.tsx            # LEO GRANT チャットUI
│   └── api/
│       └── leo/
│           └── chat/
│               └── route.ts    # LEO GRANT API（Claude呼び出し）
├── components/
│   └── ui/
│       └── KPISummary.tsx      # KPIサマリーカード
├── lib/
│   └── leo.ts                  # デモデータ・システムプロンプト生成
├── types/
│   └── index.ts                # 型定義
├── .env.local.example          # 環境変数テンプレート
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## セットアップ手順

### 1. 依存パッケージインストール
```bash
npm install
```

### 2. 環境変数設定
```bash
cp .env.local.example .env.local
```
`.env.local` を開いて `ANTHROPIC_API_KEY` を設定する。

### 3. 開発サーバー起動
```bash
npm run dev
```

### 4. ブラウザで確認
- http://localhost:3000/dashboard — ダッシュボード
- http://localhost:3000/leo — LEO GRANT チャット

---

## 現在動作する機能

| 機能 | 状態 |
|---|---|
| LEO GRANT チャット | ✅ 動作中 |
| KPIサマリー表示 | ✅ 動作中（デモデータ） |
| ダッシュボードトップ | ✅ 動作中 |
| 顧客管理 | ⏸️ Phase 2 |
| 予約管理 | ⏸️ Phase 2 |
| KPI・売上管理 | ⏸️ Phase 2 |

---

## LEO GRANTの仕組み

1. `lib/leo.ts` の `DEMO_SALON` にサロンのKPIデータが入っている
2. `buildLeoSystemPrompt()` がKPIを読み込んだシステムプロンプトを生成
3. `app/api/leo/chat/route.ts` がClaude APIを呼び出す
4. `app/leo/page.tsx` がチャットUIを表示

**本番化する際は:**
- `DEMO_SALON` → Supabaseのサロンテーブルから取得に変更
- 認証（Supabase Auth）を追加してオーナーごとにデータを分離

---

## 次のステップ（Phase 2）

Cursorに以下を依頼する:

```
顧客管理機能を実装してください。

1. Supabaseに以下のテーブルを作成:
   - salons（サロン情報）
   - customers（顧客カルテ）
   - visits（来店履歴）

2. app/customers/page.tsx を作成:
   - 顧客一覧（検索・絞り込み）
   - 顧客カルテ詳細
   - 新規顧客登録フォーム

3. ペンギン（サロンズソリューション）からのCSVインポート機能:
   - app/api/customers/import/route.ts
   - CSVのカラム自動マッピング
```
