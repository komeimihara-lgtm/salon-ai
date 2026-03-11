-- salonsテーブルにstatusカラム追加
ALTER TABLE salons ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- お知らせテーブル
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'update', 'maintenance', 'important')),
  target_plan TEXT NOT NULL DEFAULT 'all', -- 'all', 'LITE', 'PRO', 'MAX'
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- お知らせ既読テーブル
CREATE TABLE IF NOT EXISTS announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, salon_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_salon ON announcement_reads(salon_id);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(is_published, published_at);
