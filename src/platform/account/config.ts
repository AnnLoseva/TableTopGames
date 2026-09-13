/**
 * Supabase connection values, split out of `supabase.ts` so server-side code
 * (React Server Components, which must not pull in the browser client) can
 * reuse the exact same project and anon key.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://klhxbaagarqxaqnrvurr.supabase.co'

export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaHhiYWFnYXJxeGFxbnJ2dXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzkwNjAsImV4cCI6MjA5MzY1NTA2MH0.Cy2496DJgJhqZkERL9h19FkiiTfkcW2pauPaJU5r5oY'
