# Music Module

Runtime module for shared room music: synced playback state, local-audio and
YouTube adapters, music library helpers, and the persistent global engine mount.

The root layout owns `GlobalMusicEngineMount`, while table UI renders
`MusicPlayer` for controls and library management.
