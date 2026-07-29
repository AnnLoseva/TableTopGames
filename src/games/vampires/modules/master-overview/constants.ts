export const MASTER_SESSION_NOTES = 'master_session_notes'
export const MASTER_PLOT_HOOKS = 'master_plot_hooks'

export const NOTES_LOCAL_KEY = (room: string) => `vtm-master-session-notes:${room}`
export const PLOTS_LOCAL_KEY = (room: string) => `vtm-master-plot-hooks:${room}`
