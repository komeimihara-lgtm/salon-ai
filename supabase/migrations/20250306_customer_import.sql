-- ============================================================
-- 顧客インポート機能用 Supabase SQL
-- 実行順: 1. purchase_histories 2. (既存テーブルは変更なし)
-- ============================================================

-- 1. 購入履歴テーブル
CREATE TABLE IF NOT EXISTS purchase_histories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  purchase_date DATE,
  menu_name TEXT,
  amount INTEGER DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_histories_salon_id ON purchase_histories(salon_id);
CREATE INDEX IF NOT EXISTS idx_purchase_histories_customer_id ON purchase_histories(customer_id);
