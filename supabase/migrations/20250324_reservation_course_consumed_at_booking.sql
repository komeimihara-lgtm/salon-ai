-- コース予約（回数券・サブスク）を予約作成時に消化した場合、来店時の二重計上を防ぐ
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS course_consumed_at_booking BOOLEAN DEFAULT false;

COMMENT ON COLUMN reservations.course_consumed_at_booking IS 'true: 回数券/サブスクの消化とsales計上を予約作成時に済ませた';
