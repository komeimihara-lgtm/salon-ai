-- 反響アーカイブ機能用カラム追加
ALTER TABLE content_plans 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archive_memo TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS archive_metrics JSONB DEFAULT '{}';
