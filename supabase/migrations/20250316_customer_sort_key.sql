-- フリガナ（name_kana）がnullの場合にname でフォールバックするソート用カラム
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sort_kana TEXT GENERATED ALWAYS AS (COALESCE(name_kana, name)) STORED;
CREATE INDEX IF NOT EXISTS idx_customers_sort_kana ON customers(salon_id, sort_kana);
