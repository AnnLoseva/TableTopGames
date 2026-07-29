import { navigateMasterDeepLink, resolveEntityNavigation } from '@/games/vampires/modules/master-console/search/deep-link'

/** Map entity link types → master module deep-link. */
export function moduleForEntityType(entityType: string): { moduleId: string; param: string } | null {
  return resolveEntityNavigation(entityType)
}

/** Unified deep link: /master?room&module&entity (+ allow-listed extras). */
export function navigateToEntity(entityType: string, entityId: string, label?: string) {
  const target = moduleForEntityType(entityType)
  if (!target) {
    if (entityType === 'system_ref') {
      window.open(`/reference?doc=${encodeURIComponent(entityId)}`, '_blank', 'noopener,noreferrer')
    }
    return
  }
  navigateMasterDeepLink({
    moduleId: target.moduleId,
    entityId,
    entityType,
    extras: {
      [target.param]: entityId,
      ...(label ? { label } : {}),
    },
  })
}
