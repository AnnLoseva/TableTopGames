#!/usr/bin/env python3
"""Merge prices and mechanical data from Foundry PF2e compendiums into
TableTopGames rules files (which were generated from pf2r Babele translations).
Matches entries by English name to copy prices, levels, and other mechanics.
Usage: python3 src/games/pathfinder2/scripts/merge-foundry-prices.py
"""

import json, os, re, sys
from collections import defaultdict

FOUNDRY_PACKS = '/tmp/pf2e/packs/pf2e'
RULES_DIR = os.path.join(os.path.dirname(__file__), '..', 'Rules')

# ── helpers ──────────────────────────────────────────────
def convert_price(foundry_price):
    """Convert Foundry price format to TableTopGames format.
    Foundry: {'value': {'gp': 10, 'sp': 5}, 'per': 1}
    TableTopGames: {'cp': 0, 'sp': 5, 'gp': 10, 'pp': 0}
    """
    result = {'cp': 0, 'sp': 0, 'gp': 0, 'pp': 0}
    if not foundry_price or not isinstance(foundry_price, dict):
        return result
    value = foundry_price.get('value', {})
    if isinstance(value, dict):
        result['cp'] = value.get('cp', 0) or 0
        result['sp'] = value.get('sp', 0) or 0
        result['gp'] = value.get('gp', 0) or 0
        result['pp'] = value.get('pp', 0) or 0
    return result

def strip_html(text):
    text = re.sub(r'@UUID\[[^\]]+\]\{([^}]+)\}', r'\1', text)
    text = re.sub(r'@UUID\[[^\]]+\]', '', text)
    text = re.sub(r'@Damage\[([^\]]+)\]', r'\1', text)
    text = re.sub(r'@Check\[[^\]]+\]\{([^}]+)\}', r'\1', text)
    text = re.sub(r'@Check\[[^\]]+\]', '', text)
    text = re.sub(r'@Template\[[^\]]+\]\{[^}]*\}', '', text)
    text = re.sub(r'@Trait\[[^\]]+\]\{([^}]+)\}', r'\1', text)
    text = re.sub(r'@Glyph\[[^\]]+\]', '', text)
    text = re.sub(r'@Actor\[[^\]]+\]\{([^}]+)\}', r'\1', text)
    text = re.sub(r'@Condition\[([^\]]+)\]', r'\1', text)
    text = re.sub(r'@Localize\[[^\]]+\]', '', text)
    text = re.sub(r'@Compendium\[[^\]]+\]\{([^}]+)\}', r'\1', text)
    text = re.sub(r'@Compendium\[[^\]]+\]', '', text)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def read_json(fp):
    with open(fp) as f:
        return json.load(f)

