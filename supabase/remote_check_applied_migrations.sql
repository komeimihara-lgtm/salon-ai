-- Supabase SQL Editor で実行し、リモートに適用済みのマイグレーションと照合する。
-- 期待するファイル一覧: supabase/REPO_MIGRATION_ORDER.txt（リポジトリ直下の49件）
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
