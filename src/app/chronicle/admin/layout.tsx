import AdminNav from '@/features/chronicle/components/AdminNav'
import { requireAuthor } from '@/features/chronicle/server/auth'

// Every admin page is dynamic and never cached: it renders behind an auth
// check and shows unpublished work.
export const dynamic = 'force-dynamic'

export default async function ChronicleAdminLayout({ children }: { children: React.ReactNode }) {
  // Redirects to the login page when the session is not the author's. The real
  // boundary is RLS — see `server/auth.ts`.
  await requireAuthor('/chronicle/admin')
  return (
    <>
      <AdminNav />
      {children}
    </>
  )
}
