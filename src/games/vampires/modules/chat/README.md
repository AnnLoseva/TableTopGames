# Chat Module

Runtime module for chronicle room chat: user auth, character selection, message
history, Supabase realtime delivery, and chat UI.

`useChat` owns text chat state for any `chronicleId`; table-specific voice and
master tools still compose around it from the game table.

`ChatPanel` stays presentational for two indicators the table computes:
`speaking` per voice participant (local VAD in
`table/utils/voice-audio-pipeline.ts`, no signalling) and `unreadChatCount`
(`table/hooks/useUnreadFeed.ts`), which clears as soon as the "Текст" sub-tab is
open.
