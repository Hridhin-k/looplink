-- Phase 3.10 — Production hardening: audit events + workspace soft-delete

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_action_not_blank CHECK (char_length(trim(action)) > 0),
  CONSTRAINT audit_events_resource_type_not_blank CHECK (char_length(trim(resource_type)) > 0)
);

CREATE INDEX IF NOT EXISTS audit_events_actor_idx
  ON public.audit_events (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_workspace_idx
  ON public.audit_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_action_idx
  ON public.audit_events (action, created_at DESC);

DROP TRIGGER IF EXISTS trg_audit_events_set_updated_at ON public.audit_events;
CREATE TRIGGER trg_audit_events_set_updated_at
BEFORE UPDATE ON public.audit_events
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamp_updated_at();

-- Soft-delete support for shared workspaces (personal workspaces cannot be deleted in app).
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS workspaces_deleted_at_idx
  ON public.workspaces (deleted_at)
  WHERE deleted_at IS NOT NULL;
