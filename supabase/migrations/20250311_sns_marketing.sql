CREATE TABLE IF NOT EXISTS sns_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'x', 'tiktok', 'youtube', 'line', 'hotpepper')),
  account_name TEXT DEFAULT '',
  account_url TEXT DEFAULT '',
  followers_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(salon_id, platform)
);

CREATE TABLE IF NOT EXISTS content_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  platform TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  hashtags TEXT[] DEFAULT '{}',
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sns_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sns_connections_all" ON sns_connections FOR ALL USING (true);
CREATE POLICY "content_plans_all" ON content_plans FOR ALL USING (true);
