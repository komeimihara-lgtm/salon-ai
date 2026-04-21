-- The Core 連携テーブル

-- カウンセリングメッセージ
CREATE TABLE IF NOT EXISTS counseling_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counseling_messages_customer
  ON counseling_messages (customer_id, created_at DESC);

-- Bond Score（信頼関係プロファイル）
CREATE TABLE IF NOT EXISTS customer_bond_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  bond_stage INTEGER DEFAULT 1,
  bond_score NUMERIC DEFAULT 0,
  trust_indicators JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 感情ログ（施術スタッフへの引き渡し用）
CREATE TABLE IF NOT EXISTS counseling_emotion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  emotion JSONB NOT NULL,
  message_index INTEGER,
  session_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counseling_emotion_logs_customer
  ON counseling_emotion_logs (customer_id, session_date DESC);

-- 顧客記憶
CREATE TABLE IF NOT EXISTS customer_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  short_term JSONB DEFAULT '{}',
  long_term JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
