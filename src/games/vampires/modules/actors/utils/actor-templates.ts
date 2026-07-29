import type { ActorTemplate } from '../types'

/**
 * Extensible create templates. UI renders from this list only —
 * do not add per-template JSX branches.
 */
export const ACTOR_TEMPLATES: readonly ActorTemplate[] = [
  {
    id: 'sheriff',
    label: 'Шериф Камарильи',
    kind: 'compact_spc',
    actorRole: 'шериф',
    faction: 'Камарилья',
    status: 'active',
    tags: ['cam', 'enforcer'],
    compactStats: {
      clan: 'Вентру',
      bloodPotency: 3,
      hunger: 1,
      humanity: 5,
      attributes: { Сила: 3, Ловкость: 2, Выносливость: 3, Харизма: 2, Манипулирование: 3, Внешность: 2, Восприятие: 3, Интеллект: 2, Смекалка: 3 },
      skills: { Ближний: 3, Стрельба: 2, Запугивание: 3, Расследование: 2 },
      disciplines: { Potence: 2, Dominate: 2 },
      willpower: { max: 5, superficial: 0, aggravated: 0 },
      health: { max: 6, superficial: 0, aggravated: 0 },
    },
    privateFields: {
      secrets: '',
      motivation: 'Поддерживать Маскарад и порядок князя',
      plans: '',
      notes: 'Шаблон: шериф',
      privateData: {},
    },
  },
  {
    id: 'street_ghoul',
    label: 'Уличный гуль',
    kind: 'ghoul',
    actorRole: 'слуга',
    faction: 'Камарилья',
    status: 'active',
    tags: ['ghoul', 'street'],
    compactStats: {
      bloodPotency: 0,
      hunger: 0,
      humanity: 6,
      attributes: { Сила: 2, Ловкость: 3, Выносливость: 2, Харизма: 1, Манипулирование: 2, Внешность: 1, Восприятие: 3, Интеллект: 2, Смекалка: 3 },
      skills: { Скрытность: 3, Уличное: 3, Атлетика: 2 },
      disciplines: { Potence: 1 },
      willpower: { max: 3, superficial: 0, aggravated: 0 },
      health: { max: 5, superficial: 0, aggravated: 0 },
    },
    privateFields: {
      secrets: '',
      motivation: 'Выжить и добыть витэ',
      plans: '',
      notes: 'Шаблон: уличный гуль',
      privateData: {},
    },
  },
  {
    id: 'si_hunter',
    label: 'Охотник ВИ',
    kind: 'mortal',
    actorRole: 'охотник',
    faction: 'Инквизиция',
    status: 'active',
    tags: ['si', 'hunter'],
    compactStats: {
      bloodPotency: 0,
      hunger: 0,
      humanity: 7,
      attributes: { Сила: 3, Ловкость: 3, Выносливость: 3, Харизма: 2, Манипулирование: 2, Внешность: 2, Восприятие: 3, Интеллект: 3, Смекалка: 3 },
      skills: { Стрельба: 3, Расследование: 3, Скрытность: 2, Технология: 2 },
      disciplines: {},
      willpower: { max: 5, superficial: 0, aggravated: 0 },
      health: { max: 6, superficial: 0, aggravated: 0 },
    },
    privateFields: {
      secrets: '',
      motivation: 'Выявить и нейтрализовать каинитов',
      plans: '',
      notes: 'Шаблон: Second Inquisition',
      privateData: {},
    },
  },
  {
    id: 'mortal',
    label: 'Смертный',
    kind: 'mortal',
    actorRole: 'смертный',
    faction: 'смертные',
    status: 'active',
    tags: ['mortal'],
    compactStats: {
      bloodPotency: 0,
      hunger: 0,
      humanity: 7,
      attributes: { Сила: 2, Ловкость: 2, Выносливость: 2, Харизма: 2, Манипулирование: 2, Внешность: 2, Восприятие: 2, Интеллект: 2, Смекалка: 2 },
      skills: {},
      disciplines: {},
      willpower: { max: 4, superficial: 0, aggravated: 0 },
      health: { max: 5, superficial: 0, aggravated: 0 },
    },
  },
  {
    id: 'custom',
    label: 'Свой…',
    kind: 'custom',
    actorRole: '',
    faction: '',
    status: 'active',
    tags: [],
    compactStats: {
      bloodPotency: 1,
      hunger: 1,
      humanity: 7,
      attributes: {},
      skills: {},
      disciplines: {},
      willpower: { max: 4, superficial: 0, aggravated: 0 },
      health: { max: 5, superficial: 0, aggravated: 0 },
    },
  },
] as const

export function getActorTemplate(id: string): ActorTemplate | undefined {
  return ACTOR_TEMPLATES.find(template => template.id === id)
}
