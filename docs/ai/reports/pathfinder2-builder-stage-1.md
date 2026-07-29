# Pathfinder 2 Builder — Stage 1 Data Audit

Date: 2026-07-29

## Implemented in this stage

- Canonical localStorage schema v4 with a retained read path from schema v3 and
  v1.
- Source-separated draft contracts for identity, progression, ancestry,
  background, class, attributes, skills, feats, spellcasting, inventory,
  details, vitals and migration review.
- Stable `CharacterSource`, generic decision-slot and feat-slot contracts.
- A generic schema-v1 document adapter for future owner-provided catalogs.
- Machine-readable connected/partial/present-unconnected/missing catalog
  statuses.
- Builder/data tests covering v4 defaults, v3 migration, round trips, slot IDs,
  catalog counts, missing states and document validation.

## Connected data

| Catalog | Entries | State |
|---|---:|---|
| Ancestries + versatile heritages | 67 | Connected |
| Backgrounds | 81 | Connected |
| Classes | 27 | Partial: display and some starting skill rules |
| General + skill + mythic feats | 115 | Partial: prerequisites are text |

## Present but not connected

| Catalog | Entries | Blocker |
|---|---:|---|
| Archetypes | 43 | No slot/prerequisite adapter |
| Spells + cantrips/focus entries | 1167 | No spellcasting progression/selection engine |

`rituals.json`, `alchemical-items.json` and local scraping scripts found in the
working tree were pre-existing/concurrent uncommitted user files. This stage did
not change or connect them, and they are not counted as ready application data.

## Owner data still required

- ancestry feats;
- class feats;
- complete class progression from level 1 through 20;
- equipment, weapons, armor and shields;
- deities;
- languages;
- a structured trait/effect dictionary.

Each supplied document needs stable IDs, version/source/license metadata and
structured prerequisites/effects. No runtime text parsing or web scraping is an
accepted substitute.

## Deliberately not implemented yet

- replacement of the ten-step UI with the final eleven-step flow;
- voluntary flaws and ancestry feat selection UI;
- structured class specializations/proficiencies;
- generated feat slots from real progression data;
- shop, currency operations, equipment and combat calculations;
- spellcasting choices;
- final-details workflow;
- level-up UI and progression to level 20;
- browser E2E, accessibility and iPad verification.
