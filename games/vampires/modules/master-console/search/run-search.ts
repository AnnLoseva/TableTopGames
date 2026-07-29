import type {
  MasterSearchContext,
  MasterSearchGroup,
  MasterSearchHit,
  MasterSearchProvider,
  MasterSearchRole,
} from './types'
import { normalizeQuery } from './match'

/**
 * Fan-out search to registered providers only.
 * Shell does NOT know tables — modules own their queries.
 */
export async function runMasterSearch(
  providers: readonly MasterSearchProvider[],
  ctx: MasterSearchContext,
): Promise<{ groups: MasterSearchGroup[]; hits: MasterSearchHit[]; error?: string }> {
  const query = normalizeQuery(ctx.query)
  if (!query) return { groups: [], hits: [] }

  const role = ctx.role
  const eligible = providers.filter(provider => provider.allowedRoles.includes(role))
  const limit = ctx.limit ?? 8

  const results = await Promise.all(
    eligible.map(async provider => {
      try {
        if (ctx.signal?.aborted) return { provider, hits: [] as MasterSearchHit[] }
        const hits = await provider.search({ ...ctx, query, limit })
        return {
          provider,
          hits: hits
            .filter(hit => hit && hit.title)
            .map(hit => ({ ...hit, score: hit.score ?? 0 }))
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, limit),
        }
      } catch (err) {
        console.warn(`[search:${provider.id}]`, err)
        return { provider, hits: [] as MasterSearchHit[] }
      }
    }),
  )

  const groups: MasterSearchGroup[] = results
    .filter(item => item.hits.length > 0)
    .map(item => ({
      id: item.provider.id,
      label: item.provider.label,
      hits: item.hits,
    }))

  const hits = groups
    .flatMap(group => group.hits)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  return { groups, hits }
}

export function filterProvidersForRole(
  providers: readonly MasterSearchProvider[],
  role: MasterSearchRole,
): MasterSearchProvider[] {
  return providers.filter(provider => provider.allowedRoles.includes(role))
}
