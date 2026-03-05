-- ============================================================
-- customer_subscriptions テーブル作成（存在しない場合）
-- customer_tickets に unit_price カラム追加
-- ============================================================

-- 1. customer_subscriptions テーブル
CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  menu_name TEXT NOT NULL,
  price INTEGER NOT NULL,
  sessions_per_month INTEGER NOT NULL,
  started_at DATE NOT NULL,
  next_billing_date DATE NOT NULL,
  sessions_used_in_period INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_customer_id ON customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_salon_id ON customer_subscriptions(salon_id);

-- 2. customer_tickets に unit_price カラム追加
ALTER TABLE customer_tickets
ADD COLUMN IF NOT EXISTS unit_price INTEGER DEFAULT 0;
