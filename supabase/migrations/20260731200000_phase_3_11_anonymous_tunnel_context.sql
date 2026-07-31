-- Phase 3.11 — Anonymous Tunnel Context
-- Additive: anonymous_sessions + tunnels with XOR ownership constraint.

CREATE TABLE IF NOT EXISTS public.anonymous_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anonymous_sessions_token_not_blank CHECK (char_length(trim(session_token)) > 0),
  CONSTRAINT anonymous_sessions_expires_after_created CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS anonymous_sessions_token_uidx
  ON public.anonymous_sessions (session_token);

CREATE INDEX IF NOT EXISTS anonymous_sessions_expires_idx
  ON public.anonymous_sessions (expires_at);

-- Live tunnel ownership (XOR: anonymous session OR workspace).
-- Tunnel ids are protocol hex slugs (not UUIDs).
CREATE TABLE IF NOT EXISTS public.tunnels (
  id text PRIMARY KEY,
  anonymous_session_id uuid REFERENCES public.anonymous_sessions(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  port integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tunnels_port_valid CHECK (port >= 1 AND port <= 65535),
  CONSTRAINT tunnels_exactly_one_context CHECK (
    (anonymous_session_id IS NOT NULL AND workspace_id IS NULL)
    OR (anonymous_session_id IS NULL AND workspace_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS tunnels_anonymous_session_idx
  ON public.tunnels (anonymous_session_id)
  WHERE anonymous_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tunnels_workspace_idx
  ON public.tunnels (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tunnels_created_idx
  ON public.tunnels (created_at DESC);

DROP TRIGGER IF EXISTS trg_tunnels_set_updated_at ON public.tunnels;
CREATE TRIGGER trg_tunnels_set_updated_at
BEFORE UPDATE ON public.tunnels
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamp_updated_at();
