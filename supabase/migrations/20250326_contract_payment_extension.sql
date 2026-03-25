-- 契約書: 支払い手段・分割回数・自動引き落とし（将来 Stripe 連携用の正規化カラム）
-- 既存: payment_method が lump_sum / installment を表していた → payment_type にリネーム
ALTER TABLE contracts RENAME COLUMN payment_method TO payment_type;

ALTER TABLE contracts ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash';

COMMENT ON COLUMN contracts.payment_type IS $c$lump_sum | installment（一括 / 分割）$c$;
COMMENT ON COLUMN contracts.payment_method IS $c$cash | card | loan | transfer | auto_billing（支払い手段）$c$;

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS card_brand TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS loan_company TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS installment_count INTEGER;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS auto_billing BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS billing_cycle TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS billing_day INTEGER;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS billing_method TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS first_billing_date DATE;

COMMENT ON COLUMN contracts.card_brand IS $c$visa | master | jcb | amex | diners | unionpay | other$c$;
COMMENT ON COLUMN contracts.billing_cycle IS $c$monthly | quarterly | biannual | annual（Stripe price interval マッピング想定）$c$;
COMMENT ON COLUMN contracts.billing_method IS $c$card | bank_transfer（自動引き落とし時の引き落とし方法）$c$;
COMMENT ON COLUMN contracts.auto_billing IS $c$true = サブスク型自動課金契約。Stripe Customer / Subscription ID は将来別カラムまたは metadata で拡張$c$;
