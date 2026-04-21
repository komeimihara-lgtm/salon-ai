-- 回数券残回数の手動変更履歴
CREATE TABLE IF NOT EXISTS customer_ticket_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_ticket_id UUID NOT NULL REFERENCES customer_tickets(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  previous_remaining INTEGER NOT NULL,
  new_remaining INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_ticket_logs_ticket_id ON customer_ticket_logs(customer_ticket_id);
CREATE INDEX IF NOT EXISTS idx_customer_ticket_logs_salon_id ON customer_ticket_logs(salon_id);

-- サブスクの手動変更履歴
CREATE TABLE IF NOT EXISTS customer_subscription_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_subscription_id UUID NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT,
  previous_sessions_used INTEGER,
  new_sessions_used INTEGER,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_subscription_logs_sub_id ON customer_subscription_logs(customer_subscription_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscription_logs_salon_id ON customer_subscription_logs(salon_id);
