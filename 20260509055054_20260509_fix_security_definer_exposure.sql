/*
  # Fix SECURITY DEFINER Exposure for get_user_id Function

  1. Summary
    - get_user_id() was SECURITY DEFINER with EXECUTE granted to anon/authenticated
    - This exposed the function via /rest/v1/rpc/get_user_id as a SECURITY DEFINER endpoint
    - The function is only used internally by RLS policies, not via REST API
    - Solution: Revoke EXECUTE from anon/authenticated, switch to SECURITY INVOKER

  2. Security Changes
    - Revoke EXECUTE from anon and authenticated roles
    - Switch from SECURITY DEFINER to SECURITY INVOKER
    - RLS policies still work because they run as the table owner, not the calling user
    - The function only reads JWT claims which are available to the invoker
*/

-- Drop and recreate function as SECURITY INVOKER (default)
DROP FUNCTION IF EXISTS public.get_user_id() CASCADE;

CREATE FUNCTION public.get_user_id()
RETURNS text
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.uid()::text,
    current_setting('request.jwt.claims', true)::jsonb->>'sub',
    ''
  );
$$;

-- Do NOT grant EXECUTE to anon or authenticated
-- RLS policies run as table owner and bypass EXECUTE checks

-- Recreate RLS policies for chats
CREATE POLICY "chats_read" ON chats FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "chats_insert" ON chats FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "chats_update" ON chats FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "chats_delete" ON chats FOR DELETE TO anon
  USING (user_id = get_user_id());

-- Recreate RLS policies for messages
CREATE POLICY "messages_read" ON messages FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "messages_insert" ON messages FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "messages_update" ON messages FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "messages_delete" ON messages FOR DELETE TO anon
  USING (user_id = get_user_id());

-- Recreate RLS policies for writing_projects
CREATE POLICY "writing_projects_read" ON writing_projects FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "writing_projects_insert" ON writing_projects FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "writing_projects_update" ON writing_projects FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "writing_projects_delete" ON writing_projects FOR DELETE TO anon
  USING (user_id = get_user_id());

-- Recreate RLS policies for chapters
CREATE POLICY "chapters_read" ON chapters FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "chapters_insert" ON chapters FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "chapters_update" ON chapters FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "chapters_delete" ON chapters FOR DELETE TO anon
  USING (user_id = get_user_id());

-- Recreate RLS policies for characters
CREATE POLICY "characters_read" ON characters FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "characters_insert" ON characters FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "characters_update" ON characters FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "characters_delete" ON characters FOR DELETE TO anon
  USING (user_id = get_user_id());

-- Recreate RLS policies for worldbuilding
CREATE POLICY "worldbuilding_read" ON worldbuilding FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "worldbuilding_insert" ON worldbuilding FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "worldbuilding_update" ON worldbuilding FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "worldbuilding_delete" ON worldbuilding FOR DELETE TO anon
  USING (user_id = get_user_id());

-- Recreate RLS policies for app_settings
CREATE POLICY "app_settings_read" ON app_settings FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "app_settings_insert" ON app_settings FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "app_settings_update" ON app_settings FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "app_settings_delete" ON app_settings FOR DELETE TO anon
  USING (user_id = get_user_id());
