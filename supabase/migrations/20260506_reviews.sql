-- 口コミ機能（口コミ365 相当）
-- お客様アンケート → AI口コミ文生成 → Googleマップ投稿誘導 → 返信文AI生成

-- ============================================================
-- 1) reviews テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  visit_id uuid,
  -- アンケート回答
  satisfaction text,           -- とても満足/満足/普通/不満
  good_points text[],          -- 技術力/スタッフの対応/清潔感/雰囲気/価格/その他
  staff_comment text,          -- スタッフへの自由コメント
  revisit_intention text,      -- ぜひまた来たい/検討中/わからない
  -- 生成・投稿
  generated_review text,       -- AIが生成した口コミ文
  edited_review text,          -- お客様が編集した最終文
  is_posted boolean DEFAULT false,
  posted_at timestamptz,
  -- サロン側返信
  reply_text text,
  replied_at timestamptz,
  -- 管理
  is_read boolean DEFAULT false,    -- サロン側で既読か（新着バッジ用）
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_salon_created
  ON public.reviews(salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_salon_unread
  ON public.reviews(salon_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_reviews_customer
  ON public.reviews(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_visit
  ON public.reviews(visit_id) WHERE visit_id IS NOT NULL;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "salon_isolation" ON public.reviews;
DROP POLICY IF EXISTS "reviews_all" ON public.reviews;
-- 他テーブルと同じく USING (true) パターン。
-- 実際のテナント分離は API 層 (service_role + salon_id フィルタ) で実施
CREATE POLICY "reviews_all" ON public.reviews FOR ALL USING (true);

COMMENT ON TABLE public.reviews IS '口コミアンケート + AI生成 + Googleマップ投稿管理';

-- ============================================================
-- 2) salons に口コミ設定列を追加
-- ============================================================
ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS review_custom_points text,
  ADD COLUMN IF NOT EXISTS review_ng_words text,
  ADD COLUMN IF NOT EXISTS review_notify_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS review_send_hours integer DEFAULT 24;

COMMENT ON COLUMN public.salons.google_place_id IS 'Googleビジネスプロフィールの Place ID。口コミ投稿リンク生成に使用';
COMMENT ON COLUMN public.salons.review_custom_points IS 'お店の特徴・推しポイント（口コミ生成プロンプトに含める）';
COMMENT ON COLUMN public.salons.review_ng_words IS 'カンマ区切り NG ワード。生成された口コミに含まれていれば再生成';
COMMENT ON COLUMN public.salons.review_notify_enabled IS '口コミアンケートの自動LINE送信ON/OFF';
COMMENT ON COLUMN public.salons.review_send_hours IS '来店何時間後にLINEを送るか（デフォルト24）';

NOTIFY pgrst, 'reload schema';
