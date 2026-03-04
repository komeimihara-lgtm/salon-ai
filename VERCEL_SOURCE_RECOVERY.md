# Vercel完成版ソース取得手順

## 制約（技術的に不可能な点）

1. **Vercel API**: Git連携デプロイは「ファイルツリー」を持たない。APIの `GET /v6/deployments/{id}/files` は、**CLI/APIで `files` キーを使ってアップロードしたデプロイ**にのみ対応。Gitからビルドしたデプロイでは404になる。

2. **公開URLからの取得**: デプロイ済みURL（salon-3st28kfd4）はビルド後のHTML/JSのみ。React/Next.jsのソースコードは取得不可。

3. **Cursorの制限**: VercelダッシュボードのSourceタブにアクセスできない。

---

## 実行可能な解決策

### 方法A: 手動でSourceタブからコピー（推奨）

1. https://vercel.com にログイン
2. プロジェクト `salon-ai` → デプロイ `salon-3st28kfd4` を開く
3. **Source** タブを開く
4. 以下のフォルダの全ファイルをコピーして、ローカルリポジトリに上書き：
   - `app/`
   - `components/`
   - `lib/`
   - `public/`
   - `supabase/`
   - `types/`
5. **保持するファイル**（上書きしない）:
   - `app/api/counseling/speech/route.ts`（Google TTS版）
   - `.env.local`
6. 実行:
   ```bash
   git add .
   git commit -m "fix: 完成版ソースで完全上書き"
   git push origin main
   vercel --prod
   ```

### 方法B: Vercel APIトークンで試す（ファイルツリーがある場合のみ）

1. Vercel Dashboard → Settings → Tokens → Create Token
2. プロジェクトの `.env.local` に追加:
   ```
   VERCEL_TOKEN=your_token_here
   ```
3. 以下を実行:
   ```bash
   curl -H "Authorization: Bearer $VERCEL_TOKEN" \
     "https://api.vercel.com/v6/deployments/dpl_5ewpHnKmi6NkpVMZ45mXjK97amAC/files"
   ```
4. ファイル一覧が返れば、各ファイルの内容を `GET /v6/deployments/{id}/files/{fileId}` で取得可能。**Gitデプロイの場合は404になる可能性が高い。**

### 方法C: Git履歴から復元

完成版が過去のコミットに含まれている場合:

```bash
# 候補コミットを確認
git log --oneline

# 例: e2ba97a を復元
git checkout e2ba97a -- app/ components/ lib/
# speech route と .env.local は手動で保持
```

---

## デプロイ salon-3st28kfd4 の情報

- **Deployment ID**: `dpl_5ewpHnKmi6NkpVMZ45mXjK97amAC`
- **作成日時**: 2026-03-03 23:38:00 JST
- **注意**: このデプロイは first commit (23:57) より19分前。別ソース（テンプレート等）の可能性あり。
