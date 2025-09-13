import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ybrbeejvjbccqmewczte.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmJlZWp2amJjY3FtZXdjenRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxODk1NjYsImV4cCI6MjA3Mjc2NTU2Nn0.OOJLkQtVCJIyIRyGCjyJuvZ-DSRLzVQCL5UGzGEJ41Y'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'ai-feedback-auth',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})