import type { Pathfinder2AttributeLevel } from '../../types'

export const ATTRIBUTE_BOOST_LEVELS: Pathfinder2AttributeLevel[] = [5, 10, 15, 20]

export function getAvailableAttributeBoostLevels(characterLevel: number) {
  return ATTRIBUTE_BOOST_LEVELS.filter(level => level <= characterLevel)
}
