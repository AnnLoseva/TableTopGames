# Risks

Known risk register. Check the relevant rows before critical edits. Add a row
when a new systemic risk appears (per `UPDATE-RULES.md`).

| Risk | Area | Why it matters | Mitigation |
|---|---|---|---|
| Legacy JS monolith (`public/vampires/main.js`, ~11k lines) | Legacy sheet | One file drives creation, save/load, mechanics, i18n; easy to break globals | `workflows/legacy-edit-protocol.md`; search all usages before editing globals; no broad refactor without a task |
| HTML/CSS/JS in `old-sheet.html` (~5k lines) | Legacy sheet | Markup + inline styles + hooks are tightly coupled to `main.js` | Small localized edits; verify iframe flow after changes |
| React table monolith (`GameTable.tsx`, ~9k lines) | Game table | Orchestrates room state, Supabase I/O, rolls, chat, scenes, layers, media | Extract to components/hooks/`lib/*`; `workflows/react-table-edit-protocol.md` |
| Duplicated health/humanity logic | VTM mechanics | `games/vampires/core/vtm5/rules/health/index.ts`↔`public/vampires/vtm-health.js`, `games/vampires/core/vtm5/rules/humanity/index.ts`↔`public/vampires/vtm-humanity.js` can silently diverge | When editing one, check the other; note divergence in `DECISIONS.md` |
| RU/EN trait & discipline names | Rules data / i18n | Comparing display names instead of stable IDs causes mismatches across RU/EN | Match by stable IDs (`games/vampires/lib/i18n/ruleNames.ts`); keep both JSON files in sync |
| Supabase schema drift | Persistence | Renaming tables/buckets or changing saved-data shape breaks save/load & room sync for both layers | `workflows/supabase-edit-protocol.md`; update `constants.ts`, mappers, `games/vampires/supabase/*.sql`; log in `DECISIONS.md` |
| Long external-AI transcript processing | Chronicle library | A full session needs many network/LLM calls; browser closure or provider failure can interrupt it, and personal text must not leak across users | Persist raw/output per chunk, resume idempotently, show real progress; caller JWT + owner RLS only; no service-role or general SQL tool |
| room / role / characterId flow | Bridge / table | Params carry identity between sheet and table; mishandling loses character or role | Preserve param + localStorage + postMessage contract (`subsystems/character-sheet-bridge.md`) |
| Music autoplay & browser limits | Music/media | Browsers block autoplay; YouTube embeds have their own constraints; sync is realtime | Gate playback on user gesture; handle adapter errors; `subsystems/music-and-media.md` |
| Large rules JSON | Rules data | `rules.json` ~34k lines; hard to hand-edit safely; easy to desync EN | Edit narrowly; run `audit:disciplines`; keep RU/EN structurally parallel |
| Changing VTM mechanics without tests | VTM mechanics | Rules regressions are subtle and player-facing | Run `validate:disciplines` / `test:disciplines`; keep `games/vampires/core/vtm5/rules/*` pure and covered |
| Media/layer/scene model coupling | Table | Scenes, layers and media reference each other and Supabase rows | Use `games/vampires/modules/table/utils/{scene,layer,media}-utils.ts`; verify scene/layer visibility after edits |
| Two Supabase clients | Persistence | `games/vampires/lib/supabase.ts` (React) and `public/vampires/supabase.js` (legacy) can diverge in behavior/keys | Keep env/config consistent; document any divergence |
| Legacy identity vs master Auth membership | Master persistence | The current public.users/localStorage login has no `auth.uid()`; pretending it is a master would expose secrets or make RLS unusable | Keep master hooks disconnected until Supabase Auth migration; provision first membership with service role; never add anon policies |
