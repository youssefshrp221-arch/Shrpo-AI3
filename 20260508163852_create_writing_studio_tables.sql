/*
  # Create writing studio tables

  1. New Tables
    - `writing_projects` - Novel writing projects
    - `chapters` - Story chapters per project
    - `characters` - Character database per project
    - `worldbuilding` - World lore entries per project
    - `app_settings` - User preferences/settings

  2. Security
    - RLS enabled, public access (no auth system)
*/

CREATE TABLE IF NOT EXISTS writing_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Untitled Project',
  genre text DEFAULT '',
  summary text DEFAULT '',
  word_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE writing_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_writing_projects" ON writing_projects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_writing_projects" ON writing_projects FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_writing_projects" ON writing_projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_writing_projects" ON writing_projects FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES writing_projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Chapter 1',
  content text DEFAULT '',
  chapter_order integer DEFAULT 0,
  summary text DEFAULT '',
  word_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chapters_project_id ON chapters(project_id);

ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_chapters" ON chapters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_chapters" ON chapters FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_chapters" ON chapters FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_chapters" ON chapters FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES writing_projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  traits text[] DEFAULT '{}',
  backstory text DEFAULT '',
  role text DEFAULT 'supporting',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_characters" ON characters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_characters" ON characters FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_characters" ON characters FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_characters" ON characters FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS worldbuilding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES writing_projects(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'lore',
  title text NOT NULL DEFAULT '',
  content text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worldbuilding_project_id ON worldbuilding(project_id);

ALTER TABLE worldbuilding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_worldbuilding" ON worldbuilding FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_worldbuilding" ON worldbuilding FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_worldbuilding" ON worldbuilding FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_worldbuilding" ON worldbuilding FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_app_settings" ON app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_app_settings" ON app_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_app_settings" ON app_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_app_settings" ON app_settings FOR DELETE TO anon, authenticated USING (true);
