-- contracts: 不足列の補完（冪等）+ 頭金（残金はアプリで算出）
-- アプリ: app/api/contracts, contracts/new, contracts/[id] と整合

-- 旧スキーマ: payment_method が lump_sum / installment のみ → payment_type
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'payment_type'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'payment_method'
    ) THEN
      ALTER TABLE public.contracts RENAME COLUMN payment_method TO payment_type;
    ELSE
      ALTER TABLE public.contracts
        ADD COLUMN payment_type text NOT NULL DEFAULT 'lump_sum';
    END IF;
  END IF;
END
$migration$;

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS payment_method text;
UPDATE public.contracts SET payment_method = 'cash' WHERE payment_method IS NULL;
ALTER TABLE public.contracts ALTER COLUMN payment_method SET DEFAULT 'cash';

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS payment_detail jsonb;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS card_brand text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS loan_company text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS installment_count integer;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS auto_billing boolean NOT NULL DEFAULT false;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS billing_cycle text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS billing_day integer;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS billing_method text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS first_billing_date date;

-- 【確認2】系のベース列（CREATE 済み環境ではスキップ）
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS treatment_content text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS course_name text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS signature_image text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS signer_ip text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS sessions integer;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS amount integer;

-- 頭金（残金 remaining_amount はアプリ側で算出し DB には持たない）
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS deposit_amount integer NOT NULL DEFAULT 0;

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS deposit_paid_at date;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS remaining_paid_at date;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS deposit_payment_method text;

UPDATE public.contracts SET deposit_amount = 0 WHERE deposit_amount IS NULL;

COMMENT ON COLUMN public.contracts.deposit_amount IS $c$頭金（円）$c$;
COMMENT ON COLUMN public.contracts.deposit_paid_at IS $c$頭金入金日$c$;
COMMENT ON COLUMN public.contracts.remaining_paid_at IS $c$残金入金日$c$;
COMMENT ON COLUMN public.contracts.deposit_payment_method IS $c$頭金の支払い方法（cash | card | loan | transfer）$c$;
