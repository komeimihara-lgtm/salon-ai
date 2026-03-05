-- ticket_plans と subscription_plans に category カラムを追加
ALTER TABLE ticket_plans
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';