def write_json(fp, data):
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    with open(fp, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ── Foundry data loaders ─────────────────────────────────
def load_foundry_pack(pack_name):
    """Load all entries from a Foundry compendium pack directory (recursive).
    Returns dict: {english_name_lower: entry_data}
    """
    pack_dir = os.path.join(FOUNDRY_PACKS, pack_name)
    if not os.path.isdir(pack_dir):
        return {}

    result = {}

    # Recursively walk all subdirectories
    for root, dirs, files in os.walk(pack_dir):
        for fn in files:
            if fn.startswith('_') or not fn.endswith('.json'):
                continue
            fp = os.path.join(root, fn)
            try:
                with open(fp) as f:
                    entry = json.load(f)
            except:
                continue

            name = entry.get('name', '').strip()
            if not name:
                continue

            key = name.lower()
            # Extract data
            system = entry.get('system', {})
            price = convert_price(system.get('price'))
            level = system.get('level', {})
            if isinstance(level, dict):
                level = level.get('value', 0)
            item_type = entry.get('type', '')
            traits = system.get('traits', {})
            if isinstance(traits, dict):
                traits = list(traits.get('value', [])) or []
            elif isinstance(traits, list):
                traits = traits
            else:
                traits = []

            # Description (may be HTML)
            desc_data = system.get('description', {})
            if isinstance(desc_data, dict):
                desc = desc_data.get('value', '')
            else:
                desc = str(desc_data) if desc_data else ''

            # Publication/source
            publication = system.get('publication', {})
            if isinstance(publication, dict):
                source_book = publication.get('title', '')
            else:
                source_book = ''

            result[key] = {
                'name': name,
                'type': item_type,
                'price': price,
                'level': level,
                'traits': traits,
                'sourceBook': source_book,
                'description': desc,
                'system': system,
            }

    return result

# ── Merging logic ────────────────────────────────────────
def merge_prices_to_file(filename, foundry_lookup, array_keys=None):
    """Merge prices and levels from Foundry data into a TableTopGames rules file.
    Matches by English name (nameEn field).
    """
    fp = os.path.join(RULES_DIR, filename)
    if not os.path.exists(fp):
        return None

    data = read_json(fp)

    # Find all array keys
    if array_keys is None:
        array_keys = [k for k in data if isinstance(data[k], list)]

    stats = {'total': 0, 'updated_price': 0, 'updated_level': 0, 'not_found': 0}

    for arr_key in array_keys:
        if arr_key not in data or not isinstance(data[arr_key], list):
            continue

        for item in data[arr_key]:
            if not isinstance(item, dict):
                continue
            stats['total'] += 1

            name_en = item.get('nameEn', '').strip()
            if not name_en:
                stats['not_found'] += 1
                continue

            key = name_en.lower()

            # 1. Exact match
            foundry_entry = foundry_lookup.get(key)

            # 2. Fuzzy match: try without parenthetical
            if not foundry_entry:
                base_key = re.sub(r'\s*\([^)]*\)', '', key).strip()
                if base_key and base_key != key:
                    foundry_entry = foundry_lookup.get(base_key)

            # 3. Fuzzy: try substring matching (long keys only)
            if not foundry_entry:
                for lk, fv in foundry_lookup.items():
                    if len(lk) < 8:
                        continue
                    if lk in key or key in lk:
                        foundry_entry = fv
                        break

            if foundry_entry:
                # Update price if current is zero/free
                current_price = item.get('price', {})
                is_currently_free = not (
                    current_price.get('cp') or current_price.get('sp') or
                    current_price.get('gp') or current_price.get('pp')
                )

                if is_currently_free:
                    new_price = foundry_entry['price']
                    if new_price.get('cp') or new_price.get('sp') or new_price.get('gp') or new_price.get('pp'):
                        item['price'] = new_price
                        stats['updated_price'] += 1

                # Update level if current is missing/0/differs from Foundry
                current_level = item.get('level', 0) or 0
                foundry_level = foundry_entry.get('level', 0) or 0
                if foundry_level > 0 and current_level != foundry_level:
                    item['level'] = foundry_level
                    stats['updated_level'] += 1

                # Update source book if empty
                if not item.get('sourceBook') and foundry_entry.get('sourceBook'):
                    item['sourceBook'] = foundry_entry['sourceBook']
            else:
                stats['not_found'] += 1

    write_json(fp, data)
    return stats


def merge_to_feats(foundry_lookup):
    """Special handler for feats.json which has a dict-of-lists structure."""
    fp = os.path.join(RULES_DIR, 'feats.json')
    if not os.path.exists(fp):
        return None

    data = read_json(fp)
    feats_dict = data.get('feats', {})

    stats = {'total': 0, 'updated_price': 0, 'updated_level': 0, 'not_found': 0}

    for cat, feat_list in feats_dict.items():
        if not isinstance(feat_list, list):
            continue
        for item in feat_list:
            if not isinstance(item, dict):
                continue
            stats['total'] += 1

            name_en = item.get('nameEn', '').strip()
            if not name_en:
                stats['not_found'] += 1
                continue

            key = name_en.lower()
            foundry_entry = foundry_lookup.get(key)

            if not foundry_entry:
                base_key = re.sub(r'\s*\([^)]*\)', '', key).strip()
                if base_key and base_key != key:
                    foundry_entry = foundry_lookup.get(base_key)

            if not foundry_entry:
                for lk, fv in foundry_lookup.items():
                    if len(lk) < 8:
                        continue
                    if lk in key or key in lk:
                        foundry_entry = fv
                        break

            if foundry_entry:
                # Feats don't typically have prices, but update level
                current_level = item.get('level', 0) or 0
                foundry_level = foundry_entry.get('level', 0) or 0
                if foundry_level > 0 and current_level != foundry_level:
                    item['level'] = foundry_level
                    stats['updated_level'] += 1

                if not item.get('sourceBook') and foundry_entry.get('sourceBook'):
                    item['sourceBook'] = foundry_entry['sourceBook']
            else:
                stats['not_found'] += 1

    write_json(fp, data)
    return stats


# ── main ─────────────────────────────────────────────────
def main():
    print('=== Merge Foundry PF2e Prices → TableTopGames Rules ===\n')

    # Load all needed Foundry packs
    print('Loading Foundry compendiums...')

    equipment = load_foundry_pack('equipment')
    print(f'  equipment: {len(equipment)} entries')

    spells = load_foundry_pack('spells')
    print(f'  spells: {len(spells)} entries')

    feats_pack = load_foundry_pack('feats')
    class_features = load_foundry_pack('class-features')
    ancestry_features = load_foundry_pack('ancestry-features')
    all_feats = {**feats_pack, **class_features, **ancestry_features}
    print(f'  feats: {len(feats_pack)}, class-features: {len(class_features)}, ancestry-features: {len(ancestry_features)}')

    backgrounds = load_foundry_pack('backgrounds')
    print(f'  backgrounds: {len(backgrounds)} entries')

    ancestries = load_foundry_pack('ancestries')
    heritages = load_foundry_pack('heritages')
    print(f'  ancestries: {len(ancestries)}, heritages: {len(heritages)}')

    classes = load_foundry_pack('classes')
    print(f'  classes: {len(classes)} entries')

    deities = load_foundry_pack('deities')
    print(f'  deities: {len(deities)} entries')

    vehicles = load_foundry_pack('vehicles')
    print(f'  vehicles: {len(vehicles)} entries')

    rituals = load_foundry_pack('rituals')
    print(f'  rituals: {len(rituals)} entries')

    # Combine all for spell lookup (spells + rituals)
    all_spells = {**spells, **rituals}

    # ── Merge prices ──
    print('\n--- Merging equipment files ---')
    equipment_files = [
        'weapons.json', 'armor.json', 'shields.json', 'consumables.json',
        'adventuring-gear.json', 'held-items.json', 'worn-items.json',
        'alchemical-items.json', 'runes.json', 'staves.json', 'wands.json',
        'snares.json', 'tattoos.json', 'grafts.json', 'artifacts.json',
        'assistive-items.json', 'materials.json', 'spellhearts.json',
        'contracts.json', 'customizations.json', 'structures.json', 'siege-weapons.json',
    ]

    total_update = {'price': 0, 'level': 0, 'total': 0, 'not_found': 0}
    for fn in equipment_files:
        fp = os.path.join(RULES_DIR, fn)
        if not os.path.exists(fp):
            continue
        stats = merge_prices_to_file(fn, equipment)
        if stats:
            total_update['price'] += stats['updated_price']
            total_update['level'] += stats['updated_level']
            total_update['total'] += stats['total']
            total_update['not_found'] += stats['not_found']
            pct = (stats['updated_price'] / stats['total'] * 100) if stats['total'] > 0 else 0
            bar = '🟢' if pct > 50 else ('🟡' if pct > 20 else '🔴')
            print(f'  {bar} {fn}: +{stats["updated_price"]} prices, +{stats["updated_level"]} levels '
                  f'({stats["not_found"]}/{stats["total"]} not in Foundry)')

    # Spells
    print('\n--- Merging spells ---')
    stats = merge_prices_to_file('spells.json', all_spells, ['cantrips', 'spells'])
    if stats:
        print(f'  spells.json: +{stats["updated_price"]} prices, +{stats["updated_level"]} levels')

    stats = merge_prices_to_file('rituals.json', all_spells, ['rituals'])
    if stats:
        print(f'  rituals.json: +{stats["updated_price"]} prices, +{stats["updated_level"]} levels')

    # Feats
    print('\n--- Merging feats ---')
    stats = merge_to_feats(all_feats)
    if stats:
        print(f'  feats.json: +{stats["updated_price"]} prices, +{stats["updated_level"]} levels')

    # Backgrounds
    print('\n--- Merging backgrounds ---')
    stats = merge_prices_to_file('backgrounds.json', backgrounds, ['backgrounds'])
    if stats:
        print(f'  backgrounds.json: +{stats["updated_price"]} prices, +{stats["updated_level"]} levels')

    # Ancestries
    print('\n--- Merging ancestries ---')
    stats = merge_prices_to_file('ancestries.json', {**ancestries, **heritages},
                                  ['ancestries', 'versatileHeritages'])
    if stats:
        print(f'  ancestries.json: +{stats["updated_price"]} prices, +{stats["updated_level"]} levels')

    # Classes
    print('\n--- Merging classes ---')
    stats = merge_prices_to_file('classes.json', classes, ['classes'])
    if stats:
        print(f'  classes.json: +{stats["updated_price"]} prices, +{stats["updated_level"]} levels')

    # Deities
    print('\n--- Merging deities ---')
    stats = merge_prices_to_file('deities.json', deities, ['deities'])
    if stats:
        print(f'  deities.json: +{stats["updated_price"]} prices, +{stats["updated_level"]} levels')

    # Vehicles
    print('\n--- Merging vehicles ---')
    stats = merge_prices_to_file('vehicles.json', vehicles, ['items'])
    if stats:
        print(f'  vehicles.json: +{stats["updated_price"]} prices, +{stats["updated_level"]} levels')

    print(f'\n=== Done ===')
    print(f'Total prices updated: {total_update["price"]}')
    print(f'Total levels updated: {total_update["level"]}')
    print(f'Entries not found in Foundry: {total_update["not_found"]}')

if __name__ == '__main__':
    main()
