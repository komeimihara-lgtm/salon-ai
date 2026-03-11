-- salons に LINE Messaging API 用カラムを追加
ALTER TABLE salons ADD COLUMN IF NOT EXISTS line_channel_access_token TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS line_webhook_enabled BOOLEAN DEFAULT false;

-- counseling_sessions テーブル（プレカウンセリング用）
CREATE TABLE IF NOT EXISTS counseling_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  line_user_id TEXT NOT NULL,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  menu TEXT,
  conversation_history JSONB DEFAULT '[]',
  collected_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counseling_sessions_salon_id ON counseling_sessions(salon_id);
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_line_user_id ON counseling_sessions(line_user_id);
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_status ON counseling_sessions(status);
