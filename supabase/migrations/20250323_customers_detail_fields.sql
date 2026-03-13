-- 顧客詳細ページで必要なカラムを追加（既存カラムはスキップ）
ALTER TABLE customers ADD COLUMN IF NOT EXISTS name_kana TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_visit_date DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS memo TEXT;
