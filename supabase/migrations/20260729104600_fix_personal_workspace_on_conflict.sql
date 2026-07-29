-- Fix signup trigger: workspaces_owner_personal_unique is a partial unique
-- INDEX, not a table CONSTRAINT. ON CONFLICT ON CONSTRAINT failed and blocked
-- new OAuth users with "Database error saving new user".

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
  ON CONFLICT (owner_user_id) WHERE (is_personal)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
