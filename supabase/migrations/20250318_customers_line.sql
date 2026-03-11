-- LINE連携用カラム追加
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS line_user_id TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS line_followed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS line_status TEXT DEFAULT 'none';
-- line_status: none / followed / blocked
