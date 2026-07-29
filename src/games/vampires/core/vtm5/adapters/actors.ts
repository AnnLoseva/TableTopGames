import { normalizeHealthTracker } from '../rules/health'

export type VtmActorKind =
  | 'player_character'
  | 'full_npc'
  | 'compact_spc'
  | 'ghoul'
  | 'mortal'
  | 'thin_blood'
  | 'custom'

export type VtmActorMechanicsInput = {
  kind: VtmActorKind
  attributes: Record<string, number>
  skills: Record<string, number | { dots?: number }>
  disciplines: Record<string, number | Record<string, number>>
  health?: { superficial?: number; aggravated?: number; max?: number }
  willpower?: { superficial?: number; aggravated?: number; max?: number }
  hunger?: number
  humanity?: number
  bloodPotency?: number
}

export type VtmActorRollPoolRequest = {
  traits: readonly string[]
  modifier?: number
}

function traitDots(source: VtmActorMechanicsInput, name: string) {
  const raw: unknown = source.attributes[name] ?? source.skills[name] ?? source.disciplines[name]
  if (typeof raw === 'number') return Math.max(0, raw)
  if (raw && typeof raw === 'object') {
    if ('dots' in raw) return Math.max(0, Number(raw.dots) || 0)
    return Object.values(raw).reduce<number>((total, value) => total + (Number(value) || 0), 0)
  }
  return 0
}

function attributeDots(source: VtmActorMechanicsInput, ru: string, en: string) {
  return traitDots(source, ru) || traitDots(source, en)
}

export function createVtm5ActorAdapter() {
  return {
    calculateDisplayVitals(source: VtmActorMechanicsInput) {
      const stamina = attributeDots(source, 'Выносливость', 'Stamina')
      const composure = attributeDots(source, 'Самообладание', 'Composure')
      const resolve = attributeDots(source, 'Упорство', 'Resolve')
      const damageProfile = source.kind === 'mortal' || source.kind === 'ghoul' ? 'mortal' : source.kind === 'thin_blood' ? 'thinblood' : 'vampire'
      const health = normalizeHealthTracker(
        source.health,
        source.health?.max ?? stamina,
        damageProfile,
      )
      const willpowerMax = Math.max(0, source.willpower?.max ?? composure + resolve)
      const willpowerSuperficial = Math.max(0, Number(source.willpower?.superficial) || 0)
      const willpowerAggravated = Math.max(0, Number(source.willpower?.aggravated) || 0)
      const vampiric = !['mortal', 'ghoul'].includes(source.kind)
      return {
        health,
        willpower: {
          max: willpowerMax,
          current: Math.max(0, willpowerMax - willpowerSuperficial - willpowerAggravated),
          superficial: willpowerSuperficial,
          aggravated: willpowerAggravated,
          impaired: willpowerMax > 0 && willpowerSuperficial + willpowerAggravated >= willpowerMax,
        },
        hunger: vampiric ? Math.max(0, Math.min(5, Number(source.hunger) || 0)) : 0,
        humanity: Math.max(0, Math.min(10, Number(source.humanity) || 0)),
        bloodPotency: vampiric ? Math.max(0, Math.min(10, Number(source.bloodPotency) || 0)) : 0,
      }
    },

    getRollPool(source: VtmActorMechanicsInput, request: VtmActorRollPoolRequest) {
      const parts = request.traits.map(name => ({ name, dots: traitDots(source, name) }))
      const base = parts.reduce((total, part) => total + part.dots, 0)
      const modifier = Number(request.modifier) || 0
      return {
        parts,
        base,
        modifier,
        dice: Math.max(0, base + modifier),
      }
    },
  }
}

export type Vtm5ActorAdapter = ReturnType<typeof createVtm5ActorAdapter>
export type VtmActorDisplayVitals = ReturnType<Vtm5ActorAdapter['calculateDisplayVitals']>
