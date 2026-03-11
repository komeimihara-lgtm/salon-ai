CREATE TABLE IF NOT EXISTS unmatched_line_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL,
  line_user_id TEXT NOT NULL UNIQUE,
  followed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
