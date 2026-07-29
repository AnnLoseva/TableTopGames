export const SESSION_LOG_ENTRIES = 'session_log_entries'
export const SESSION_LOG_PUBLISHED = 'session_log_published'

export const SESSION_LOG_LOCAL_KEY = (room: string) => `vtm-session-log:${room}`
export const SESSION_LOG_PUBLISHED_LOCAL_KEY = (room: string) => `vtm-session-log-published:${room}`

export const AUTOSAVE_DEBOUNCE_MS = 750
