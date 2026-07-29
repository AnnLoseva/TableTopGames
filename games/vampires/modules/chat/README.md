# Chat Module

Runtime module for chronicle room chat: user auth, character selection, message
history, Supabase realtime delivery, and chat UI.

`useChat` owns text chat state for any `chronicleId`; table-specific voice and
master tools still compose around it from the game table.
