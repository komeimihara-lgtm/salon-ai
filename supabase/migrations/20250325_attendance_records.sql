-- タイムカード・勤怠（1人1日1行）
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  actual_work_minutes INTEGER,
  is_late BOOLEAN NOT NULL DEFAULT false,
  is_early_leave BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_salon_date ON attendance_records (salon_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_records_staff_date ON attendance_records (staff_id, date DESC);

COMMENT ON TABLE attendance_records IS '勤怠打刻。staff_id + date で一意。';
