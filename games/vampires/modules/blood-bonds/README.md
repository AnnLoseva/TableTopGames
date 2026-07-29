# Blood Bonds

Master-only blood bond manager: graph + keyboard-accessible list + detail panel.

## Mechanics

Level limits, drink progression, warnings and resist difficulties come from
`games/vampires/core/vtm5/rules/blood-bonds` via `createVtm5BloodBondAdapter()`.
Direction is always **thrall → regnant** (who drank → whose blood).

## Data

- `blood_bonds` — current bond state (no DELETE; break = status)
- `blood_bond_events` — append-only history
- Action log entries for create/drink/level/break

Self-bond forbidden; active thrall/regnant pair is unique (normalized on create).
