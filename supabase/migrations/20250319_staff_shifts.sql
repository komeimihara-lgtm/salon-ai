-- スタッフテーブル
CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES salons(id),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#C4728A',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- シフトテーブル
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES salons(id),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- スタッフ月次データテーブル
CREATE TABLE IF NOT EXISTS staff_monthly (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES salons(id),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- YYYY-MM
  personal_goal TEXT DEFAULT '',
  monthly_kpi JSONB DEFAULT '{"sales":0,"visits":0,"avgPrice":0}',
  important_tasks JSONB DEFAULT '["","",""]',
  growth_goals JSONB DEFAULT '["","",""]',
  must_do TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, month)
);

-- 休業日テーブル
CREATE TABLE IF NOT EXISTS salon_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES salons(id),
  date DATE NOT NULL,
  reason TEXT DEFAULT '',
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
