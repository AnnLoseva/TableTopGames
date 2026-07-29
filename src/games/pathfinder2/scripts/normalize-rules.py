#!/usr/bin/env python3
"""PF2 Rules Normalizer — raw JSON → canonical catalogs with best-effort mechanical extraction.
Deterministic. No network. Idempotent.
Usage: python3 src/games/pathfinder2/scripts/normalize-rules.py
"""

import json, os, re, sys
from collections import OrderedDict

RULES_DIR = os.path.join(os.path.dirname(__file__), '..', 'Rules')
CATALOGS_DIR = os.path.join(RULES_DIR, 'catalogs')
REPORT_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'docs', 'pathfinder2-rules-normalization-report.md')
PF2R_SOURCE = 'https://gitlab.com/gnuraco/pf2r'

issues = []

def add_issue(file, index=None, name=None, conflict_id=None, missing_fields=None, reason='', owner_action=''):
    issues.append(dict(file=file, index=index, name=name, conflictId=conflict_id,
                       missingFields=missing_fields or [], reason=reason, ownerAction=owner_action))

def slugify(text):
    return re.sub(r'[^a-zа-яё0-9]+', '-', str(text).lower()).strip('-')

def read_json(fp):
    with open(fp) as f: return json.load(f)

def write_json(fp, data):
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    with open(fp, 'w') as f: json.dump(data, f, ensure_ascii=False, indent=2)

def make_catalog(id_, title, source, version, entries, license=None):
    return OrderedDict([
        ('schemaVersion', 1), ('id', id_), ('title', title),
        ('version', version), ('source', source), ('license', license),
        ('entries', entries)
    ])

def parse_price(desc):
    m = re.search(r'Цена\s+([\d.,]+)\s*(зм|см|мм|пп|gp|sp|cp|pp)?', desc)
    if not m: return None
    amt = int(m.group(1).replace(',', '').replace('.', ''))
    unit = (m.group(2) or 'зм').lower()
    p = {'cp': 0, 'sp': 0, 'gp': 0, 'pp': 0}
    if unit in ('пп', 'pp'): p['pp'] = amt
    elif unit in ('зм', 'gp'): p['gp'] = amt
    elif unit in ('см', 'sp'): p['sp'] = amt
    elif unit in ('мм', 'cp'): p['cp'] = amt
    return p

def parse_bulk(desc):
    m = re.search(r'(?:Вес|Масса|Bulk)\s+([\dЛL.,\-–—]+)', desc, re.IGNORECASE)
    if not m: return None
    b = m.group(1).strip().upper()
    if b in ('L', 'Л', '—', '-', '–'): return 'light'
    try: return int(b)
    except: return None

def rarity_from_desc(desc):
    if 'Уникальный' in desc: return 'unique'
    if 'Редкий' in desc: return 'rare'
    if 'Необычный' in desc: return 'uncommon'
    return 'common'

def parse_armor_stats(desc):
    ac = re.search(r'Бонус КБ\s+\+?(\d+)', desc)
    dex = re.search(r'Макс\.?\s*Ловк\s+\+?(\d+)', desc)
    check = re.search(r'Штраф проверки\s*[-–]?\s*(\d+)', desc)
    speed = re.search(r'Штраф скорости\s*[-–]?\s*(\d+)', desc)
    strength = re.search(r'(?:Требование Силы|Сила)\s+(\d+)', desc)
    return {
        'armorBonus': int(ac.group(1)) if ac else 0,
        'dexterityCap': int(dex.group(1)) if dex else 0,
        'checkPenalty': -int(check.group(1)) if check else 0,
        'speedPenalty': int(speed.group(1)) if speed else 0,
        'strengthRequirement': int(strength.group(1)) if strength else 0,
    }

def parse_shield_stats(desc):
    h = re.search(r'тв[ёе]рдость\s+(\d+)', desc, re.IGNORECASE)
    hp = re.search(r'ПЗ\s+(\d+)', desc)
    bt = re.search(r'ПП\s+(\d+)', desc)
    return {
        'hardness': int(h.group(1)) if h else 0,
        'hitPoints': int(hp.group(1)) if hp else 0,
        'brokenThreshold': int(bt.group(1)) if bt else 0,
    }

