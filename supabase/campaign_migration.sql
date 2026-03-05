-- ============================================================
-- キャンペーン対応 Supabase SQL（まとめ）
-- 実行順: 1 → 2
-- ============================================================

-- 1. campaigns テーブル（将来の Supabase 連携用・オプション）
-- 現在は localStorage で管理しているため、以下の ALTER は campaigns テーブルが既に存在する場合のみ実行
/*
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  campaign_type TEXT DEFAULT 'discount' CHECK (campaign_type IN ('discount', 'limited_menu')),
  menu_name TEXT DEFAULT '',
  duration_minutes INTEGER,
  target_type TEXT DEFAULT 'menu' CHECK (target_type IN ('menu', 'ticket', 'subscription')),
  discount_type TEXT,
  discount_value INTEGER,
  target_id TEXT,
  target_name TEXT,
  menu_description TEXT,
  price INTEGER,
  total_sessions INTEGER,
  sessions_per_month INTEGER,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'discount';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS menu_name TEXT DEFAULT '';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'menu';
*/

-- 2. customer_tickets / customer_subscriptions に campaign_id を追加（必須）
-- campaign_id は TEXT（localStorage の ID を保存、UUID の FK は使用しない）

ALTER TABLE customer_tickets
ADD COLUMN IF NOT EXISTS campaign_id TEXT;

ALTER TABLE customer_subscriptions
ADD COLUMN IF NOT EXISTS campaign_id TEXT;
