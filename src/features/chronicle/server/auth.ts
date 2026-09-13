import 'server-only'
import { redirect } from 'next/navigation'
import { CHRONICLE_OWNER_AUTH_USER_ID } from '../constants'
import { createChronicleServerClient } from './client'

export type AuthorSession = { userId: string; email: string | null }

/**
 * Who is signed in, according to the auth cookie — verified against Supabase,
 * not trusted from the cookie's own contents.
 */
export async function getAuthorSession(): Promise<AuthorSession | null> {
  const client = await createChronicleServerClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  if (data.user.id !== CHRONICLE_OWNER_AUTH_USER_ID) return null
  return { userId: data.user.id, email: data.user.email ?? null }
}

/**
 * The admin gate, used by `/chronicle/admin`'s layout. Note that this redirect
 * is convenience, not the security boundary: even if someone reached an admin
 * page, every chapter query behind it is refused by RLS unless the session is
 * the author's. There is no admin API to reach by guessing a URL.
 */
export async function requireAuthor(returnTo?: string): Promise<AuthorSession> {
  const session = await getAuthorSession()
  if (!session) {
    redirect(returnTo ? `/chronicle/login?next=${encodeURIComponent(returnTo)}` : '/chronicle/login')
  }
  return session
}
