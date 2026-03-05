-- ============================================================
-- 予約アクション対応マイグレーション
-- - reservations: visited, rescheduled ステータス追加
-- - customers: no_show_count カラム追加
-- ============================================================

-- reservations の status に 'visited', 'rescheduled' を追加
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show', 'visited', 'rescheduled'));

-- customers に no_show_count カラムを追加
ALTER TABLE customers ADD COLUMN IF NOT EXISTS no_show_count INTEGER DEFAULT 0;
