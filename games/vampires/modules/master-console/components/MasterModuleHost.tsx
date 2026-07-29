'use client'

import { Component, Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_MASTER_MODULE_ID,
  getMasterContribution,
  MASTER_CONSOLE_CONTRIBUTIONS,
} from '../contributions'
import { parseMasterDeepLink, readModuleDeepLinkParams } from '../search/deep-link'
import type { MasterModuleProps, MasterRollRequest } from '../types'

type MasterModuleHostProps = {
  room: string
  activeModuleId: string
  onRequestRoll?: (request: MasterRollRequest) => void
}

type ErrorBoundaryState = { error: string | null }

class ModuleErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error.message : 'Ошибка модуля' }
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <section className="master-module-empty">
          <span>Ошибка модуля</span>
          <h1>Не удалось отрисовать окно</h1>
          <p>{this.state.error}</p>
        </section>
      )
    }
    return this.props.children
  }
}

export default function MasterModuleHost({
  room,
  activeModuleId,
  onRequestRoll,
}: MasterModuleHostProps) {
  const contribution = getMasterContribution(activeModuleId)
    || getMasterContribution(DEFAULT_MASTER_MODULE_ID)
    || MASTER_CONSOLE_CONTRIBUTIONS[0]

  const LazyModule = useMemo(() => {
    if (!contribution) return null
    return lazy(contribution.loader)
  }, [contribution])

  const [deepLinkParams, setDeepLinkParams] = useState<Record<string, string>>({})
  const [entityId, setEntityId] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => {
      if (!contribution) return
      const parsed = parseMasterDeepLink(window.location.search)
      // Always use central parser — never raw URLSearchParams in modules.
      const params = readModuleDeepLinkParams(contribution.id)
      // If URL module differs but we're showing this contribution, still map entity.
      if (parsed.moduleId === contribution.id || parsed.entityId) {
        setDeepLinkParams(params)
        setEntityId(parsed.entityId)
      } else {
        setDeepLinkParams({})
        setEntityId(null)
      }
    }
    sync()
    const onNavigate = () => sync()
    window.addEventListener('master-console:navigate', onNavigate)
    window.addEventListener('popstate', onNavigate)
    return () => {
      window.removeEventListener('master-console:navigate', onNavigate)
      window.removeEventListener('popstate', onNavigate)
    }
  }, [contribution])

  if (!contribution || !LazyModule) {
    return (
      <main className="master-module-host" aria-label="Рабочая область мастерского пульта">
        <section className="master-module-empty">
          <span>Рабочая область</span>
          <h1>Нет зарегистрированных модулей</h1>
          <p>Contribution registry пуст.</p>
        </section>
      </main>
    )
  }

  const moduleProps: MasterModuleProps = {
    room,
    role: 'master',
    deepLinkParams,
    onRequestRoll,
  }

  return (
    <main className="master-module-host master-module-host--filled" aria-label="Рабочая область мастерского пульта">
      {entityId ? (
        <p className="master-deep-link-hint" data-entity={entityId}>
          deep link · entity <code>{entityId.slice(0, 12)}{entityId.length > 12 ? '…' : ''}</code>
          {deepLinkParams.entityType ? ` · ${deepLinkParams.entityType}` : ''}
        </p>
      ) : null}
      <ModuleErrorBoundary resetKey={`${contribution.id}:${entityId || ''}`}>
        <Suspense
          fallback={(
            <section className="master-module-empty">
              <span>{contribution.icon} {contribution.title}</span>
              <h1>Загрузка модуля…</h1>
            </section>
          )}
        >
          <LazyModule {...moduleProps} key={`${contribution.id}:${entityId || 'none'}`} />
        </Suspense>
      </ModuleErrorBoundary>
    </main>
  )
}
