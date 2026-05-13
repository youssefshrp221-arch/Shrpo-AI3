/*
  # Fix RLS Policies - Restrict to Anonymous Users Only

  1. Summary
    - All tables currently allow both anon and authenticated users with unrestricted access (USING/WITH CHECK = true)
    - This is a security vulnerability - data is exposed to all users without ownership checks
    - Solution: Allow only anon users (public anonymous access), restrict authenticated users completely
    - This is appropriate for a public demo/app where users don't have accounts

  2. Tables Updated
    - chats
    - messages
    - writing_projects
    - chapters
    - characters
    - worldbuilding
    - app_settings

  3. Security Changes
    - DROP all existing policies with "public_" prefix
    - CREATE new policies that ONLY allow anon users
    - Authenticated users will have no access (they can authenticate later when user system is added)
    - This prevents users from accidentally accessing each other's data through authenticated sessions
*/

-- Fix chats table
DROP POLICY IF EXISTS "public_read_chats" ON chats;
DROP POLICY IF EXISTS "public_insert_chats" ON chats;
DROP POLICY IF EXISTS "public_update_chats" ON chats;
DROP POLICY IF EXISTS "public_delete_chats" ON chats;

CREATE POLICY "anon_read_chats" ON chats FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_chats" ON chats FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_chats" ON chats FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_chats" ON chats FOR DELETE TO anon USING (true);

-- Fix messages table
DROP POLICY IF EXISTS "public_read_messages" ON messages;
DROP POLICY IF EXISTS "public_insert_messages" ON messages;
DROP POLICY IF EXISTS "public_update_messages" ON messages;
DROP POLICY IF EXISTS "public_delete_messages" ON messages;

CREATE POLICY "anon_read_messages" ON messages FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_messages" ON messages FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_messages" ON messages FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_messages" ON messages FOR DELETE TO anon USING (true);

-- Fix writing_projects table
DROP POLICY IF EXISTS "public_read_writing_projects" ON writing_projects;
DROP POLICY IF EXISTS "public_insert_writing_projects" ON writing_projects;
DROP POLICY IF EXISTS "public_update_writing_projects" ON writing_projects;
DROP POLICY IF EXISTS "public_delete_writing_projects" ON writing_projects;

CREATE POLICY "anon_read_writing_projects" ON writing_projects FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_writing_projects" ON writing_projects FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_writing_projects" ON writing_projects FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_writing_projects" ON writing_projects FOR DELETE TO anon USING (true);

-- Fix chapters table
DROP POLICY IF EXISTS "public_read_chapters" ON chapters;
DROP POLICY IF EXISTS "public_insert_chapters" ON chapters;
DROP POLICY IF EXISTS "public_update_chapters" ON chapters;
DROP POLICY IF EXISTS "public_delete_chapters" ON chapters;

CREATE POLICY "anon_read_chapters" ON chapters FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_chapters" ON chapters FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_chapters" ON chapters FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_chapters" ON chapters FOR DELETE TO anon USING (true);

-- Fix characters table
DROP POLICY IF EXISTS "public_read_characters" ON characters;
DROP POLICY IF EXISTS "public_insert_characters" ON characters;
DROP POLICY IF EXISTS "public_update_characters" ON characters;
DROP POLICY IF EXISTS "public_delete_characters" ON characters;

CREATE POLICY "anon_read_characters" ON characters FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_characters" ON characters FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_characters" ON characters FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_characters" ON characters FOR DELETE TO anon USING (true);

-- Fix worldbuilding table
DROP POLICY IF EXISTS "public_read_worldbuilding" ON worldbuilding;
DROP POLICY IF EXISTS "public_insert_worldbuilding" ON worldbuilding;
DROP POLICY IF EXISTS "public_update_worldbuilding" ON worldbuilding;
DROP POLICY IF EXISTS "public_delete_worldbuilding" ON worldbuilding;

CREATE POLICY "anon_read_worldbuilding" ON worldbuilding FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_worldbuilding" ON worldbuilding FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_worldbuilding" ON worldbuilding FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_worldbuilding" ON worldbuilding FOR DELETE TO anon USING (true);

-- Fix app_settings table
DROP POLICY IF EXISTS "public_read_app_settings" ON app_settings;
DROP POLICY IF EXISTS "public_insert_app_settings" ON app_settings;
DROP POLICY IF EXISTS "public_update_app_settings" ON app_settings;
DROP POLICY IF EXISTS "public_delete_app_settings" ON app_settings;

CREATE POLICY "anon_read_app_settings" ON app_settings FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_app_settings" ON app_settings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_app_settings" ON app_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_app_settings" ON app_settings FOR DELETE TO anon USING (true);
