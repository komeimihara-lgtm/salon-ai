CREATE TABLE IF NOT EXISTS blocked_times (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES salons(id),
  block_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  bed_id TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_times_salon_date ON blocked_times(salon_id, block_date);
