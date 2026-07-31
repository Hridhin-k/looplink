-- Phase 3.9 — Workspace-scoped API keys
-- Keys are stored hashed; only a public prefix is retained for display.

CREATE TABLE IF NOT EXISTS public.workspace_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_api_keys_name_not_blank CHECK (char_length(trim(name)) > 0),
  CONSTRAINT workspace_api_keys_prefix_not_blank CHECK (char_length(trim(key_prefix)) > 0),
  CONSTRAINT workspace_api_keys_hash_unique UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS workspace_api_keys_workspace_idx
  ON public.workspace_api_keys (workspace_id);

CREATE INDEX IF NOT EXISTS workspace_api_keys_prefix_idx
  ON public.workspace_api_keys (key_prefix);

CREATE INDEX IF NOT EXISTS workspace_api_keys_active_idx
  ON public.workspace_api_keys (workspace_id)
  WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS trg_workspace_api_keys_set_updated_at ON public.workspace_api_keys;
CREATE TRIGGER trg_workspace_api_keys_set_updated_at
BEFORE UPDATE ON public.workspace_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamp_updated_at();
