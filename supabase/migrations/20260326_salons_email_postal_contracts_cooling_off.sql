-- クーリングオフ条項（電磁的記録）対応: 店舗メール・郵便番号、契約に受付メールスナップショット
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS postal_code TEXT;
COMMENT ON COLUMN public.salons.email IS '店舗連絡用メール（クーリングオフの電磁的記録受付等）';
COMMENT ON COLUMN public.salons.postal_code IS '郵便番号（表示用、ハイフンあり推奨）';

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS cooling_off_email TEXT;
COMMENT ON COLUMN public.contracts.cooling_off_email IS '契約作成時のクーリングオフ電磁的記録受付メール（salons.email をスナップショット）';
