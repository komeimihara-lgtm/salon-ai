-- 契約書テーブルに分割払い詳細カラムを追加
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payment_detail JSONB;
