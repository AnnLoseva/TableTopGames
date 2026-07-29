import type { Metadata } from 'next'
import { AccountProvider } from '@/platform/account/AccountProvider'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'TableTopGames',
    template: '%s · TableTopGames',
  },
  description: 'Цифровые листы персонажей и игровые столы для настольных ролевых игр',
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
