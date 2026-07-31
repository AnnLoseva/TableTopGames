# D&D

Isolated D&D game domain for TableTopGames.

## Journal (`journal/`)

- Route: `/dnd/journal`
- Entry: `journal/DndJournalRoute.tsx`
- Persistence: Supabase (`dnd_journal_pages`, `dnd_journal_images` +
  `dnd-journal-images` storage bucket), **applied** to the live project.
  Schema/RLS: `journal/supabase/dnd_journal.sql` (see `docs/ai/DECISIONS.md`,
  2026-07-31 entry).
- **Access model is single-editor (from this site's perspective), public
  read.** Anyone can read the journal — no login required, RLS `select`
  policy is `to public`. On the site, only one hardcoded Supabase Auth user
  id (`DND_JOURNAL_OWNER_AUTH_USER_ID` in `journal/constants.ts`, the "Anna"
  account) can write; `DndJournalRoute` computes `isEditor` (`false` for
  guests) and every component hides write UI when it's `false` — that
  hiding is a convenience, not the security boundary. RLS itself actually
  allows a *second* identity too: a "RenaCompanionDevice" service account
  the RenaCompanion iPad app's background sync signs in as (never the
  owner's real password) — see `docs/ai/DECISIONS.md` (2026-07-31,
  "RenaCompanion iPad app now syncs the journal"). That account has no
  reason to ever load this site, so it's deliberately not part of the
  site's `isEditor` check. The images bucket is public (`getPublicUrl`, like
  `character-portraits`) with no SELECT policy on `storage.objects` — a
  public bucket doesn't need one for reads, and one would only add unwanted
  file-listing capability (Supabase's advisor flagged this; see DECISIONS).
- Uses the site's account system (`@/platform/account/*`, same Supabase Auth
  as VTM and Pathfinder) only to identify the owner for edit permission —
  reading the journal needs no account at all.
- This is the **same journal data model** as the RenaCompanion iPad app
  (`DnD Interactive Sheet` repo, `Models/GameState/JournalPage.swift` /
  `JournalImage.swift`); both surfaces read/write the same rows so a page
  edited on one appears on the other — **this now actually happens**, not
  just in theory: the app's `Support/JournalSyncService.swift` pushes/pulls
  on launch/foreground and after every local save, verified live against
  this project. Keep `journal/types.ts`, `journal/constants.ts` and the SQL
  contract in sync with the Swift models if either side's shape changes; as
  of this writing the contract mirrors only the core fields (title/body/type
  incl. `bestiary`/aliases/favorite/pinned/archived) — the Swift model has
  since grown `folderId`, `sortOrder`, `entryType` and a `structuredFields`
  JSON blob that are **not** mirrored or synced.
- **Body text conflicts merge by paragraph, not last-write-wins.**
  `journal/merge.ts` is the canonical conflict policy for `bodyMarkdown`
  (identical paragraphs dedup, a fuller paragraph wins over a partial one, a
  paragraph found elsewhere isn't duplicated, near-identical paragraphs are
  both kept, and genuinely unique incoming paragraphs go to the end) —
  `updateJournalPage` in `journal/api/journal-api.ts` invokes it whenever the
  page changed underneath the caller's edit. The iPad app's
  `Support/JournalMergePolicy.swift` is a verified 1:1 port; if you change
  one, port the change to the other or conflicts silently lose text on
  whichever side is dumber. See `docs/ai/DECISIONS.md` (2026-07-31,
  "paragraph merge") for the exact rule order and a worked example.
