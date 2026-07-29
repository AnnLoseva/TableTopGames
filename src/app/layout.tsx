import type { Metadata } from 'next'
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
      <body>{children}</body>
    </html>
  )
}
