-- LINE メッセージ履歴テーブル
CREATE TABLE IF NOT EXISTS line_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  line_user_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message TEXT NOT NULL DEFAULT '',
  auto_type TEXT DEFAULT NULL, -- 'reminder', 'precounseling', 'welcome', null=手動
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_line_messages_salon_customer ON line_messages(salon_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_line_messages_salon_line_user ON line_messages(salon_id, line_user_id);
CREATE INDEX IF NOT EXISTS idx_line_messages_unread ON line_messages(salon_id, customer_id, is_read) WHERE is_read = false AND direction = 'inbound';
