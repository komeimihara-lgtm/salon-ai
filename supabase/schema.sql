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
