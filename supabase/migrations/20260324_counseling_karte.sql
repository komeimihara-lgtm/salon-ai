-- カウンセリング構造化カルテ（AI会話から抽出したJSON）と来店日
ALTER TABLE counseling_sessions ADD COLUMN IF NOT EXISTS karte_data JSONB;
ALTER TABLE counseling_sessions ADD COLUMN IF NOT EXISTS visit_date DATE DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_counseling_sessions_customer_created
  ON counseling_sessions (customer_id, created_at DESC);

-- 顧客カルテ用：カウンセリングJSON履歴（セッションと併用・簡易参照）
ALTER TABLE customers ADD COLUMN IF NOT EXISTS counseling_memo JSONB DEFAULT '[]'::jsonb;
