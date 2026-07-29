import { normalizeActor, getActorRollPool } from '@/games/vampires/modules/actors/services/actor-service'
import type { MasterActor } from '@/games/vampires/modules/actors/types'
import type { CoterieMemberCard, CoterieSummary, SceneNpcCard } from '../types'
import { selectMemberWarnings } from './warnings-selectors'

function isPcActor(actor: MasterActor): boolean {
  return actor.kind === 'player_character'
    || Boolean(actor.characterId && actor.linkedCharacter && actor.kind !== 'full_npc' && actor.kind !== 'compact_spc')
}

/** Prefer explicit PC kind; fall back to linked player sheets that are not SPCs. */
export function selectCoterieActors(actors: readonly MasterActor[]): MasterActor[] {
  const explicit = actors.filter(actor => actor.kind === 'player_character' && actor.status !== 'archived')
  if (explicit.length) return explicit
  return actors.filter(actor => (
    actor.status !== 'archived'
    && actor.characterId
    && actor.linkedCharacter
    && !['compact_spc', 'full_npc', 'mortal', 'ghoul'].includes(actor.kind)
  ))
}

export function selectCoterieMemberCard(actor: MasterActor): CoterieMemberCard {
  const normalized = normalizeActor(actor)
  const linked = actor.linkedCharacter
  const health = normalized.vitals.health
  const willpower = normalized.vitals.willpower
  const stains = linked?.humanity?.stains ?? 0
  const humanity = linked?.humanity?.value ?? normalized.vitals.humanity
  const touchstones = (linked?.morality?.touchstones || [])
    .map(item => item.name)
    .filter(Boolean)
  const warnings = selectMemberWarnings({
    hunger: normalized.vitals.hunger,
    health,
    willpower,
    stains,
    physicalState: linked?.physicalState || health.physicalState,
  })
  const critical = warnings.some(item => item.startsWith('!'))
    || normalized.vitals.hunger >= 5
    || health.defeated
    || willpower.impaired

  return {
    actorId: actor.id,
    characterId: actor.characterId,
    displayName: normalized.displayName,
    playerName: linked?.username || linked?.name || '—',
    portraitUrl: normalized.displayImage,
    hunger: normalized.vitals.hunger,
    healthCurrent: health.current,
    healthMax: health.max,
    willpowerCurrent: willpower.current,
    willpowerMax: willpower.max,
    humanity,
    stains,
    touchstones,
    warnings,
    critical,
    status: actor.status,
  }
}

export function selectCoterieSummary(
  actors: readonly MasterActor[],
  openConsequenceCount = 0,
): CoterieSummary {
  const members = selectCoterieActors(actors).map(selectCoterieMemberCard)
  const hungers = members.map(member => member.hunger)
  const averageHunger = hungers.length
    ? Math.round((hungers.reduce((sum, value) => sum + value, 0) / hungers.length) * 10) / 10
    : null
  const highHungerCount = members.filter(member => member.hunger >= 4).length
  const criticalCount = members.filter(member => member.critical).length
  const anchorCounts = new Map<string, number>()
  for (const member of members) {
    for (const anchor of member.touchstones) {
      anchorCounts.set(anchor, (anchorCounts.get(anchor) || 0) + 1)
    }
  }
  const sharedAnchors = [...anchorCounts.entries()]
    .filter(([, count]) => count >= 1)
    .map(([name]) => name)
    .slice(0, 8)

  return {
    members,
    averageHunger,
    highHungerCount,
    criticalCount,
    sharedAnchors,
    openConsequenceCount,
  }
}

export function selectSceneNpcs(
  actors: readonly MasterActor[],
  activeSceneId: string | null,
): SceneNpcCard[] {
  if (!activeSceneId) return []
  return actors
    .filter(actor => (
      actor.currentSceneId === activeSceneId
      && actor.status !== 'archived'
      && !isPcActor(actor)
    ))
    .map(actor => {
      const normalized = normalizeActor(actor)
      const pool = getActorRollPool(actor, ['Харизма', 'Убеждение'])
      const privateFields = actor.privateFields
      const hiddenSecrets = Boolean(
        privateFields?.secrets?.trim()
        || privateFields?.motivation?.trim()
        || privateFields?.plans?.trim(),
      )
      return {
        actorId: actor.id,
        characterId: actor.characterId,
        displayName: normalized.displayName,
        portraitUrl: normalized.displayImage,
        bloodPotency: normalized.vitals.bloodPotency,
        hunger: normalized.vitals.hunger,
        role: actor.actorRole || normalized.kind,
        status: actor.status,
        kind: actor.kind,
        hiddenSecrets,
        poolDice: pool.dice || 1,
      }
    })
}
