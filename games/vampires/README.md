# Vampire: The Masquerade V5

VTM game-domain boundary for TableTopGames.

The production VTM implementation remains in the existing `modules/`,
`core/systems/vtm5/` and `public/` locations because the legacy iframe, public
asset URLs and shared table imports are load-bearing. Route-level facades in
`routes/` make the game ownership explicit without a risky bulk migration.

Future VTM work can move behind this boundary one subsystem at a time while the
public route contracts remain stable.
