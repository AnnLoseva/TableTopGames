import { createClient } from '@/games/vampires/lib/supabase'
import { MASTER_PLOT_HOOKS, PLOTS_LOCAL_KEY } from '../constants'
import { mapPlotHookRow, toPlotHookRow } from '../mappers'
import type { PlotHook, PlotHookRow } from '../types'

const PLOT_SELECT = 'id, chronicle_id, room, title, next_step, heat, status, related_actor_ids, related_location_ids, related_session_ids, lore_entry_id, sort_order, created_by, created_at, updated_at'

function readLocalPlots(room: string): PlotHook[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PLOTS_LOCAL_KEY(room))
    if (!raw) return []
    const parsed = JSON.parse(raw) as PlotHook[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalPlots(room: string, plots: PlotHook[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PLOTS_LOCAL_KEY(room), JSON.stringify(plots))
}

export async function fetchPlotHooks(room: string): Promise<{ plots: PlotHook[]; source: 'remote' | 'local' }> {
  try {
    const { data, error } = await createClient()
      .from(MASTER_PLOT_HOOKS)
      .select(PLOT_SELECT)
      .eq('room', room)
      .neq('status', 'archived')
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false })
    if (error) throw error
    return {
      plots: (data || []).map(row => mapPlotHookRow(row as PlotHookRow)),
      source: 'remote',
    }
  } catch {
    return {
      plots: readLocalPlots(room).filter(plot => plot.status !== 'archived'),
      source: 'local',
    }
  }
}

export async function upsertPlotHook(plot: PlotHook): Promise<{ source: 'remote' | 'local' }> {
  try {
    const { error } = await createClient()
      .from(MASTER_PLOT_HOOKS)
      .upsert(toPlotHookRow(plot), { onConflict: 'id' })
    if (error) throw error
    return { source: 'remote' }
  } catch {
    const existing = readLocalPlots(plot.room)
    writeLocalPlots(plot.room, [plot, ...existing.filter(item => item.id !== plot.id)])
    return { source: 'local' }
  }
}

export async function archivePlotHook(room: string, plotId: string): Promise<void> {
  try {
    const { error } = await createClient()
      .from(MASTER_PLOT_HOOKS)
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', plotId)
    if (error) throw error
  } catch {
    writeLocalPlots(
      room,
      readLocalPlots(room).map(plot => (
        plot.id === plotId
          ? { ...plot, status: 'archived' as const, updatedAt: new Date().toISOString() }
          : plot
      )),
    )
  }
}
