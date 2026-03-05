-- ============================================================
-- Supabase SQL Editor で実行するマイグレーション
-- 実行日: 2025-03-05
-- ============================================================

-- 1. sales テーブル: sale_type, ticket_id カラム追加
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'cash';
UPDATE sales SET sale_type = 'cash' WHERE sale_type IS NULL;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_sale_type_check;
ALTER TABLE sales ADD CONSTRAINT sales_sale_type_check CHECK (sale_type IN ('cash', 'card', 'online', 'loan', 'ticket_consume', 'subscription_consume'));

ALTER TABLE sales ADD COLUMN IF NOT EXISTS ticket_id uuid;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_ticket_id_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES customer_tickets(id) ON DELETE SET NULL;

-- 2. ticket_plans: unit_price を GENERATED から通常カラムへ変更
ALTER TABLE ticket_plans DROP COLUMN IF EXISTS unit_price;
ALTER TABLE ticket_plans ADD COLUMN IF NOT EXISTS unit_price INTEGER;
UPDATE ticket_plans SET unit_price = ROUND(price::numeric / NULLIF(total_sessions, 0));
