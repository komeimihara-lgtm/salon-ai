-- reservations に bed_id と duration_minutes を追加
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS bed_id TEXT DEFAULT 'bed-1';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