def parse_name_en_traits(name_en):
    """Extract traits appended to English name without separator."""
    if not name_en: return '', []
    ru_start = re.search(r'[А-ЯЁ]', name_en)
    if not ru_start: return name_en, []
    base = name_en[:ru_start.start()].strip()
    trait_text = name_en[ru_start.start():]
    traits = re.split(r'(?=[А-ЯЁ])', trait_text)
    return base, [t for t in traits if t.strip()]

GROUP_HINTS = {
    'меч': 'sword', 'клин': 'sword', 'нож': 'knife', 'кинжал': 'knife', 'сабл': 'sword',
    'топор': 'axe', 'секир': 'axe',
    'молот': 'hammer', 'булав': 'club', 'дубин': 'club', 'палиц': 'club',
    'копь': 'spear', 'пик': 'spear', 'дротик': 'dart',
    'лук': 'bow', 'арбалет': 'crossbow', 'пращ': 'sling',
    'цеп': 'flail', 'кистен': 'flail', 'кнут': 'flail', 'плет': 'flail',
    'клевец': 'pick', 'чекан': 'pick',
    'кулак': 'brawling', 'кастет': 'brawling', 'перчат': 'brawling', 'когот': 'brawling',
    'древк': 'polearm', 'алебард': 'polearm', 'глеф': 'polearm',
    'ружь': 'firearm', 'пистол': 'firearm', 'мушкет': 'firearm',
    'бомб': 'bomb', 'щит': 'shield',
}

def dedup(entries, score_fn):
    best = {}
    for e in entries:
        eid = e.get('id', '')
        if not eid: continue
        score = score_fn(e)
        if eid not in best or score > best[eid][1]:
            if eid in best:
                add_issue('dedup', name=eid, conflict_id=eid, reason=f'Duplicate — kept most complete (score {score} vs {best[eid][1]})', owner_action='Merge entries')
            best[eid] = (e, score)
    return [v[0] for v in best.values()]

# ═══════════════ EQUIPMENT ═══════════════
def normalize_equipment():
    config = [
        ('adventuring-gear.json', 'items', 'adventuring-gear'),
        ('held-items.json', 'items', 'tool'),
        ('worn-items.json', 'wornItems', 'clothing'),
        ('consumables.json', 'consumables', 'consumable'),
        ('alchemical-items.json', 'items', 'alchemical'),
        ('tattoos.json', 'items', 'other'),
        ('grafts.json', 'items', 'other'),
        ('assistive-items.json', 'items', 'other'),
        ('materials.json', 'materials', 'other'),
        ('snares.json', 'snares', 'other'),
        ('contracts.json', 'contracts', 'other'),
        ('customizations.json', 'customizations', 'other'),
        ('structures.json', 'structures', 'other'),
    ]
    all_items = []
    for file, key, cat in config:
        fp = os.path.join(RULES_DIR, file)
        if not os.path.exists(fp): continue
        data = read_json(fp)
        for item in data.get(key, []):
            if not isinstance(item, dict): continue
            eid = item.get('id') or slugify(item.get('name', ''))
            name = item.get('name', '')
            if not eid or not name: continue
            desc = item.get('description', '')
            level = item.get('level', 0) or 0
            price = parse_price(desc)
            bulk = parse_bulk(desc)
            all_items.append(dict(
                id=eid, name=name, level=level, rarity=rarity_from_desc(desc),
                price=price or {'cp':0,'sp':0,'gp':0,'pp':0}, bulk=bulk if bulk is not None else 0,
                traits=list(item.get('traits', item.get('trait', []))),
                category=cat, sourceBook=item.get('sourceBook', ''),
                description=desc or None
            ))

    def score(e):
        s = 0
        if e.get('description') and len(e['description']) > 50: s += 10
        if e['price']['gp'] > 0: s += 5
        if e.get('bulk') and e['bulk'] != 0: s += 5
        return s

    return make_catalog('equipment', 'Pathfinder 2 Equipment', PF2R_SOURCE, '2026-07', dedup(all_items, score))

