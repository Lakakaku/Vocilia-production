import { createBrowserClient } from '@supabase/supabase-js'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ybrbeejvjbccqmewczte.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmJlZWp2amJjY3FtZXdjenRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxODk1NjYsImV4cCI6MjA3Mjc2NTU2Nn0.HYaafhJJwhOJxJ38xQTQzRfZNiJaJUNjrqO9LnGVUFA'
  )
}