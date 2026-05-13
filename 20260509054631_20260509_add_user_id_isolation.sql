/*
  # Add User ID Isolation for RLS

  1. Summary
    - Add user_id columns to all tables for ownership tracking
    - Create get_user_id() function to retrieve current session user ID
    - Update RLS policies to restrict access to each user's own data
    - Prevents anon users from seeing/modifying each other's data

  2. Implementation
    - For anon users: use session ID from JWT claims
    - For authenticated users: use auth.uid()
    - Add user_id column to all tables with default ''
    - Add indexes for performance

  3. Security
    - Each user can only access their own records
    - RLS now enforces proper isolation
    - Compatible with future auth migration
*/

-- Create function to get current user ID
CREATE OR REPLACE FUNCTION get_user_id() RETURNS text AS $$
  SELECT COALESCE(
    auth.uid()::text,
    current_setting('request.jwt.claims', true)::jsonb->>'sub',
    ''
  );
$$ LANGUAGE SQL STABLE;

-- Add user_id to chats
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chats' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE chats ADD COLUMN user_id text NOT NULL DEFAULT '';
    CREATE INDEX idx_chats_user_id ON chats(user_id);
  END IF;
END $$;

-- Add user_id to messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN user_id text NOT NULL DEFAULT '';
    CREATE INDEX idx_messages_user_id ON messages(user_id);
  END IF;
END $$;

-- Add user_id to writing_projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'writing_projects' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE writing_projects ADD COLUMN user_id text NOT NULL DEFAULT '';
    CREATE INDEX idx_writing_projects_user_id ON writing_projects(user_id);
  END IF;
END $$;

-- Add user_id to chapters
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chapters' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE chapters ADD COLUMN user_id text NOT NULL DEFAULT '';
    CREATE INDEX idx_chapters_user_id ON chapters(user_id);
  END IF;
END $$;

-- Add user_id to characters
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE characters ADD COLUMN user_id text NOT NULL DEFAULT '';
    CREATE INDEX idx_characters_user_id ON characters(user_id);
  END IF;
END $$;

-- Add user_id to worldbuilding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'worldbuilding' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE worldbuilding ADD COLUMN user_id text NOT NULL DEFAULT '';
    CREATE INDEX idx_worldbuilding_user_id ON worldbuilding(user_id);
  END IF;
END $$;

-- Add user_id to app_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN user_id text NOT NULL DEFAULT '';
    CREATE UNIQUE INDEX idx_app_settings_user_id ON app_settings(user_id);
  END IF;
END $$;

-- Update chats RLS policies
DROP POLICY IF EXISTS "anon_read_chats" ON chats;
DROP POLICY IF EXISTS "anon_insert_chats" ON chats;
DROP POLICY IF EXISTS "anon_update_chats" ON chats;
DROP POLICY IF EXISTS "anon_delete_chats" ON chats;

CREATE POLICY "chats_read" ON chats FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "chats_insert" ON chats FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "chats_update" ON chats FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "chats_delete" ON chats FOR DELETE TO anon
  USING (user_id = get_user_id());

-- Update messages RLS policies
DROP POLICY IF EXISTS "anon_read_messages" ON messages;
DROP POLICY IF EXISTS "anon_insert_messages" ON messages;
DROP POLICY IF EXISTS "anon_update_messages" ON messages;
DROP POLICY IF EXISTS "anon_delete_messages" ON messages;

CREATE POLICY "messages_read" ON messages FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "messages_insert" ON messages FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "messages_update" ON messages FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "messages_delete" ON messages FOR DELETE TO anon
  USING (user_id = get_user_id());

-- Update writing_projects RLS policies
DROP POLICY IF EXISTS "anon_read_writing_projects" ON writing_projects;
DROP POLICY IF EXISTS "anon_insert_writing_projects" ON writing_projects;
DROP POLICY IF EXISTS "anon_update_writing_projects" ON writing_projects;
DROP POLICY IF EXISTS "anon_delete_writing_projects" ON writing_projects;

CREATE POLICY "writing_projects_read" ON writing_projects FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "writing_projects_insert" ON writing_projects FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "writing_projects_update" ON writing_projects FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "writing_projects_delete" ON writing_projects FOR DELETE TO anon
  USING (user_id = get_user_id());

-- Update chapters RLS policies
DROP POLICY IF EXISTS "anon_read_chapters" ON chapters;
DROP POLICY IF EXISTS "anon_insert_chapters" ON chapters;
DROP POLICY IF EXISTS "anon_update_chapters" ON chapters;
DROP POLICY IF EXISTS "anon_delete_chapters" ON chapters;

CREATE POLICY "chapters_read" ON chapters FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "chapters_insert" ON chapters FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "chapters_update" ON chapters FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "chapters_delete" ON chapters FOR DELETE TO anon
  USING (user_id = get_user_id());

-- Update characters RLS policies
DROP POLICY IF EXISTS "anon_read_characters" ON characters;
DROP POLICY IF EXISTS "anon_insert_characters" ON characters;
DROP POLICY IF EXISTS "anon_update_characters" ON characters;
DROP POLICY IF EXISTS "anon_delete_characters" ON characters;

CREATE POLICY "characters_read" ON characters FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "characters_insert" ON characters FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "characters_update" ON characters FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "characters_delete" ON characters FOR DELETE TO anon
  USING (user_id = get_user_id());

-- Update worldbuilding RLS policies
DROP POLICY IF EXISTS "anon_read_worldbuilding" ON worldbuilding;
DROP POLICY IF EXISTS "anon_insert_worldbuilding" ON worldbuilding;
DROP POLICY IF EXISTS "anon_update_worldbuilding" ON worldbuilding;
DROP POLICY IF EXISTS "anon_delete_worldbuilding" ON worldbuilding;

CREATE POLICY "worldbuilding_read" ON worldbuilding FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "worldbuilding_insert" ON worldbuilding FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "worldbuilding_update" ON worldbuilding FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "worldbuilding_delete" ON worldbuilding FOR DELETE TO anon
  USING (user_id = get_user_id());

-- Update app_settings RLS policies
DROP POLICY IF EXISTS "anon_read_app_settings" ON app_settings;
DROP POLICY IF EXISTS "anon_insert_app_settings" ON app_settings;
DROP POLICY IF EXISTS "anon_update_app_settings" ON app_settings;
DROP POLICY IF EXISTS "anon_delete_app_settings" ON app_settings;

CREATE POLICY "app_settings_read" ON app_settings FOR SELECT TO anon
  USING (user_id = get_user_id());
CREATE POLICY "app_settings_insert" ON app_settings FOR INSERT TO anon
  WITH CHECK (user_id = get_user_id());
CREATE POLICY "app_settings_update" ON app_settings FOR UPDATE TO anon
  USING (user_id = get_user_id()) WITH CHECK (user_id = get_user_id());
CREATE POLICY "app_settings_delete" ON app_settings FOR DELETE TO anon
  USING (user_id = get_user_id());
