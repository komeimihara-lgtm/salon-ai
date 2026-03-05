-- ============================================================
-- 経営管理・AI日報用マイグレーション
-- 2025-03-05
-- ============================================================

-- sales.sale_type に 'product'（物販売上）を追加
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_sale_type_check;
ALTER TABLE sales ADD CONSTRAINT sales_sale_type_check CHECK (sale_type IN ('cash', 'card', 'online', 'loan', 'ticket_consume', 'subscription_consume', 'product'));

-- daily_reports テーブル作成
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
