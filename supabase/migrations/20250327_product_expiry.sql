-- 物販: 消費期限（販売日からの日数）とアラート開始日数
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_days INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_alert_days INTEGER NOT NULL DEFAULT 14;

COMMENT ON COLUMN products.expiry_days IS '販売日からの消費期限までの日数。NULL の場合は期限トラッキングなし';
COMMENT ON COLUMN products.expiry_alert_days IS '期限の何日前からアラート・通知対象にするか（既定14）';

-- 売上と商品の紐付け（物販レジから自動設定）
ALTER TABLE sales ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id) WHERE product_id IS NOT NULL;

-- 顧客別 物販消費期限
CREATE TABLE IF NOT EXISTS customer_product_expiry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  sold_at DATE NOT NULL,
  expires_at DATE NOT NULL,
  line_notified_at TIMESTAMPTZ,
  is_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sale_id)
);

CREATE INDEX IF NOT EXISTS idx_cpe_salon_expires ON customer_product_expiry (salon_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_cpe_salon_notified ON customer_product_expiry (salon_id, is_notified) WHERE is_notified = false;

COMMENT ON TABLE customer_product_expiry IS '物販購入ごとの消費期限。レジで sale_type=product かつ product_id ありのとき自動作成';
