-- リモートが 202603 系マイグレーション未適用の場合の手動適用用（idempotent な DDL のみ再掲）。
-- 適用前に remote_check_applied_migrations.sql で version を確認すること。
-- 元ファイル: 20260324_counseling_karte.sql, 20260326_salons_email_postal_contracts_cooling_off.sql

-- === 20260324_counseling_karte.sql ===
ALTER TABLE counseling_sessions ADD COLUMN IF NOT EXISTS karte_data JSONB;
ALTER TABLE counseling_sessions ADD COLUMN IF NOT EXISTS visit_date DATE DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_counseling_sessions_customer_created
  ON counseling_sessions (customer_id, created_at DESC);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS counseling_memo JSONB DEFAULT '[]'::jsonb;

-- === 20260326_salons_email_postal_contracts_cooling_off.sql ===
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS postal_code TEXT;
COMMENT ON COLUMN public.salons.email IS '店舗連絡用メール（クーリングオフの電磁的記録受付等）';
COMMENT ON COLUMN public.salons.postal_code IS '郵便番号（表示用、ハイフンあり推奨）';

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS cooling_off_email TEXT;
COMMENT ON COLUMN public.contracts.cooling_off_email IS '契約作成時のクーリングオフ電磁的記録受付メール（salons.email をスナップショット）';
