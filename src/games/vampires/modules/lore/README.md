# Lore & Random Tables

Chronicle compendium for `/vampires/master`. **System VTM rules** come from
`src/games/vampires/modules/reference` (markdown + `public/vampires/rules.json` path) and are never copied
into Supabase. **Chronicle lore** lives in `chronicle_lore_*` tables.

## Separation

| Source | Storage | Private notes |
|---|---|---|
| System reference | files / reference catalog | n/a |
| Chronicle entries | `chronicle_lore_entries` | `chronicle_lore_entry_private` |
| Random tables | `chronicle_random_tables` | n/a |
| Links | `chronicle_entity_links` | visibility field |

## Search safety

`searchLoreCompendium({ includeMasterOnly: false })` drops master-only rows and
never indexes `privateNote`. Master UI uses `includeMasterOnly: true`.
