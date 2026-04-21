# HP（ホットペッパービューティー）連携 機能ガイド

SOLA の HP 連携は、**メール受信 ＋ スクレイピング** のダブル体制で
ホットペッパービューティー（以下 HP）の予約を SOLA に自動同期する機能です。

- **メール連携（メイン）**: HP 予約通知メールを SOLA の専用アドレスに転送
  → Claude が本文解析 → 即時 DB 登録 → LINE でオーナーに通知
- **スクレイピング（補完）**: メール受信時にサロンボードも自動巡回して
  変更・キャンセルを突き合わせ。単独の定期実行としても動作
- 同一予約は **重複排除ロジック** で 1 件しか登録されない

---

## 目次

1. [全体構成](#全体構成)
2. [運営者向け：初回セットアップ](#運営者向け初回セットアップ)
   - [1. DB マイグレーション](#1-db-マイグレーション)
   - [2. 環境変数の設定](#2-環境変数の設定)
   - [3. Resend Inbound Email 設定](#3-resend-inbound-email-設定)
   - [4. スクレイパーサービスのデプロイ](#4-スクレイパーサービスのデプロイ)
3. [サロン側：利用開始手順](#サロン側利用開始手順)
4. [日常運用](#日常運用)
5. [トラブルシューティング](#トラブルシューティング)
6. [重複排除の仕組み](#重複排除の仕組み)
7. [⚠️ 免責・規約上の注意](#️-免責規約上の注意)
8. [開発者向け API リファレンス](#開発者向け-api-リファレンス)

---

## 全体構成

```
┌──────────────────┐    ①転送    ┌───────────────────────┐
│ ホットペッパー    │ ─────────→ │ Resend Inbound         │
│ 予約通知メール    │             │ sync-<salonId>@sola-ai │
└──────────────────┘             └──────────┬────────────┘
                                              │ ②Webhook
                                              ▼
                                   ┌──────────────────────┐
                                   │ Next.js API           │
                                   │ /api/hp-sync/email    │
                                   │ - 本文を Claude で解析  │
                                   │ - 重複チェック           │
                                   │ - reservations に INSERT│
                                   │ - LINE で即時通知        │
                                   └──────────┬────────────┘
                                              │ ③補完起動
                                              ▼
                                   ┌──────────────────────┐
                                   │ 外部スクレイパ         │
                                   │ (Fly.io / AWS Lambda / │
                                   │  Browserbase)          │
                                   │ サロンボードに自動ログイン │
                                   │ → 7日間の予約一覧を取得  │
                                   └──────────┬────────────┘
                                              │ ④差分を取り込み
                                              ▼
                                   ┌──────────────────────┐
                                   │ SOLA（Supabase）      │
                                   │ reservations テーブル   │
                                   └──────────────────────┘
```

**所要時間**: HP 予約確定から SOLA 登録・LINE 通知まで **約 10〜60 秒**。

---

## 運営者向け：初回セットアップ

SOLA 本体のデプロイ担当者が 1 度だけ行う作業です。

### 1. DB マイグレーション

本番 Supabase に以下を流します（SQL エディタで実行）。

```sql
-- supabase/migrations/20260421_hp_sync.sql の内容をそのまま実行
ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS hp_email text,
  ADD COLUMN IF NOT EXISTS hp_password text,
  ADD COLUMN IF NOT EXISTS hp_sync_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hp_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS hp_sync_email text,
  ADD COLUMN IF NOT EXISTS owner_line_user_id text;

-- 以下省略（supabase/migrations/20260421_hp_sync.sql を参照）
```

既存サロンは `hp_sync_email` が自動で `sync-<id>@sola-ai.jp` でバックフィルされます。

### 2. 環境変数の設定

Vercel の Project → Settings → Environment Variables で以下を登録します。

| 変数名 | 用途 | 例・取得方法 |
|---|---|---|
| `HP_ENCRYPTION_KEY` | パスワード暗号化キー（必須） | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `HP_SYNC_EMAIL_DOMAIN` | 専用メールのドメイン | `sola-ai.jp` |
| `HP_SCRAPER_ENDPOINT` | 外部スクレイパのURL | `https://scraper.your-domain.com/` |
| `HP_SCRAPER_API_KEY` | スクレイパ認証キー | 32文字程度のランダム文字列を生成 |
| `RESEND_WEBHOOK_SECRET` | Resend webhookの認証 | 32文字程度のランダム文字列 |
| `HP_INTERNAL_TRIGGER_SECRET` | email→scrape 内部呼出しの認証 | 32文字程度のランダム文字列 |
| `NEXT_PUBLIC_APP_URL` | SOLA 本体のURL | `https://sola-ai.jp` |

⚠️ `HP_ENCRYPTION_KEY` は **一度設定したら変えない**こと。変更するとすべてのサロンのパスワードが復号不能になります。

### 3. Resend Inbound Email 設定

1. `sola-ai.jp` ドメインを所有していることを確認
2. Resend ダッシュボード → Domains で `sola-ai.jp` を追加
3. DNS で MX・SPF・DKIM レコードを設定（Resend 指示どおり）
4. Resend → Inbound Routing で以下を設定:
   - **Pattern**: `sync-*@sola-ai.jp`
   - **Webhook URL**: `https://sola-ai.jp/api/hp-sync/email`
   - **Custom headers**: `X-Webhook-Secret: <RESEND_WEBHOOK_SECRETの値>`
5. テスト配信で Webhook が 200 を返すことを確認

### 4. スクレイパーサービスのデプロイ

`scraper-service/` ディレクトリは **Vercel ではなく別インフラ** にデプロイします。
理由: Playwright は Vercel Function サイズ制限 (250MB) を超え、ログイン＋取得で 60 秒のタイムアウトも超えるため。

#### 推奨: Fly.io (日本リージョン)

```bash
cd scraper-service
fly launch --region nrt --name hp-scraper-<お好きな名前>
fly secrets set HP_SCRAPER_API_KEY=<上で設定した値>
fly deploy
```

#### 代替: AWS Lambda + chromium レイヤー

- `@sparticuz/chromium` 使用
- Lambda タイムアウト: 60 秒以上
- メモリ: 2GB 以上

#### 代替: Browserbase

マネージド版ブラウザサービス。最も安定するが有料。

#### デプロイ後の調整（必須）

`scraper-service/hp-scraper.ts` の DOM セレクタはプレースホルダです。
実際のサロンボードの HTML に合わせて以下を更新してください:

- `input[name="userId"]`, `input[name="password"]` (ログインフォーム)
- `[data-testid="reservation-row"]` など予約一覧の selector
- リクルート社の HTML は頻繁に変更されるため、**月1回程度のメンテナンス** を想定

デプロイ後、`HP_SCRAPER_ENDPOINT` を Vercel 側に登録して完了です。

---

## サロン側：利用開始手順

サロンオーナーが SOLA 設定画面から行う操作です。

### Step 1: LINE 連携を先に済ませる

HP 連携の新規予約通知は **LINE** で届きます。
設定ページの「LINE連携」セクションで LINE 連携を完了しておいてください。

### Step 2: HP ログイン情報を登録

1. SOLA にログインし、**設定 → HP連携** を開く
2. **「HP連携を有効化」** トグルを ON
3. **HPログインメールアドレス** と **HPログインパスワード** を入力
   - パスワードは AES-256 で暗号化して保存されます
   - 保存後は末尾 2 文字のみ表示されます（例: `●●●●●●ab`）
4. **「設定を保存」** ボタンをクリック

### Step 3: 専用メールアドレスを HP に転送設定

1. 画面に表示される **専用メールアドレス**（例: `sync-xxxxx@sola-ai.jp`）をコピー
2. HP から予約通知メールが届いているメールアドレス（GmailやOutlookなど）で、
   次の転送フィルタを作成:

   **条件**: 差出人が `@beauty.hotpepper.jp` のメール
   **処理**: `sync-xxxxx@sola-ai.jp` に自動転送

#### Gmail の場合

```
設定 → フィルタとブロック中のアドレス → 新しいフィルタを作成
From: *@beauty.hotpepper.jp
[フィルタを作成]
☑ 次のアドレスに転送する: sync-xxxxx@sola-ai.jp
```

#### Outlook の場合

```
設定 → メール → ルール → 新規ルール
差出人のアドレス 次を含む: beauty.hotpepper.jp
アクション: 転送先 sync-xxxxx@sola-ai.jp
```

### Step 4: 動作確認

1. 「**今すぐ同期**」ボタンを押してスクレイピング同期を実行
2. 「同期完了: 新規〇 / 更新〇」のトーストが出れば成功
3. HP にテスト予約を入れる → 数十秒後に LINE 通知が来れば OK

---

## 日常運用

### 自動同期のタイミング

- **メール経由**: HP で予約 or 変更 or キャンセルが発生した **瞬間** (10〜30秒)
- **スクレイピング経由**: メール受信時に自動で起動（補完）
  - 同一サロンへは **5 分に 1 回** が上限（レート制限）

### 設定画面の見方

| 表示 | 意味 |
|---|---|
| 最終同期: YYYY-MM-DD HH:MM | 直近の自動 or 手動同期の時刻 |
| 同期ログ（直近10件） | 同期元（メール/スクレイピング/手動）と結果 |
| 🟢 緑 | success: 新規登録・更新・キャンセル反映 |
| ⚪ グレー | duplicate: 既に SOLA にあり重複としてスキップ |
| 🟡 黄 | skipped: 条件未達（信頼度低い/連携OFF等） |
| 🔴 赤 | error: ログイン失敗や解析失敗 |

### LINE 通知の例

**新規予約時:**
```
📅 HPから新規予約が入りました！
👤 顧客名：山田 花子様
🕐 日時：2026-04-25 14:00
💆 メニュー：カット＋カラー

SOLAで確認してください。
```

**エラー時:**
```
⚠️ HP連携でエラーが発生しました
HPへのログインに失敗しました。連携を一時停止しました。

設定画面から再度ログイン情報をご確認ください。
```

### よくあるオペレーション

- **パスワードを変更したい**: 設定画面のパスワード欄に新しいパスワードを入れて保存
- **一時的に同期を止めたい**: 「HP連携を有効化」を OFF
- **強制的に取り直したい**: 「今すぐ同期」ボタン（レート制限バイパス）
- **同期ログを増やしたい**: 現状は直近 10 件のみ。必要なら運営に要相談

---

## トラブルシューティング

### Q. LINE通知が来ない

- LINE 連携が済んでいるか確認（設定ページ上部の LINE 連携）
- `salons.owner_line_user_id` が設定されているか確認（管理者向け）
- LINE の Messaging API アクセストークンが失効していないか

### Q. 「ログインに失敗しました」で連携が自動OFFになった

原因候補:
1. HP 側のパスワード変更 → 設定画面で入力し直す
2. HP のアカウントロック → HP にブラウザからログインして確認
3. HP がキャプチャを要求 → 一度ブラウザで解除
4. サロンボードの DOM 変更 → 運営側のスクレイパ更新が必要

再開方法: 設定で正しい情報を入れて「HP連携を有効化」を ON → 「今すぐ同期」

### Q. 予約が重複している

発生条件: メール側の `externalId` とスクレイピング側の `externalId` が異なる場合。
対応: SOLA 側で手動削除。ログを送ってもらえれば重複判定ロジックを調整可能。

### Q. 予約が反映されない

順にチェック:
1. **HP で予約が確定している**（仮予約ではない）か
2. 設定画面の同期ログに、その時刻のエラーが出ていないか
3. メール転送フィルタが正しく動いているか（Gmail の「送信済み」で確認）
4. 専用アドレスに直接メールを転送して 200 が返るか（管理者向け）

### Q. 同期ログが「low_confidence」で失敗

Claude による本文解析の信頼度が 0.3 未満。
原因: HP のメールテンプレートが変わった、or そもそも予約通知以外のメールが届いた。
対応: `lib/hp-sync/parser.ts` のシステムプロンプトを更新。

---

## 重複排除の仕組み

同じ予約が **メール と スクレイピング の両方** から入ってきても
SOLA には 1 件しか登録されません。判定優先度は以下の通りです:

1. **`hp_external_id` が一致**（HP の予約番号が同じ）
   → 即重複扱い
2. **予約日 ＋ 開始時刻 が完全一致** AND **顧客名の類似度 ≥ 0.8**
   → 重複扱い
3. **予約日 ＋ 開始時刻 が完全一致** AND **顧客名類似度 ≥ 0.6** AND **メニュー類似度 ≥ 0.6**
   → 重複扱い
4. それ以外 → 新規登録

類似度は bigram Dice 係数（0〜1）で算出。日本語は NFKC 正規化済み。

「変更」イベントが来た場合は既存行を **更新**、「キャンセル」は **status=cancelled**。

---

## ⚠️ 免責・規約上の注意

本機能のスクレイピング部分は **リクルート社の利用規約で禁止** されています。

- アクセス制限や HP アカウント BAN が発生する可能性があります
- 発生した場合、SOLA 提供側・サロン側いずれも リクルート社に対抗手段がない可能性があります
- **本機能を利用することで発生するいかなる損害についても SOLA 提供側は責任を負いません**

以下の対策は実装済みですが、**完全にリスクを排除するものではありません**:

- パスワードの AES-256-GCM 暗号化保存
- サロン毎 5 分のレート制限
- 800〜2200ms のランダムジッター
- User-Agent のローテーション
- ログイン失敗時の自動停止＋通知

**推奨**: メール連携のみの運用で開始し、スクレイピングは必要最小限にとどめる
（例: 夜間のキャンセル突き合わせのみ、など）。

サロンオーナーに対しては、利用開始時にこのリスクを説明し、
**書面またはアプリ内ダイアログで同意を取得する** ことを強く推奨します。

---

## 開発者向け API リファレンス

### `POST /api/hp-sync/email`

Resend Inbound Webhook。`X-Webhook-Secret` 必須。

**Body (Resend Inbound 形式):**
```json
{
  "type": "email.received",
  "data": {
    "to": [{ "address": "sync-<salonId>@sola-ai.jp" }],
    "subject": "【ホットペッパービューティー】予約確定のお知らせ",
    "text": "..."
  }
}
```

**Response:**
```json
{ "ok": true, "result": { "status": "inserted", "reservationId": "...", "message": "..." } }
```

### `POST /api/hp-sync/scrape`

外部スクレイパ呼び出し。以下のどちらかで認証:

- Cookie の `salon_id` （オーナー操作時）
- Header `X-Internal-Trigger: <HP_INTERNAL_TRIGGER_SECRET>` + body `{ salonId }` （email→scrape 内部呼び出し）

**Response:**
```json
{
  "ok": true,
  "total": 5,
  "inserted": 2,
  "updated": 1,
  "duplicate": 2,
  "cancelled": 0,
  "errored": 0
}
```

### `POST /api/hp-sync/manual`

「今すぐ同期」ボタン用。レート制限バイパス。認証: Cookie の `salon_id`。

### `GET /api/hp-sync/logs`

直近 10 件の同期ログ。

```json
{
  "logs": [
    {
      "id": "...",
      "source": "email" | "scrape" | "manual",
      "status": "success" | "error" | "skipped" | "duplicate",
      "message": "...",
      "created_at": "2026-04-21T10:00:00Z"
    }
  ]
}
```

### `GET / PATCH /api/settings/hp-sync`

HP 連携設定の読み書き。

**GET レスポンス:**
```json
{
  "hp_email": "salon@example.com",
  "hp_password_masked": "●●●●●●ab",
  "hp_password_set": true,
  "hp_sync_enabled": true,
  "hp_last_synced_at": "2026-04-21T10:00:00Z",
  "hp_sync_email": "sync-xxxxx@sola-ai.jp"
}
```

**PATCH Body (全て optional):**
```json
{
  "hp_email": "new@example.com",
  "hp_password": "new-password",
  "hp_sync_enabled": true
}
```

- `hp_password: ""` （空文字）でパスワードクリア
- `hp_password: undefined` （未指定）でパスワードは触らない

### 外部スクレイパ契約

`HP_SCRAPER_ENDPOINT` に対する POST:

**Request:**
```json
{
  "salonId": "uuid",
  "email": "salon@example.com",
  "password": "plaintext",
  "daysAhead": 7
}
```
Header: `X-Scraper-Api-Key: <HP_SCRAPER_API_KEY>`

**Response:**
```json
{
  "ok": true,
  "reservations": [
    {
      "externalId": "R12345",
      "customerName": "山田 花子",
      "customerNameKana": "ヤマダ ハナコ",
      "phone": "09012345678",
      "reservationDate": "2026-04-25",
      "startTime": "14:00",
      "endTime": "15:30",
      "menu": "カット＋カラー",
      "staffName": "田中",
      "price": 12000,
      "status": "confirmed"
    }
  ]
}
```

ログイン失敗時: `{ "ok": false, "loginFailed": true, "error": "invalid credentials" }`

---

## 関連ファイル

| パス | 役割 |
|---|---|
| `supabase/migrations/20260421_hp_sync.sql` | DB マイグレーション |
| `lib/hp-sync/crypto.ts` | AES-256-GCM 暗号化 |
| `lib/hp-sync/parser.ts` | Claude による本文解析 |
| `lib/hp-sync/dedup.ts` | 重複排除ロジック |
| `lib/hp-sync/import.ts` | 顧客/予約の共通取込処理 |
| `lib/hp-sync/scraper-client.ts` | 外部スクレイパ呼出し |
| `lib/hp-sync/line-notify.ts` | LINE 通知 |
| `lib/hp-sync/rate-limit.ts` | レート制限・ジッター・UA |
| `lib/hp-sync/sync-logger.ts` | 同期ログ記録 |
| `app/api/hp-sync/email/route.ts` | Resend Webhook |
| `app/api/hp-sync/scrape/route.ts` | スクレイプ実行 |
| `app/api/hp-sync/manual/route.ts` | 手動同期 |
| `app/api/hp-sync/logs/route.ts` | 同期ログ取得 |
| `app/api/settings/hp-sync/route.ts` | 設定の読み書き |
| `app/(salon)/settings/page.tsx` | 設定 UI（HP連携セクション） |
| `scraper-service/hp-scraper.ts` | 外部 Playwright サービス（参考実装） |
| `scraper-service/README.md` | スクレイパのデプロイ手順 |

---

_最終更新: 2026-04-21_
