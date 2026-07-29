#!/usr/bin/env python3
"""Update TableTopGames Pathfinder 2 rules Russian names from pf2r Babele translations.
Compares by English name (nameEn or id) and updates the Russian name field.
Usage: python3 src/games/pathfinder2/scripts/update-rules-from-pf2r.py
"""

import json, os, re, sys
from collections import defaultdict

PF2R_PACKS_DIR = '/tmp/pf2r/data/community/pf2e/packs'
RULES_DIR = os.path.join(os.path.dirname(__file__), '..', 'Rules')

# ── helpers ──────────────────────────────────────────────
def slugify(text):
    return re.sub(r'[^a-z0-9]+', '-', str(text).lower()).strip('-')

def clean_name(name):
    """Remove (*) and [Legacy] markers from pf2r translation."""
    name = re.sub(r'\s*\(\*\)', '', name)
    name = re.sub(r'\s*\[Legacy\]', '', name)
    return name.strip()

def read_json(fp):
    with open(fp) as f:
        return json.load(f)

def write_json(fp, data):
    with open(fp, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ── load pf2r translations ───────────────────────────────
def load_pf2r_lookup(pack_files, key='entries'):
    """Build {english_name_lower: russian_name} from Babele packs."""
    lookup = {}
    for fn in pack_files:
        fp = os.path.join(PF2R_PACKS_DIR, fn)
        if not os.path.exists(fp):
            continue
        data = read_json(fp)
        entries = data.get(key, {})
        if not isinstance(entries, dict):
            continue
        for en_name, v in entries.items():
            if isinstance(v, dict) and 'name' in v:
                lookup[en_name.lower().strip()] = clean_name(v['name'])
            elif isinstance(v, str):
                lookup[en_name.lower().strip()] = clean_name(v)
    return lookup

def load_all_pf2r():
    """Load all pf2r packs and return categorized lookups."""
    all_files = os.listdir(PF2R_PACKS_DIR)

    # Equipment pack (covers weapons, armor, shields, items, runes, etc.)
    equipment_lookup = load_pf2r_lookup(['pf2e.equipment-srd.json'])

    # Spells pack
    spells_lookup = load_pf2r_lookup(['pf2e.spells-srd.json'])

    # Feats pack (covers feats, class features, ancestry features)
    feats_lookup = load_pf2r_lookup([
        'pf2e.feats-srd.json',
        'pf2e.classfeatures.json',
        'pf2e.ancestryfeatures.json',
    ])

    # Backgrounds
    backgrounds_lookup = load_pf2r_lookup(['pf2e.backgrounds.json'])

    # Ancestries
    ancestries_lookup = load_pf2r_lookup(['pf2e.ancestries.json'])

    # Classes
    classes_lookup = load_pf2r_lookup(['pf2e.classes.json'])

    # Deities
    deities_lookup = load_pf2r_lookup(['pf2e.deities.json'])

    # Heritages
    heritages_lookup = load_pf2r_lookup(['pf2e.heritages.json'])

    # Vehicles
    vehicles_lookup = load_pf2r_lookup(['pf2e.vehicles.json'])

    # All combined (as fallback)
    all_json_files = [f for f in all_files if f.endswith('.json') and f.startswith('pf2e.')]
    all_lookup = load_pf2r_lookup(all_json_files)

    return {
        'equipment': equipment_lookup,
        'spells': spells_lookup,
        'feats': feats_lookup,
        'backgrounds': backgrounds_lookup,
        'ancestries': ancestries_lookup,
        'classes': classes_lookup,
        'deities': deities_lookup,
        'heritages': heritages_lookup,
        'vehicles': vehicles_lookup,
        'all': all_lookup,
    }

# ── update logic ─────────────────────────────────────────
def update_entries_by_name_en(entries, lookup, stats, file_name):
    """Update entries that have nameEn field by matching against lookup."""
    updated = 0
    not_found = 0
    for entry in entries:
        name_en = entry.get('nameEn', '').strip()
        if not name_en:
            not_found += 1
            continue

        key = name_en.lower()
        if key in lookup:
            new_name = lookup[key]
            if new_name and new_name != entry.get('name', ''):
                entry['name'] = new_name
                updated += 1
        else:
            not_found += 1

    stats[file_name] = {'updated': updated, 'not_found': not_found, 'total': len(entries)}
    return entries

def update_entries_by_id_slug(entries, lookup, stats, file_name):
    """Update entries that only have id (English slug) by matching slug against lookup keys."""
    updated = 0
    not_found = 0
    # Build slug→ru_name from lookup (slugify English names)
    slug_lookup = {}
    for en_name, ru_name in lookup.items():
        slug_lookup[slugify(en_name)] = ru_name

    for entry in entries:
        eid = entry.get('id', '').strip()
        if not eid:
            not_found += 1
            continue

        key = eid.lower()
        # Try direct match first
        if key in lookup:
            new_name = lookup[key]
            if new_name and new_name != entry.get('name', ''):
                entry['name'] = new_name
                updated += 1
                continue

        # Try slug match
        slug_key = slugify(key)
        if slug_key in slug_lookup:
            new_name = slug_lookup[slug_key]
            if new_name and new_name != entry.get('name', ''):
                entry['name'] = new_name
                updated += 1
                continue

        not_found += 1

    stats[file_name] = {'updated': updated, 'not_found': not_found, 'total': len(entries)}
    return entries

# ── file-specific updaters ────────────────────────────────
def update_equipment_file(file_name, lookup, stats):
    """Update equipment-type files (weapons, armor, items, etc.)."""
    fp = os.path.join(RULES_DIR, file_name)
    if not os.path.exists(fp):
        print(f'  ⚠️  {file_name}: not found')
        return
    data = read_json(fp)

    # Find the main array
    for key in data:
        if isinstance(data[key], list) and len(data[key]) > 0:
            if 'nameEn' in data[key][0]:
                data[key] = update_entries_by_name_en(data[key], lookup, stats, file_name)
                break

    write_json(fp, data)

def update_spells(lu, stats):
    """Update spells.json (has cantrips + spells arrays)."""
    fp = os.path.join(RULES_DIR, 'spells.json')
    data = read_json(fp)
    lookup = lu['spells']
    all_lookup = lu['all']

    for arr_key in ['cantrips', 'spells']:
        if arr_key in data:
            data[arr_key] = update_entries_by_name_en(data[arr_key], lookup, stats, f'spells.json/{arr_key}')

    write_json(fp, data)

def update_feats(lu, stats):
    """Update feats.json (dict of lists by category)."""
    fp = os.path.join(RULES_DIR, 'feats.json')
    data = read_json(fp)
    lookup = lu['feats']
    all_lookup = lu['all']
    total_updated = 0
    total_not_found = 0
    total_all = 0

    feats_dict = data.get('feats', {})
    if isinstance(feats_dict, dict):
        for cat, feat_list in feats_dict.items():
            if isinstance(feat_list, list):
                # feats have nameEn
                u, nf = 0, 0
                for entry in feat_list:
                    name_en = entry.get('nameEn', '').strip()
                    if not name_en:
                        # Try to find by id/name
                        eid = entry.get('id', '').strip()
                        # Try feats lookup first, then all
                        for lk in [lookup, all_lookup]:
                            key = name_en.lower() if name_en else eid.lower()
                            if key in lk:
                                new_name = lk[key]
                                if new_name and new_name != entry.get('name', ''):
                                    entry['name'] = new_name
                                    u += 1
                                    break
                        else:
                            nf += 1
                        continue

                    key = name_en.lower()
                    found = False
                    for lk in [lookup, all_lookup]:
                        if key in lk:
                            new_name = lk[key]
                            if new_name and new_name != entry.get('name', ''):
                                entry['name'] = new_name
                                u += 1
                                found = True
                                break
                    if not found:
                        nf += 1

                total_updated += u
                total_not_found += nf
                total_all += len(feat_list)

    stats['feats.json'] = {'updated': total_updated, 'not_found': total_not_found, 'total': total_all}
    write_json(fp, data)

def update_ancestries(lu, stats):
    """Update ancestries.json (has id but no nameEn)."""
    fp = os.path.join(RULES_DIR, 'ancestries.json')
    data = read_json(fp)
    lookup = lu['ancestries']
    all_lookup = lu['all']

    for arr_key in ['ancestries', 'versatileHeritages']:
        if arr_key in data:
            # Try lookup, fall back to all, then heritages
            for lk in [lookup, lu['heritages'], all_lookup]:
                data[arr_key] = update_entries_by_id_slug(data[arr_key], lk, stats, f'ancestries.json/{arr_key}')

    write_json(fp, data)

def update_classes(lu, stats):
    """Update classes.json (has id but no nameEn)."""
    fp = os.path.join(RULES_DIR, 'classes.json')
    data = read_json(fp)

    if 'classes' in data:
        data['classes'] = update_entries_by_id_slug(data['classes'], lu['classes'], stats, 'classes.json')

    write_json(fp, data)

def update_deities(lu, stats):
    """Update deities.json (has id but no nameEn)."""
    fp = os.path.join(RULES_DIR, 'deities.json')
    data = read_json(fp)

    if 'deities' in data:
        data['deities'] = update_entries_by_id_slug(data['deities'], lu['deities'], stats, 'deities.json')

    write_json(fp, data)

def update_backgrounds(lu, stats):
    """Update backgrounds.json."""
    fp = os.path.join(RULES_DIR, 'backgrounds.json')
    data = read_json(fp)

    if 'backgrounds' in data:
        data['backgrounds'] = update_entries_by_name_en(data['backgrounds'], lu['backgrounds'], stats, 'backgrounds.json')

    write_json(fp, data)

def update_rituals(lu, stats):
    """Update rituals.json."""
    fp = os.path.join(RULES_DIR, 'rituals.json')
    data = read_json(fp)

    if 'rituals' in data:
        data['rituals'] = update_entries_by_name_en(data['rituals'], lu['spells'], stats, 'rituals.json')

    write_json(fp, data)

def update_vehicles_file(lu, stats):
    """Update vehicles.json (no nameEn, has name with embedded stats)."""
    fp = os.path.join(RULES_DIR, 'vehicles.json')
    data = read_json(fp)
    lookup = lu['vehicles']
    all_lookup = lu['all']

    if 'items' in data:
        updated = 0
        not_found = 0
        for entry in data['items']:
            name = entry.get('name', '')
            # Vehicle names often have the format "Name, stats..."
            # Extract just the name part (before the first stat)
            # Try matching the entry name against lookup keys
            name_clean = name.split(',')[0].strip().lower()
            found = False
            for lk in [lookup, all_lookup]:
                for en_key, ru_name in lk.items():
                    # Try matching: if the Russian name from pf2r matches the start of our entry name
                    if ru_name.lower() == name_clean or en_key.lower() == name_clean:
                        # Update only the name part, keep the stats
                        rest = name[len(name.split(',')[0]):] if ',' in name else ''
                        entry['name'] = ru_name + rest
                        updated += 1
                        found = True
                        break
                if found:
                    break
            if not found:
                not_found += 1

        stats['vehicles.json'] = {'updated': updated, 'not_found': not_found, 'total': len(data['items'])}

    write_json(fp, data)

# ── main ─────────────────────────────────────────────────
def main():
    print('=== PF2 Rules Update from pf2r ===\n')

    # Load all pf2r data
    print('Loading pf2r translations...')
    lu = load_all_pf2r()
    for k, v in lu.items():
        print(f'  {k}: {len(v)} entries')

    stats = {}

    # ── Equipment-type files (use equipment lookup, fall back to all) ──
    equipment_files = [
        'weapons.json', 'armor.json', 'shields.json', 'consumables.json',
        'adventuring-gear.json', 'held-items.json', 'worn-items.json',
        'alchemical-items.json', 'runes.json', 'staves.json', 'wands.json',
        'snares.json', 'tattoos.json', 'grafts.json', 'contracts.json',
        'customizations.json', 'structures.json', 'spellhearts.json',
        'artifacts.json', 'assistive-items.json', 'materials.json',
        'siege-weapons.json',
    ]

    for fn in equipment_files:
        print(f'  {fn}...', end=' ', flush=True)
        update_equipment_file(fn, lu['equipment'], stats)
        print(f'✅' if fn in stats else '⚠️')

    # ── Special files ──
    print('  spells.json...', end=' ', flush=True)
    update_spells(lu, stats)
    print('✅')

    print('  feats.json...', end=' ', flush=True)
    update_feats(lu, stats)
    print('✅')

    print('  backgrounds.json...', end=' ', flush=True)
    update_backgrounds(lu, stats)
    print('✅')

    print('  rituals.json...', end=' ', flush=True)
    update_rituals(lu, stats)
    print('✅')

    print('  ancestries.json...', end=' ', flush=True)
    update_ancestries(lu, stats)
    print('✅')

    print('  classes.json...', end=' ', flush=True)
    update_classes(lu, stats)
    print('✅')

    print('  deities.json...', end=' ', flush=True)
    update_deities(lu, stats)
    print('✅')

    print('  vehicles.json...', end=' ', flush=True)
    update_vehicles_file(lu, stats)
    print('✅')

    # ── Report ──
    print('\n=== Update Report ===\n')
    total_updated = 0
    total_entries = 0
    total_not_found = 0

    for fn in sorted(stats.keys()):
        s = stats[fn]
        total_updated += s['updated']
        total_entries += s['total']
        total_not_found += s['not_found']
        pct = (s['updated'] / s['total'] * 100) if s['total'] > 0 else 0
        bar = '🟢' if pct > 70 else ('🟡' if pct > 30 else '🔴')
        print(f'  {bar} {fn}: {s["updated"]}/{s["total"]} updated ({pct:.0f}%), {s["not_found"]} not found')

    print(f'\nTotal: {total_updated}/{total_entries} updated ({total_updated/total_entries*100:.0f}% of {total_entries})' if total_entries > 0 else '\nNo entries processed')
    print(f'Not found in pf2r: {total_not_found}')
    print('\nDone.')

if __name__ == '__main__':
    main()
