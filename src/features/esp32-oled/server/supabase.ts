import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/platform/account/config'

let serviceClient: SupabaseClient | null = null

export function getEsp32ServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.')
  if (!serviceClient) {
    serviceClient = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return serviceClient
}

export async function getEsp32UserClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
}

export async function requireEsp32User() {
  const client = await getEsp32UserClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('UNAUTHORIZED')
  return data.user
}

