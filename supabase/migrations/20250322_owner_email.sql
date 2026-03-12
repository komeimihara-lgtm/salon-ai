-- salonsテーブルにowner_emailカラム追加
ALTER TABLE salons ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- salonsテーブルにstatusカラム追加（demo / active / suspended）
ALTER TABLE salons ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
