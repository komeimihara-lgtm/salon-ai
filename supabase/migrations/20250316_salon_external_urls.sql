-- サロンの外部URL（ホットペッパー、公式サイト等）をJSONBカラムで追加
ALTER TABLE salons ADD COLUMN IF NOT EXISTS external_urls JSONB DEFAULT '{}';
