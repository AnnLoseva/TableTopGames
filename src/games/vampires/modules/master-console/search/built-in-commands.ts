import { MASTER_CONSOLE_CONTRIBUTIONS } from '../contributions'
import { getMasterMembership } from '../api'
import type { MasterCommand, MasterCommandContext } from './types'

async function requireChronicleId(room: string): Promise<string> {
  const membership = await getMasterMembership(room).catch(() => null)
  if (membership?.chronicleId) return membership.chronicleId
  // Local-dev fallback so commands still open the module even without Auth
  return `local-${room}`
}

export function buildBuiltInCommands(): MasterCommand[] {
  const openModuleCommands: MasterCommand[] = MASTER_CONSOLE_CONTRIBUTIONS.map(contrib => ({
    id: `open-module:${contrib.id}`,
    title: `Открыть: ${contrib.title}`,
    subtitle: contrib.id,
    keywords: ['open', 'module', contrib.id, contrib.title, contrib.shortTitle || ''],
    group: 'Модули',
    icon: contrib.icon,
    run: (ctx: MasterCommandContext) => {
      ctx.navigate({ moduleId: contrib.id })
    },
  }))

  const actions: MasterCommand[] = [
    {
      id: 'create-actor',
      title: 'Создать actor',
      subtitle: 'Компактный NPC/актор',
      keywords: ['create', 'actor', 'npc', 'создать'],
      group: 'Создание',
      icon: '♟',
      run: async (ctx) => {
        const { createActorFromTemplate } = await import('@/games/vampires/modules/actors/services/actor-actions')
        const chronicleId = await requireChronicleId(ctx.room)
        try {
          const actor = await createActorFromTemplate({
            chronicleId,
            room: ctx.room,
            templateId: 'custom',
            name: 'Новый актор',
          })
          ctx.navigate({ moduleId: 'actors', entityId: actor.id, entityType: 'actor' })
          ctx.setStatus?.(`Актор создан: ${actor.name}`)
        } catch (err) {
          // Still open module for manual create when remote fails
          ctx.navigate({ moduleId: 'actors' })
          ctx.setStatus?.(err instanceof Error ? err.message : 'Не удалось создать актора')
        }
      },
    },
    {
      id: 'create-scene',
      title: 'Создать scene',
      subtitle: 'Новая сцена (draft)',
      keywords: ['create', 'scene', 'сцена'],
      group: 'Создание',
      icon: '▣',
      run: async (ctx) => {
        const { createMasterScene } = await import('@/games/vampires/modules/master-scenes/services/scene-shell-service')
        try {
          const scene = await createMasterScene({ room: ctx.room, name: 'Новая сцена' })
          ctx.navigate({ moduleId: 'scenes', entityId: scene.id, entityType: 'scene' })
          ctx.setStatus?.(`Сцена создана: ${scene.name}`)
        } catch (err) {
          ctx.navigate({ moduleId: 'scenes' })
          ctx.setStatus?.(err instanceof Error ? err.message : 'Не удалось создать сцену')
        }
      },
    },
    {
      id: 'create-note',
      title: 'Создать note',
      subtitle: 'Заметка сессии (private)',
      keywords: ['create', 'note', 'заметка'],
      group: 'Создание',
      icon: '📝',
      run: async (ctx) => {
        const { upsertSessionNote } = await import('@/games/vampires/modules/master-overview/api')
        const chronicleId = await requireChronicleId(ctx.room)
        const now = new Date().toISOString()
        const note = {
          id: crypto.randomUUID(),
          chronicleId,
          room: ctx.room,
          sessionId: null as string | null,
          title: 'Новая заметка',
          bodyHtml: '',
          entityType: '',
          entityId: '',
          visibility: 'master' as const,
          createdBy: 'local',
          createdAt: now,
          updatedAt: now,
        }
        try {
          await upsertSessionNote(note)
          ctx.navigate({ moduleId: 'overview', entityId: note.id, entityType: 'note' })
          ctx.setStatus?.('Заметка создана')
        } catch (err) {
          ctx.navigate({ moduleId: 'overview' })
          ctx.setStatus?.(err instanceof Error ? err.message : 'Не удалось создать заметку')
        }
      },
    },
    {
      id: 'run-macro',
      title: 'Запустить macro',
      subtitle: 'Открыть обзор / макросы (registry)',
      keywords: ['macro', 'макрос', 'run'],
      group: 'Действия',
      icon: '▶',
      run: (ctx) => {
        ctx.navigate({ moduleId: 'overview', extras: { focus: 'macros' } })
        ctx.setStatus?.('Макросы: выберите в панели (фаза macros)')
      },
    },
    {
      id: 'open-layout',
      title: 'Открыть layout',
      subtitle: 'Раскладки пульта',
      keywords: ['layout', 'раскладка'],
      group: 'Действия',
      icon: '▦',
      run: (ctx) => {
        ctx.navigate({ moduleId: 'overview', extras: { layout: 'default' } })
        ctx.setStatus?.('Layouts: persistence готова, UI presets — в следующей фазе')
      },
    },
    {
      id: 'publish-current-scene',
      title: 'Publish current scene',
      subtitle: 'Показать активную/выбранную сцену игрокам',
      keywords: ['publish', 'scene', 'показать', 'сцена'],
      group: 'Опасные',
      icon: '☢',
      dangerous: true,
      confirmMessage: 'Опубликовать текущую сцену игрокам? Это сменит active scene на /table.',
      run: async (ctx) => {
        const { loadRoomScenes, publishSceneToPlayers } = await import(
          '@/games/vampires/modules/master-scenes/services/scene-shell-service'
        )
        const chronicleId = await requireChronicleId(ctx.room)
        const scenes = await loadRoomScenes(ctx.room)
        const target = scenes.find(scene => scene.isActive) || scenes[0]
        if (!target) {
          ctx.setStatus?.('Нет сцен для публикации')
          ctx.navigate({ moduleId: 'scenes' })
          return
        }
        await publishSceneToPlayers({
          room: ctx.room,
          sceneId: target.id,
          chronicleId,
        })
        ctx.navigate({ moduleId: 'scenes', entityId: target.id, entityType: 'scene' })
        ctx.setStatus?.(`Сцена «${target.name}» показана игрокам`)
      },
    },
    {
      id: 'open-roller',
      title: 'Открыть roller',
      subtitle: 'Фокус на правый rail',
      keywords: ['roll', 'roller', 'бросок', 'кости'],
      group: 'Действия',
      icon: '⚄',
      run: (ctx) => {
        ctx.openRoller()
        ctx.setStatus?.('Роллер в правом rail')
      },
    },
    {
      id: 'open-detached',
      title: 'Открыть в отдельном окне',
      subtitle: 'display=detached · второй монитор',
      keywords: ['detach', 'window', 'monitor', 'окно', 'монитор'],
      group: 'Окна',
      icon: '⧉',
      run: async (ctx) => {
        const { openDetachedMasterWindow } = await import('../multi-window')
        const result = openDetachedMasterWindow({ room: ctx.room, moduleId: 'overview' })
        if (!result.ok) ctx.setStatus?.(result.message)
        else ctx.setStatus?.('Отдельное окно открыто')
      },
    },
  ]

  return [...openModuleCommands, ...actions]
}

export function filterCommands(commands: readonly MasterCommand[], query: string): MasterCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...commands]
  return commands.filter(command => {
    const hay = [
      command.title,
      command.subtitle || '',
      command.group,
      ...(command.keywords || []),
    ].join(' ').toLowerCase()
    return hay.includes(q)
  })
}
