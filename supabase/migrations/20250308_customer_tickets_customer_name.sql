-- customer_tickets に customer_name カラムを追加
ALTER TABLE customer_tickets
ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT '';
