-- キャンペーン対応: customer_tickets, customer_subscriptions に campaign_id を追加
-- ※ campaign_id は TEXT（localStorage の ID を保存）

ALTER TABLE customer_tickets
ADD COLUMN IF NOT EXISTS campaign_id TEXT;

ALTER TABLE customer_subscriptions
ADD COLUMN IF NOT EXISTS campaign_id TEXT;
