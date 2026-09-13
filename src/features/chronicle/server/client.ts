import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/platform/account/config'

/**
 * Supabase client for React Server Components. The browser client
 * (`@supabase/ssr`'s `createBrowserClient`, used by `AccountProvider`) keeps
 * the session in cookies, so the server can see who is signed in and let
 * Postgres RLS answer "is this the author?" — the admin gate is therefore a
 * database fact, not a client-side flag.
 *
 * Cookies are read-only inside a Server Component, so `setAll` is a no-op:
 * token refresh stays the browser client's job.
 */
export async function createChronicleServerClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
}
