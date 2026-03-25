-- 契約の合計金額（amount と同期。API は total_amount ?? amount ?? 0 で正規化）
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS total_amount integer;

UPDATE public.contracts SET total_amount = COALESCE(amount, 0) WHERE total_amount IS NULL;

ALTER TABLE public.contracts ALTER COLUMN total_amount SET DEFAULT 0;
