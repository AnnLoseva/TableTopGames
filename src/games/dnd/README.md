# D&D

Isolated D&D game domain for TableTopGames.

## Journal (`journal/`)

- Route: `/dnd/journal`
- Entry: `journal/DndJournalRoute.tsx`
- Persistence: Supabase (`dnd_journal_pages`, `dnd_journal_images` +
  `dnd-journal-images` storage bucket), **applied** to the live project.
  Schema/RLS: `journal/supabase/dnd_journal.sql` (see `docs/ai/DECISIONS.md`,
  2026-07-31 entry).
- **Access model is single-editor, public read.** Anyone can read the
  journal — no login required, RLS `select` policy is `to public`. Only one
  hardcoded Supabase Auth user id (`DND_JOURNAL_OWNER_AUTH_USER_ID` in
  `journal/constants.ts`, the "Anna" account) can write, enforced by RLS on
  both tables and the storage bucket. `DndJournalRoute` computes `isEditor`
  (`false` for guests) and every component hides write UI when it's `false`
  — that hiding is a convenience, not the security boundary. The images
  bucket is public (`getPublicUrl`, like `character-portraits`) with no
  SELECT policy on `storage.objects` — a public bucket doesn't need one for
  reads, and one would only add unwanted file-listing capability (Supabase's
  advisor flagged this; see DECISIONS).
- Uses the site's account system (`@/platform/account/*`, same Supabase Auth
  as VTM and Pathfinder) only to identify the owner for edit permission —
  reading the journal needs no account at all.
- This is the **same journal data model** as the RenaCompanion iPad app
  (`DnD Interactive Sheet` repo, `Models/GameState/JournalPage.swift` /
  `JournalImage.swift`); both surfaces are meant to read/write the same rows
  so a page edited on one appears on the other. That app is currently fully
  offline and has no Supabase client yet — see the DECISIONS entry for the
  conflict with that repo's "never add a network call" rule. Keep
  `journal/types.ts`, `journal/constants.ts` and the SQL contract in sync with
  the Swift models if either side's shape changes; as of this writing the
  contract mirrors only the core fields (title/body/type incl. `bestiary`/
  aliases/favorite/pinned/archived) — the Swift model has since grown
  `folderId`, `sortOrder`, `entryType` and a `structuredFields` JSON blob that
  are **not** mirrored yet.
