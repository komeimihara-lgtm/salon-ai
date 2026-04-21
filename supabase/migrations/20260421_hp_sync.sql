-- Hot Pepper Beauty (HPB) sync integration
-- Adds credential columns to salons + a sync log table

ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS hp_email text,
  ADD COLUMN IF NOT EXISTS hp_password text,
  ADD COLUMN IF NOT EXISTS hp_sync_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hp_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS hp_sync_email text,
  -- Owner LINE user id (target of HP sync push notifications)
  ADD COLUMN IF NOT EXISTS owner_line_user_id text;

-- Backfill hp_sync_email if null:  sync-{salon_id}@sola-ai.jp
UPDATE public.salons
SET hp_sync_email = 'sync-' || id::text || '@sola-ai.jp'
WHERE hp_sync_email IS NULL;

-- Unique index so we can route inbound mail to exactly one salon
CREATE UNIQUE INDEX IF NOT EXISTS idx_salons_hp_sync_email
  ON public.salons(hp_sync_email)
  WHERE hp_sync_email IS NOT NULL;

-- HPB reservation reference: so email + scrape can dedup against the same external record
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS hp_external_id text,
  ADD COLUMN IF NOT EXISTS hp_source text CHECK (hp_source IN ('email', 'scrape', 'manual', NULL));

CREATE INDEX IF NOT EXISTS idx_reservations_hp_external_id
  ON public.reservations(salon_id, hp_external_id)
  WHERE hp_external_id IS NOT NULL;

-- Sync log table (shown in settings UI)
CREATE TABLE IF NOT EXISTS public.hp_sync_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('email', 'scrape', 'manual')),
  status text NOT NULL CHECK (status IN ('success', 'error', 'skipped', 'duplicate')),
  message text,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hp_sync_logs_salon_created
  ON public.hp_sync_logs(salon_id, created_at DESC);

-- Rate-limit state (prevents scraping too often per salon)
CREATE TABLE IF NOT EXISTS public.hp_sync_rate_limits (
  salon_id uuid PRIMARY KEY REFERENCES public.salons(id) ON DELETE CASCADE,
  last_scrape_at timestamptz,
  last_email_at timestamptz
);
