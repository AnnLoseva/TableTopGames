import type { Metadata } from 'next'
import '@/features/chronicle/chronicle.css'

export const metadata: Metadata = {
  title: {
    default: 'Хроника',
    template: '%s · Хроника',
  },
  description: 'Авторская хроника',
}

export default function ChronicleLayout({ children }: { children: React.ReactNode }) {
  return <div className="chronicle">{children}</div>
}
