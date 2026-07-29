import type { Metadata } from 'next'
import { LanguageProvider } from '@/games/vampires/lib/i18n/LanguageProvider'
import { GlobalMusicEngineMount } from '@/games/vampires/modules/music/components/GlobalMusicEngineMount'
import '@/games/vampires/styles/vampires.css'

export const metadata: Metadata = {
  icons: {
    icon: '/vampires/favicon.ico',
  },
}

export default function VampiresLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <link rel="preconnect" href="https://klhxbaagarqxaqnrvurr.supabase.co" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://klhxbaagarqxaqnrvurr.supabase.co" />
      <LanguageProvider>{children}</LanguageProvider>
      <GlobalMusicEngineMount />
    </>
  )
}
