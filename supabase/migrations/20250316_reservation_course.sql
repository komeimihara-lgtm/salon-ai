-- 予約テーブルにコース消化関連カラムを追加
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_course BOOLEAN DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES customer_tickets(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES customer_subscriptions(id);
