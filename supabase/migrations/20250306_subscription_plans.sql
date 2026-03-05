-- ============================================================
-- サブスクプランマスタ（メニュー設定で登録）
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  menu_name TEXT NOT NULL,
  price INTEGER NOT NULL,
  sessions_per_month INTEGER NOT NULL,
  billing_day INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_salon_id ON subscription_plans(salon_id);
