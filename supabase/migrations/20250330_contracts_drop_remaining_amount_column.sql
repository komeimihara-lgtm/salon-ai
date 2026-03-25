-- 残金はクライアント/API で amount - deposit_amount として扱うため、生成列があれば削除
ALTER TABLE public.contracts DROP COLUMN IF EXISTS remaining_amount;
