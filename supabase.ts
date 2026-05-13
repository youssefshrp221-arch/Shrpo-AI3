import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

let sessionId = ''

export function initializeSessionId() {
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem('session_id', sessionId)
  }
  return sessionId
}

export function getSessionId() {
  if (!sessionId) {
    sessionId = localStorage.getItem('session_id') || ''
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      localStorage.setItem('session_id', sessionId)
    }
  }
  return sessionId
}

export type Database = {
  public: {
    Tables: {
      chats: {
        Row: {
          id: string
          title: string
          pinned: boolean
          model: string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["chats"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["chats"]["Row"]>
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          role: "user" | "assistant" | "system"
          content: string
          model: string | null
          tokens: number
          attachments: any[]
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["messages"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>
      }
      writing_projects: {
        Row: {
          id: string
          title: string
          genre: string
          summary: string
          word_count: number
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["writing_projects"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["writing_projects"]["Row"]>
      }
      chapters: {
        Row: {
          id: string
          project_id: string
          title: string
          content: string
          chapter_order: number
          summary: string
          word_count: number
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["chapters"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["chapters"]["Row"]>
      }
      characters: {
        Row: {
          id: string
          project_id: string
          name: string
          description: string
          traits: string[]
          backstory: string
          role: string
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["characters"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["characters"]["Row"]>
      }
      worldbuilding: {
        Row: {
          id: string
          project_id: string
          category: string
          title: string
          content: string
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["worldbuilding"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["worldbuilding"]["Row"]>
      }
      app_settings: {
        Row: {
          id: string
          key: string
          value: any
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["app_settings"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["app_settings"]["Row"]>
      }
    }
  }
}
