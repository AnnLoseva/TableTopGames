'use client'

import { useAccount } from './AccountProvider'

export default function AccountBadge({ className }: { className?: string }) {
  const { account, isReady } = useAccount()
  return (
    <span className={className}>
      {!isReady ? 'Проверяю аккаунт…' : account ? `Аккаунт: ${account.username}` : 'Гостевой режим'}
    </span>
  )
}
