/*
  # Create chats and messages tables

  1. New Tables
    - `chats` - Chat sessions with title, pinned status, model
    - `messages` - Chat messages with role, content, attachments

  2. Security
    - RLS enabled, public access (no auth system)
*/

CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'New Chat',
  pinned boolean DEFAULT false,
  model text DEFAULT 'meta/llama-3.1-405b-instruct',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_chats" ON chats FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_chats" ON chats FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_chats" ON chats FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_chats" ON chats FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL DEFAULT '',
  model text,
  tokens integer DEFAULT 0,
  attachments jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_messages" ON messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_messages" ON messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_messages" ON messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_messages" ON messages FOR DELETE TO anon, authenticated USING (true);
