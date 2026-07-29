-- Phase 3.3 / 3.4 workspace domain foundation
-- Root business entity: workspace

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  is_personal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspaces_name_not_blank CHECK (char_length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_owner_personal_unique
  ON public.workspaces (owner_user_id)
  WHERE is_personal;

CREATE INDEX IF NOT EXISTS workspaces_owner_idx ON public.workspaces (owner_user_id);
CREATE INDEX IF NOT EXISTS workspaces_created_idx ON public.workspaces (created_at DESC);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_members_role_valid CHECK (role IN ('owner', 'admin', 'member')),
  CONSTRAINT workspace_members_unique UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON public.workspace_members (user_id);
CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx ON public.workspace_members (workspace_id);

CREATE OR REPLACE FUNCTION public.set_timestamp_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspaces_set_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_set_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_workspace_members_set_updated_at ON public.workspace_members;
CREATE TRIGGER trg_workspace_members_set_updated_at
BEFORE UPDATE ON public.workspace_members
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamp_updated_at();

CREATE OR REPLACE FUNCTION public.create_personal_workspace_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workspace_name text;
  new_workspace_id uuid;
BEGIN
  workspace_name := COALESCE(NULLIF(trim(NEW.email), ''), 'Personal Workspace');

  INSERT INTO public.workspaces (name, owner_user_id, is_personal)
  VALUES (workspace_name, NEW.id, true)
  ON CONFLICT ON CONSTRAINT workspaces_owner_personal_unique
  DO UPDATE SET updated_at = now()
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_users_create_personal_workspace ON auth.users;
CREATE TRIGGER trg_auth_users_create_personal_workspace
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_personal_workspace_for_new_user();

-- Backfill personal workspaces for users created before this migration.
INSERT INTO public.workspaces (name, owner_user_id, is_personal)
SELECT
  COALESCE(NULLIF(trim(u.email), ''), 'Personal Workspace') AS name,
  u.id,
  true
FROM auth.users u
LEFT JOIN public.workspaces w
  ON w.owner_user_id = u.id
  AND w.is_personal = true
WHERE w.id IS NULL;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT
  w.id,
  w.owner_user_id,
  'owner'
FROM public.workspaces w
LEFT JOIN public.workspace_members m
  ON m.workspace_id = w.id
  AND m.user_id = w.owner_user_id
WHERE w.is_personal = true
  AND m.id IS NULL;
