// lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'
import { SpeedInsights } from "@vercel/speed-insights/next"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klhxbaagarqxaqnrvurr.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaHhiYWFnYXJxeGFxbnJ2dXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzkwNjAsImV4cCI6MjA5MzY1NTA2MH0.Cy2496DJgJhqZkERL9h19FkiiTfkcW2pauPaJU5r5oY'

export const createClient = () =>
  createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const showSpeedInsights = SpeedInsights

