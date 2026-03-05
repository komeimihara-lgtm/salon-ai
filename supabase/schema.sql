-- ============================================================
-- SALON AI — Supabase スキーマ定義
-- Phase 1: LEO GRANT + 顧客管理
-- ============================================================

-- UUID拡張
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- サロン情報
-- ============================================================
CREATE TABLE salons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'standard' CHECK (plan IN ('standard', 'pro', 'premium')),
  phone TEXT,
  address TEXT,
  line_channel_id TEXT,
  line_channel_secret TEXT,
  -- KPI設定
  monthly_target INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 顧客カルテ
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  -- 基本情報
  name TEXT NOT NULL,
  name_kana TEXT,
  phone TEXT,
  email TEXT,
  birthday DATE,
  gender TEXT CHECK (gender IN ('female', 'male', 'other', 'unknown')),
  address TEXT,
  -- 来店情報
  first_visit_date DATE,
  last_visit_date DATE,
  visit_count INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,         -- 累計売上（円）
  avg_unit_price INTEGER DEFAULT 0,      -- 平均客単価
  -- 肌・施術情報
  skin_type TEXT,                        -- 肌タイプ
  concerns TEXT,                         -- 悩み（カンマ区切り）
  allergies TEXT,                        -- アレルギー
  memo TEXT,                             -- スタッフメモ
  -- LINE連携
  line_user_id TEXT,
  -- ステータス
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'lost', 'vip')),
  -- 移行元
  imported_from TEXT,                    -- 'penguin', 'salonboard', 'csv', 'manual'
  -- タイムスタンプ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 来店・施術履歴
-- ============================================================
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  -- 施術情報
  menu TEXT,                             -- メニュー名
  staff_name TEXT,                       -- 担当スタッフ
  amount INTEGER DEFAULT 0,             -- 売上金額
  -- カルテ記録
  skin_condition TEXT,                   -- 当日の肌状態
  treatment_note TEXT,                   -- 施術メモ
  counseling_note TEXT,                  -- カウンセリング内容
  next_visit_suggestion TEXT,            -- 次回提案
  -- スコープ画像
  scope_image_before TEXT,              -- 施術前画像URL
  scope_image_after TEXT,               -- 施術後画像URL
  scope_analysis TEXT,                  -- AI分析結果（JSON）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- インデックス
-- ============================================================
CREATE INDEX idx_customers_salon_id ON customers(salon_id);
CREATE INDEX idx_customers_last_visit ON customers(last_visit_date);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_visits_customer_id ON visits(customer_id);
CREATE INDEX idx_visits_visit_date ON visits(visit_date);

-- ============================================================
-- 失客自動更新関数
-- （3ヶ月以上未来店の顧客を自動的に lost に変更）
-- ============================================================
CREATE OR REPLACE FUNCTION update_lost_customers()
RETURNS void AS $$
BEGIN
  UPDATE customers
  SET status = 'lost'
  WHERE status = 'active'
    AND last_visit_date < NOW() - INTERVAL '3 months';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- デモデータ（開発用）
-- ============================================================
INSERT INTO salons (id, name, owner_name, plan, monthly_target)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'エステサロン ルミエール',
  'KOMEI',
  'pro',
  3000000
);

-- ============================================================
-- 予約管理
-- ============================================================
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  menu TEXT,
  staff_name TEXT,
  price INTEGER DEFAULT 0,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show')),
  memo TEXT,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reservations_salon_id ON reservations(salon_id);
CREATE INDEX idx_reservations_date ON reservations(reservation_date);
CREATE INDEX idx_reservations_status ON reservations(status);

ALTER TABLE reservations DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SOLA カウンセリングセッション
-- ============================================================
CREATE TABLE IF NOT EXISTS counseling_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  mode TEXT DEFAULT 'online' CHECK (mode IN ('online', 'salon')),
  concerns TEXT[] DEFAULT '{}',
  skin_type TEXT,
  allergies TEXT,
  cautions TEXT,
  selected_menu TEXT,
  aria_comment TEXT,
  chat_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counseling_sessions_salon_id ON counseling_sessions(salon_id);

-- ============================================================
-- 顧客の回数券・サブスク・クーポン（メニュー設定と紐づけ）
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  course_pack_id TEXT NOT NULL,
  course_name TEXT NOT NULL,
  menu_name TEXT NOT NULL,
  total_sessions INTEGER NOT NULL,
  remaining_sessions INTEGER NOT NULL,
  purchased_at DATE NOT NULL,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS customer_coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  coupon_id TEXT NOT NULL,
  coupon_name TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'amount')),
  discount_value INTEGER NOT NULL,
  target_menu TEXT,
  obtained_at DATE NOT NULL,
  used_at DATE,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_courses_customer_id ON customer_courses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_courses_salon_id ON customer_courses(salon_id);

-- ============================================================
-- 回数券マスタ（サロンが設定する商品）
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  menu_name TEXT NOT NULL,
  total_sessions INTEGER NOT NULL,
  price INTEGER NOT NULL,
  unit_price INTEGER,
  expiry_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 顧客の保有回数券
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  ticket_plan_id UUID REFERENCES ticket_plans(id),
  plan_name TEXT NOT NULL,
  menu_name TEXT NOT NULL,
  total_sessions INTEGER NOT NULL,
  remaining_sessions INTEGER NOT NULL,
  unit_price INTEGER,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_plans_salon_id ON ticket_plans(salon_id);
CREATE INDEX IF NOT EXISTS idx_customer_tickets_customer_id ON customer_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tickets_salon_id ON customer_tickets(salon_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_customer_id ON customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_salon_id ON customer_subscriptions(salon_id);
CREATE INDEX IF NOT EXISTS idx_customer_coupons_customer_id ON customer_coupons(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_coupons_salon_id ON customer_coupons(salon_id);

-- ============================================================
-- 売上（sales）
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  amount INTEGER NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  menu TEXT,
  staff_name TEXT,
  payment_method TEXT DEFAULT 'cash',
  memo TEXT,
  sale_type TEXT DEFAULT 'cash' CHECK (sale_type IN ('cash', 'card', 'online', 'loan', 'ticket_consume', 'subscription_consume', 'product')),
  ticket_id UUID REFERENCES customer_tickets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_salon_id ON sales(salon_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_sale_type ON sales(sale_type);

-- ============================================================
-- 日報（daily_reports）
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  kpi_data jsonb DEFAULT '{}',
  ai_content text,
  edited_content text,
  created_at timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_daily_reports_salon_id ON daily_reports(salon_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_report_date ON daily_reports(report_date);

-- ============================================================
-- マイグレーション（既存DBで実行する場合）
-- ============================================================
-- sales.sale_type, ticket_id:
--   ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'cash';
--   ALTER TABLE sales ADD CONSTRAINT sales_sale_type_check CHECK (sale_type IN ('cash', 'card', 'online', 'loan', 'ticket_consume', 'subscription_consume'));
--   ALTER TABLE sales ADD COLUMN IF NOT EXISTS ticket_id uuid;
--   ALTER TABLE sales ADD CONSTRAINT sales_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES customer_tickets(id) ON DELETE SET NULL;
-- ticket_plans.unit_price（GENERATED から通常カラムへ変更）:
--   ALTER TABLE ticket_plans DROP COLUMN IF EXISTS unit_price;
--   ALTER TABLE ticket_plans ADD COLUMN IF NOT EXISTS unit_price INTEGER;
--   UPDATE ticket_plans SET unit_price = ROUND(price::numeric / NULLIF(total_sessions, 0));
-- daily_reports:
--   CREATE TABLE IF NOT EXISTS daily_reports (...);
