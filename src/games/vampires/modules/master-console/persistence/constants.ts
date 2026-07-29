export const CHRONICLES = 'chronicles'
export const CHRONICLE_MEMBERS = 'chronicle_members'
export const CHRONICLE_SESSIONS = 'chronicle_sessions'
export const MASTER_LAYOUTS = 'master_layouts'
export const MASTER_MACROS = 'master_macros'
export const CHRONICLE_ENTITY_LINKS = 'chronicle_entity_links'
export const MASTER_ACTION_LOG = 'master_action_log'

export const MASTER_REALTIME_TABLES = [
  CHRONICLE_SESSIONS,
  MASTER_LAYOUTS,
  MASTER_MACROS,
  CHRONICLE_ENTITY_LINKS,
  MASTER_ACTION_LOG,
] as const