# ═══════════════ WEAPONS ═══════════════
def normalize_weapons():
    data = read_json(os.path.join(RULES_DIR, 'weapons.json'))
    entries = []
    for w in data.get('weapons', []):
        if not isinstance(w, dict): continue
        eid = w.get('id') or slugify(w.get('name', ''))
        name = w.get('name', '')
        if not eid or not name: continue
        desc = w.get('description', '')
        name_en = w.get('nameEn', '')
        level = w.get('level', 0) or 0
        en_name, extra_traits = parse_name_en_traits(name_en)

        # Proficiency category
        prof_cat = 'simple'
        if 'Продвинутое' in name_en or 'Экзотическое' in name_en: prof_cat = 'advanced'
        elif 'Воинское' in name_en: prof_cat = 'martial'
        elif 'Безоружное' in name_en or 'кулак' in name.lower(): prof_cat = 'unarmed'

        # Group
        group = ''
        for hint, grp in GROUP_HINTS.items():
            if hint in name.lower() or hint in en_name.lower():
                group = grp; break

        # Damage
        dmg = re.search(r'(\d+)d(\d+)\s*([БКРДПЭМС])', desc)
        dc, ds, dt = (int(dmg.group(1)), int(dmg.group(2)), dmg.group(3)) if dmg else (1, 4, 'B')

        # Hands
        hands = 2 if ('2 руки' in desc or 'двуруч' in desc) else 1

        # Range
        rng = re.search(r'(?:дистанция|шаг дистанции|дальность)\s+(\d+)', desc, re.IGNORECASE)
        range_val = int(rng.group(1)) if rng else None
        usage = 'ranged' if range_val else 'melee'
        if 'метательн' in name_en or 'метательн' in desc: usage = 'thrown'

        reload_val = 1 if 'перезарядка' in desc.lower() else None
        price = parse_price(desc)
        bulk = parse_bulk(desc)

        entries.append(dict(
            id=eid, name=name, level=level, rarity=rarity_from_desc(desc + ' ' + name_en),
            category='weapon', proficiencyCategory=prof_cat, group=group,
            damageDice={'count': dc, 'size': ds}, damageType=dt,
            range=range_val, reload=reload_val, hands=hands, usage=usage,
            price=price or {'cp':0,'sp':0,'gp':0,'pp':0}, bulk=bulk if bulk is not None else 0,
            traits=extra_traits + list(w.get('traits', [])),
            sourceBook=w.get('sourceBook', ''), description=desc or None,
            _needsOwnerMechanics=not desc or len(desc) < 50
        ))

    def score(e):
        s = 0
        if e.get('description') and len(e['description']) > 100: s += 10
        if e.get('group'): s += 5
        if e['damageDice']['count'] > 1: s += 3
        if e['price']['gp'] > 0: s += 5
        return s

    return make_catalog('weapons', 'Pathfinder 2 Weapons', PF2R_SOURCE, '2026-07', dedup(entries, score))

# ═══════════════ ARMOR ═══════════════
def normalize_armor():
    data = read_json(os.path.join(RULES_DIR, 'armor.json'))
    entries = []
    for a in data.get('armor', []):
        if not isinstance(a, dict): continue
        eid = a.get('id') or slugify(a.get('name', ''))
        name = a.get('name', '')
        if not eid or not name: continue
        desc = a.get('description', '')
        level = a.get('level', 0) or 0
        stats = parse_armor_stats(desc)
        price = parse_price(desc)
        bulk = parse_bulk(desc)

        acat = 'light'
        if any(w in desc for w in ('Тяжёлая','тяжёлые','Латы','латы')): acat = 'heavy'
        elif any(w in desc for w in ('Средняя','средняя','Кольчуга','кольчуг')): acat = 'medium'
        elif 'без брони' in name.lower(): acat = 'unarmored'

        group = 'composite'
        if 'кожан' in name.lower() or 'Кожа' in desc: group = 'leather'
        elif 'лат' in name.lower() or 'пластин' in desc: group = 'plate'
        elif 'кольчуг' in name.lower(): group = 'chain'
        elif 'ткань' in name.lower() or 'одежд' in name.lower(): group = 'cloth'
        if 'без брони' in name.lower(): group = 'unarmored'

        entries.append(dict(
            id=eid, name=name, level=level, rarity=rarity_from_desc(desc), category='armor',
            armorCategory=acat, armorBonus=stats['armorBonus'], dexterityCap=stats['dexterityCap'],
            checkPenalty=stats['checkPenalty'], speedPenalty=stats['speedPenalty'],
            strengthRequirement=stats['strengthRequirement'], group=group,
            price=price or {'cp':0,'sp':0,'gp':0,'pp':0}, bulk=bulk if bulk is not None else 0,
            traits=list(a.get('traits', [])), sourceBook=a.get('sourceBook', ''),
            description=desc or None
        ))

    def score(e):
        s = 0
        if e.get('description') and len(e['description']) > 50: s += 10
        if e['armorBonus'] > 0: s += 5
        if e['price']['gp'] > 0: s += 3
        return s

    return make_catalog('armor', 'Pathfinder 2 Armor', PF2R_SOURCE, '2026-07', dedup(entries, score))

