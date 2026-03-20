-- 売上の取消・修正・監査ログ（sale_logs）

-- staff: 権限（ログインメールでオペレーターと紐付け）
ALTER TABLE staff ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('owner', 'staff'));
ALTER TABLE staff ADD COLUMN IF NOT EXISTS login_email TEXT;

COMMENT ON COLUMN staff.role IS 'owner: 修正・取消可 / staff: 取消のみ';
COMMENT ON COLUMN staff.login_email IS 'Supabase Auth のメールと一致させるとそのスタッフとして権限判定';

-- sales: ステータス・取消情報・修正チェーン
ALTER TABLE sales ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_status_check CHECK (status IN ('active', 'cancelled', 'modified'));
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS original_sale_id UUID REFERENCES sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_salon_status ON sales(salon_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_original_sale_id ON sales(original_sale_id);

COMMENT ON COLUMN sales.status IS 'active: 有効 / cancelled: 取消済（集計除外） / modified: 予約用';
COMMENT ON COLUMN sales.original_sale_id IS '修正で作り直した場合の元売上ID';

-- 監査ログ（JWT経由の直接更新・削除はポリシーで禁止。サービスロールはRLSバイパスでAPIからINSERT）
CREATE TABLE IF NOT EXISTS sale_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'cancelled', 'modified')),
  before_data JSONB,
  after_data JSONB,
  operated_by TEXT NOT NULL,
  operated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sale_logs_sale_id ON sale_logs(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_logs_salon_id ON sale_logs(salon_id);
CREATE INDEX IF NOT EXISTS idx_sale_logs_operated_at ON sale_logs(operated_at DESC);

ALTER TABLE sale_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE sale_logs IS '監査ログ。RLS有効・ポリシー未設定のため PostgREST(anon/authenticated)からは行レベルでアクセス不可。Next.js API の service_role のみ INSERT。UPDATE/DELETEは運用で禁止。';

-- anon / authenticated: 行ポリシーなしのため SELECT/INSERT/UPDATE/DELETE いずれも不可
-- service_role は RLS をバイパスするため API からの INSERT が可能
