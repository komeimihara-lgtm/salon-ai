-- salons テーブルに beds カラムを追加
ALTER TABLE salons
ADD COLUMN IF NOT EXISTS beds JSONB DEFAULT '["A","B"]';
