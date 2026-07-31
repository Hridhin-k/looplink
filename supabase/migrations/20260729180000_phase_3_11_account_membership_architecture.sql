-- Phase 3.11 — Account → Membership → Workspace identity architecture
-- Additive only: accounts table, membership status/joined_at, account sync.

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounts_email_idx
  ON public.accounts (lower(email))
  WHERE email IS NOT NULL;

DROP TRIGGER IF EXISTS trg_accounts_set_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_set_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamp_updated_at();

-- Backfill accounts from existing auth users.
INSERT INTO public.accounts (id, email, display_name, created_at, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(COALESCE(u.email, ''), '@', 1)),
  COALESCE(u.created_at, now()),
  now()
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Membership status + joined_at (authorization lifecycle).
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspace_members_status_check'
  ) THEN
    ALTER TABLE public.workspace_members
      ADD CONSTRAINT workspace_members_status_check
      CHECK (status = ANY (ARRAY['active'::text, 'invited'::text, 'suspended'::text, 'left'::text]));
  END IF;
END $$;

UPDATE public.workspace_members
SET joined_at = created_at
WHERE joined_at IS DISTINCT FROM created_at
  AND status = 'active';

CREATE INDEX IF NOT EXISTS workspace_members_account_status_idx
  ON public.workspace_members (user_id, status);

CREATE INDEX IF NOT EXISTS workspace_members_workspace_status_idx
  ON public.workspace_members (workspace_id, status);

-- Keep accounts in sync when auth.users are created/updated.
CREATE OR REPLACE FUNCTION public.sync_account_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.accounts (id, email, display_name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.created_at, now()),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.accounts.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.accounts.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_account_from_auth_user ON auth.users;
CREATE TRIGGER trg_sync_account_from_auth_user
AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_from_auth_user();

-- Ensure personal-workspace trigger also creates/syncs the account row first.
CREATE OR REPLACE FUNCTION public.create_personal_workspace_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
BEGIN
  INSERT INTO public.accounts (id, email, display_name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.created_at, now()),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (name, owner_user_id, is_personal)
  VALUES ('Personal', NEW.id, true)
  ON CONFLICT (owner_user_id) WHERE (is_personal)
  DO NOTHING
  RETURNING id INTO new_workspace_id;

  IF new_workspace_id IS NULL THEN
    SELECT id INTO new_workspace_id
    FROM public.workspaces
    WHERE owner_user_id = NEW.id AND is_personal = true
    LIMIT 1;
  END IF;

  IF new_workspace_id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role, status, joined_at)
    VALUES (new_workspace_id, NEW.id, 'owner', 'active', now())
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
