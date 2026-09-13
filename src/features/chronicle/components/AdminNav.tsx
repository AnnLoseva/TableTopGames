'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './AdminNav.module.css'

const LINKS = [
  { href: '/chronicle/admin/chapters', label: 'Главы' },
  { href: '/chronicle/admin/snapshots', label: 'Точки времени' },
  { href: '/characters_map', label: 'Карта отношений' },
  { href: '/chronicle/admin/settings', label: 'Настройки' },
]

export default function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className={styles.nav}>
      <Link href="/chronicle/admin" className={styles.brand}>
        Кабинет автора
      </Link>
      <div className={styles.links}>
        {LINKS.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`${styles.link} ${pathname.startsWith(link.href) ? styles.active : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className={styles.right}>
        <Link href="/chronicle/admin/chapters/new" className={styles.primary}>+ Глава</Link>
        <Link href="/chronicle" className={styles.link}>Сайт</Link>
      </div>
    </nav>
  )
}
