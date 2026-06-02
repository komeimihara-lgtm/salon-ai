-- 感動体験提案の永続キャッシュ
--   毎回 AI を回すとコスト/時間が高いので、その日に分析した結果を保存
--   再来店日（reservation_date）から3日経過したら自動クリーンアップ対象

CREATE TABLE IF NOT EXISTS public.customer_delight_proposals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_rank text,            -- vip / at_risk / dormant / new / active
  reservation_date date NOT NULL, -- 来店予定日
  reason text,
  initiative text,
  special_experience text,
  action_type text,
  message_template text,
  priority integer DEFAULT 5,
  generated_at timestamptz DEFAULT now(),
  is_done boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_cdp_salon_resvdate
  ON public.customer_delight_proposals(salon_id, reservation_date);

CREATE INDEX IF NOT EXISTS idx_cdp_salon_generated
  ON public.customer_delight_proposals(salon_id, generated_at DESC);

ALTER TABLE public.customer_delight_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cdp_all" ON public.customer_delight_proposals;
CREATE POLICY "cdp_all" ON public.customer_delight_proposals FOR ALL USING (true);

COMMENT ON TABLE public.customer_delight_proposals IS '感動体験提案の永続キャッシュ。同日再分析を防止し、3日後の予約日まで保持';

NOTIFY pgrst, 'reload schema';
