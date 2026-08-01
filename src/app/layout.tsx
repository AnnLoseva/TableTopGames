import type { Metadata } from 'next'
import { AccountProvider } from '@/platform/account/AccountProvider'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://annloseva-ttg.xyz'),
  title: {
    default: 'TableTopGames',
    template: '%s · TableTopGames',
  },
  description: 'Цифровые листы персонажей и игровые столы для настольных ролевых игр',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'TableTopGames',
  },
  twitter: {
    card: 'summary',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="dark">
      <body>
        <AccountProvider>{children}</AccountProvider>
      </body>
    </html>
  )
}
