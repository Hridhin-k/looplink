-- Phase 3.8 — Collaboration
-- Roles: owner | admin | developer | viewer
-- Invitations + workspace settings fields

-- Expand role CHECK (additive: drop old constraint, add new, migrate member → developer)
ALTER TABLE public.workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_role_valid;

UPDATE public.workspace_members
SET role = 'developer'
WHERE role = 'member';

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_valid
  CHECK (role IN ('owner', 'admin', 'developer', 'viewer'));

ALTER TABLE public.workspace_members
  ALTER COLUMN role SET DEFAULT 'developer';

-- Optional workspace settings fields (additive)
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Invitations
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'developer',
  token_hash text NOT NULL,
  invited_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_invitations_email_not_blank CHECK (char_length(trim(email)) > 0),
  CONSTRAINT workspace_invitations_role_valid CHECK (role IN ('admin', 'developer', 'viewer')),
  CONSTRAINT workspace_invitations_status_valid CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  CONSTRAINT workspace_invitations_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS workspace_invitations_workspace_idx
  ON public.workspace_invitations (workspace_id);

CREATE INDEX IF NOT EXISTS workspace_invitations_email_idx
  ON public.workspace_invitations (lower(email));

CREATE INDEX IF NOT EXISTS workspace_invitations_status_idx
  ON public.workspace_invitations (status);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitations_pending_unique
  ON public.workspace_invitations (workspace_id, lower(email))
  WHERE status = 'pending';

DROP TRIGGER IF EXISTS trg_workspace_invitations_set_updated_at ON public.workspace_invitations;
CREATE TRIGGER trg_workspace_invitations_set_updated_at
BEFORE UPDATE ON public.workspace_invitations
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamp_updated_at();
