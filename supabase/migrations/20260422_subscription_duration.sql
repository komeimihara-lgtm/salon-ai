-- サブスクプラン / 顧客サブスクに所要時間 (duration_minutes) を追加
-- 予約作成時に subscription.duration_minutes + 追加メニュー合計 を予約枠として使う

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 60 NOT NULL;

ALTER TABLE public.customer_subscriptions
  ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 60 NOT NULL;

COMMENT ON COLUMN public.subscription_plans.duration_minutes IS 'サブスクメニューの施術時間（分）。予約枠の計算に使用';
COMMENT ON COLUMN public.customer_subscriptions.duration_minutes IS '加入時の施術時間（分）。予約枠の計算に使用';
