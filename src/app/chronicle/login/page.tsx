import { Suspense } from 'react'
import LoginRoute from '@/features/chronicle/routes/LoginRoute'

export const dynamic = 'force-dynamic'

export default function ChronicleLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginRoute />
    </Suspense>
  )
}
