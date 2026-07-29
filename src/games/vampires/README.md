# Vampire: The Masquerade V5

VTM game-domain boundary for TableTopGames.

The production VTM implementation is consolidated here:

- `core/` — VTM runtime bootstrap, adapters and pure V5 rules;
- `modules/` — VTM screens and feature modules;
- `lib/` — VTM i18n and Supabase client;
- `scripts/` — VTM audits and tests;
- `supabase/` — VTM schema and Edge Functions;
- `styles/` — VTM-only global theme.

VTM App Router entries live in `src/app/(vampires)/vampires/`; the route group does not
change public URLs. Legacy browser assets live in `public/vampires/`. The app
uses their namespaced URLs, while `next.config.mjs` keeps old root asset URLs as
compatibility rewrites for saved links and legacy iframe entry points.