# ═══════════════ SHIELDS ═══════════════
def normalize_shields():
    data = read_json(os.path.join(RULES_DIR, 'shields.json'))
    items = data.get('items', data.get('shields', []))
    entries = []
    for s in items:
        if not isinstance(s, dict): continue
        eid = s.get('id') or slugify(s.get('name', ''))
        name = s.get('name', '')
        if not eid or not name: continue
        desc = s.get('description', '')
        level = s.get('level', 0) or 0
        stats = parse_shield_stats(desc)
        price = parse_price(desc)
        bulk = parse_bulk(desc)

        ac_bonus = 2
        if 'Баклер' in desc or 'баклер' in desc: ac_bonus = 1

        entries.append(dict(
            id=eid, name=name, level=level, rarity=rarity_from_desc(desc), category='shield',
            armorClassBonus=ac_bonus, hardness=stats['hardness'],
            hitPoints=stats['hitPoints'], brokenThreshold=stats['brokenThreshold'],
            price=price or {'cp':0,'sp':0,'gp':0,'pp':0}, bulk=bulk if bulk is not None else 0,
            traits=list(s.get('traits', [])), sourceBook=s.get('sourceBook', ''),
            description=desc or None
        ))

    def score(e):
        s = 0
        if e.get('description') and len(e['description']) > 50: s += 10
        if e.get('hardness', 0) > 0: s += 5
        if e.get('hitPoints', 0) > 0: s += 5
        if e['price']['gp'] > 0: s += 3
        return s

    return make_catalog('shields', 'Pathfinder 2 Shields', PF2R_SOURCE, '2026-07', dedup(entries, score))

# ═══════════════ MAIN ═══════════════
def main():
    print('=== PF2 Rules Normalizer (Python) ===\n')
    os.makedirs(CATALOGS_DIR, exist_ok=True)

    catalogs = [
        ('equipment', normalize_equipment),
        ('weapons', normalize_weapons),
        ('armor', normalize_armor),
        ('shields', normalize_shields),
    ]

    for name, fn in catalogs:
        try:
            print(f'  {name}... ', end='', flush=True)
            doc = fn()
            write_json(os.path.join(CATALOGS_DIR, f'{name}.json'), doc)
            print(f'✅ {len(doc["entries"])} entries')
        except Exception as e:
            print(f'❌ {e}')

    print(f'\nReport: {len(issues)} issues → {REPORT_PATH}')
    lines = [f'# PF2 Rules Normalization Report\n\nGenerated: {__import__("datetime").datetime.now().isoformat()}\nTotal issues: {len(issues)}\n\n## Issues\n']
    for i in issues:
        lines.append(f'### {i["file"]}' + (f' [{i["index"]}]' if i.get('index') is not None else ''))
        if i.get('name'): lines.append(f'- **Name:** {i["name"]}')
        if i.get('conflictId'): lines.append(f'- **ID:** `{i["conflictId"]}`')
        if i.get('missingFields'): lines.append(f'- **Missing:** {", ".join(i["missingFields"])}')
        lines.append(f'- **Reason:** {i["reason"]}')
        lines.append(f'- **Owner:** {i["ownerAction"]}')
        lines.append('')
    if not issues:
        lines.append('No normalization issues found.')
    with open(REPORT_PATH, 'w') as f:
        f.write('\n'.join(lines))
    write_json(os.path.join(CATALOGS_DIR, 'normalization-report.json'), issues)
    print('Done.')

if __name__ == '__main__':
    main()
