/*
  # Fix Search Path Security for get_user_id Function

  1. Summary
    - The get_user_id() function has a mutable search_path which is a security risk
    - Function search_path should be immutable to prevent SQL injection via schema manipulation
    - Solution: Recreate function with SECURITY DEFINER and fixed search_path

  2. Security Changes
    - DROP existing get_user_id() function (with CASCADE to drop dependent policies)
    - RECREATE with:
      - SECURITY DEFINER (runs with function owner privileges)
      - SET search_path = public (immutable search path)
      - STABLE (same output for same input)
    - Recreate all RLS policies with the secure function
*/

-- Drop function with cascade
DROP FUNCTION IF EXISTS public.get_user_id() CASCADE;

-- Recreate with security fixes
CREATE FUNCTION public.get_user_id()
RETURNS text
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.uid()::text,
    current_setting('request.jwt.claims', true)::jsonb->>'sub',
    ''
  );
$$;

-- Grant execute permission to roles
GRANT EXECUTE ON FUNCTION public.get_user_id() TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_id() TO authenticated;

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
