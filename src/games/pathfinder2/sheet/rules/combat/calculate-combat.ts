import type {
  Pathfinder2ArmorRule,
  Pathfinder2CalculatedAttack,
  Pathfinder2CalculatedInventory,
  Pathfinder2CalculatedProficiency,
  Pathfinder2CharacterSource,
  Pathfinder2ProficiencyRank,
  Pathfinder2RulesCatalog,
  Pathfinder2WeaponRule,
} from '../../types'

const CUSTOM_SOURCE: Pathfinder2CharacterSource = {
  type: 'custom',
  id: 'base-rule',
  label: 'Базовая формула',
}

function matchingProficiency(
  proficiencies: Pathfinder2CalculatedProficiency[],
  category: 'weapon' | 'armor',
  targetId: string,
) {
  return proficiencies.find(proficiency => (
    proficiency.category === category
    && (
      proficiency.targetId === targetId
      || (category === 'armor' && proficiency.targetId === 'all-armor')
    )
  ))
}

export function calculateArmorClass({
  dexterityModifier,
  strengthModifier,
  inventory,
  proficiencies,
  catalog,
  shieldRaised = false,
}: {
  dexterityModifier: number
  strengthModifier: number
  inventory: Pathfinder2CalculatedInventory
  proficiencies: Pathfinder2CalculatedProficiency[]
  catalog: Pathfinder2RulesCatalog
  shieldRaised?: boolean
}) {
  const armorIds = new Set(catalog.armor.map(item => item.id))
  const armorEntry = inventory.entries.find(entry => (
    entry.equipped && armorIds.has(entry.itemId)
  ))
  const armor = catalog.armor.find(item => item.id === armorEntry?.itemId)
  const armorCategory = armor?.armorCategory ?? 'unarmored'
  const proficiency = matchingProficiency(proficiencies, 'armor', armorCategory)
  // Без надетой брони предел Ловкости не действует. У самой тяжёлой брони
  // dexterityCap реально равен 0 (Ловкость не добавляется вовсе) — это не
  // то же самое, что отсутствие ограничения.
  const dexterity = armor
    ? Math.min(dexterityModifier, armor.dexterityCap)
    : dexterityModifier
  const equippedShield = catalog.shields.find(shield => (
    inventory.entries.some(entry => entry.equipped && entry.itemId === shield.id)
  )) ?? null
  // Бонус щита работает только при действии «Поднять щит».
  const shield = shieldRaised ? equippedShield : null
  const value = 10
    + dexterity
    + (proficiency?.bonus ?? 0)
    + (armor?.armorBonus ?? 0)
    + (shield?.armorClassBonus ?? 0)

  // Требование брони к Силе: при его выполнении штраф к навыкам исчезает,
  // а штраф к скорости уменьшается на 5 футов.
  const meetsStrength = Boolean(armor) && strengthModifier >= (armor?.strengthRequirement ?? 0)
  return {
    value,
    shieldBonus: equippedShield?.armorClassBonus ?? 0,
    checkPenalty: armor && !meetsStrength ? armor.checkPenalty : 0,
    speedPenalty: armor
      ? (meetsStrength ? Math.min(0, armor.speedPenalty + 5) : armor.speedPenalty)
      : 0,
    breakdown: [
      { label: 'Базовое значение', value: 10, source: CUSTOM_SOURCE },
      { label: 'Ловкость с учётом максимума брони', value: dexterity, source: CUSTOM_SOURCE },
      {
        label: `Владение: ${armorCategory}`,
        value: proficiency?.bonus ?? 0,
        source: proficiency?.sources[0] ?? CUSTOM_SOURCE,
      },
      ...(armor ? [{
        label: armor.name,
        value: armor.armorBonus,
        source: {
          type: 'equipment' as const,
          id: armor.id,
          label: armor.name,
        },
      }] : []),
      ...(shield ? [{
        label: `${shield.name} · поднят`,
        value: shield.armorClassBonus,
        source: {
          type: 'equipment' as const,
          id: shield.id,
          label: shield.name,
        },
      }] : []),
    ],
  }
}

function weaponAttribute(
  weapon: Pathfinder2WeaponRule,
  strength: number,
  dexterity: number,
) {
  if (weapon.usage === 'ranged') return dexterity
  if (weapon.traits.includes('finesse')) return Math.max(strength, dexterity)
  return strength
}

function damageAttribute(weapon: Pathfinder2WeaponRule, strength: number) {
  if (weapon.usage === 'melee' || weapon.usage === 'thrown') return strength
  if (weapon.traits.includes('propulsive')) return Math.floor(Math.max(0, strength) / 2)
  return 0
}

export function calculateAttacks({
  strengthModifier,
  dexterityModifier,
  inventory,
  proficiencies,
  catalog,
}: {
  strengthModifier: number
  dexterityModifier: number
  inventory: Pathfinder2CalculatedInventory
  proficiencies: Pathfinder2CalculatedProficiency[]
  catalog: Pathfinder2RulesCatalog
}): Pathfinder2CalculatedAttack[] {
  return inventory.entries.flatMap(entry => {
    if (!entry.equipped) return []
    const weapon = catalog.weapons.find(item => item.id === entry.itemId)
    if (!weapon) return []
    const proficiency = matchingProficiency(
      proficiencies,
      'weapon',
      weapon.proficiencyCategory,
    )
    const rank: Pathfinder2ProficiencyRank = proficiency?.rank ?? 'untrained'
    const attribute = weaponAttribute(weapon, strengthModifier, dexterityModifier)
    const damageBonus = damageAttribute(weapon, strengthModifier)
    const damage = `${weapon.damageDice.count}d${weapon.damageDice.size}${
      damageBonus > 0 ? `+${damageBonus}` : damageBonus < 0 ? damageBonus : ''
    }`
    return [{
      id: `attack:${entry.id}`,
      inventoryEntryId: entry.id,
      weaponId: weapon.id,
      name: entry.customName || weapon.name,
      attackModifier: attribute + (proficiency?.bonus ?? 0),
      damage,
      damageType: weapon.damageType,
      range: weapon.range,
      reload: weapon.reload,
      traits: weapon.traits,
      proficiencyRank: rank,
      breakdown: [
        {
          label: weapon.usage === 'ranged' ? 'Ловкость' : 'Характеристика атаки',
          value: attribute,
          source: CUSTOM_SOURCE,
        },
        {
          label: `Владение: ${weapon.proficiencyCategory}`,
          value: proficiency?.bonus ?? 0,
          source: proficiency?.sources[0] ?? CUSTOM_SOURCE,
        },
      ],
    }]
  })
}

export function equippedArmor(
  inventory: Pathfinder2CalculatedInventory,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2ArmorRule | null {
  return catalog.armor.find(armor => (
    inventory.entries.some(entry => entry.equipped && entry.itemId === armor.id)
  )) ?? null
}
