-- 回数券期限切れ履歴テーブル
CREATE TABLE IF NOT EXISTS ticket_expirations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id UUID NOT NULL REFERENCES salons(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  customer_ticket_id UUID NOT NULL REFERENCES customer_tickets(id),
  plan_name TEXT NOT NULL,
  expired_sessions INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  expiry_date DATE NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  memo TEXT DEFAULT '有効期限切れによる失効'
);

CREATE INDEX IF NOT EXISTS idx_ticket_expirations_salon_id ON ticket_expirations(salon_id);
CREATE INDEX IF NOT EXISTS idx_ticket_expirations_processed_at ON ticket_expirations(processed_at);
