'use client'

import { MASTER_CONSOLE_CONTRIBUTIONS } from '../contributions'
import type { MasterLayout } from '../persistence/types'

type MasterConsoleSidebarProps = {
  activeModuleId: string
  onSelectModule: (id: string) => void
  actorCount?: number
  layouts?: readonly MasterLayout[]
  activeLayoutId?: string | null
  onSelectLayout?: (id: string) => void
  onOpenDetachedModule?: (id: string) => void
}

export default function MasterConsoleSidebar({
  activeModuleId,
  onSelectModule,
  actorCount,
  layouts = [],
  activeLayoutId,
  onSelectLayout,
  onOpenDetachedModule,
}: MasterConsoleSidebarProps) {
  const modules = [...MASTER_CONSOLE_CONTRIBUTIONS]
    .map(item => ({
      id: item.id,
      icon: item.icon,
      title: item.shortTitle || item.title,
      enabled: true as const,
      badge: item.id === 'actors' && typeof actorCount === 'number' ? String(actorCount) : undefined,
      order: item.order,
    }))
    .sort((a, b) => a.order - b.order)

  return (
    <aside className="master-console-sidebar" aria-label="Навигация пульта">
      <section>
        <h2>Модули</h2>
        <ul>
          {modules.map(item => (
            <li key={item.id} data-active={activeModuleId === item.id ? 'true' : undefined}>
              <div className="master-sidebar-module-row">
                <button type="button" onClick={() => onSelectModule(item.id)}>
                  <span>{item.icon} {item.title}</span>
                  {item.badge ? <em>{item.badge}</em> : null}
                </button>
                {onOpenDetachedModule ? (
                  <button
                    type="button"
                    className="master-sidebar-detach"
                    title="Открыть в отдельном окне"
                    onClick={() => onOpenDetachedModule(item.id)}
                  >
                    ⧉
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Раскладки</h2>
        {layouts.length === 0 ? (
          <p className="master-sidebar-empty">
            Только default. Сохраните layout кнопкой в topbar — доступен на других устройствах при Auth+RLS.
          </p>
        ) : (
          <ul>
            {layouts.map(layout => (
              <li key={layout.id} data-active={layout.id === activeLayoutId ? 'true' : undefined}>
                <button
                  type="button"
                  onClick={() => onSelectLayout?.(layout.id)}
                >
                  <span>{layout.isDefault ? '★ ' : ''}{layout.name}</span>
                  <em>v{layout.layoutVersion}</em>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Макросы</h2>
        <p className="master-sidebar-empty">
          Command palette (⌘K) → «Запустить macro». Полный registry — следующая фаза.
        </p>
      </section>
    </aside>
  )
}
