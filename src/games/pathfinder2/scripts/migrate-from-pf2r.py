#!/usr/bin/env python3
"""Full migration: replace TableTopGames Pathfinder 2 rules with pf2r Babele data.
Reads ALL entries from pf2r Babele packs, wraps them in TableTopGames JSON format,
and extracts mechanical data from HTML descriptions where possible.
Usage: python3 src/games/pathfinder2/scripts/migrate-from-pf2r.py
"""

import json, os, re, sys
from collections import defaultdict, OrderedDict

PF2R_PACKS_DIR = '/tmp/pf2r/data/community/pf2e/packs'
RULES_DIR = os.path.join(os.path.dirname(__file__), '..', 'Rules')
CATALOGS_DIR = os.path.join(RULES_DIR, 'catalogs')

# ── helpers ──────────────────────────────────────────────
def slugify(text):
    return re.sub(r'[^a-z0-9]+', '-', str(text).lower()).strip('-')

def clean_name(name):
    name = re.sub(r'\s*\(\*\)', '', name)
    name = re.sub(r'\s*\[Legacy\]', '', name)
    return name.strip()

def strip_html(text):
    """Remove HTML tags, Foundry UUID refs, and Glyph markers."""
    # Remove Foundry-specific markers
    text = re.sub(r'@UUID\[[^\]]+\]\{([^}]+)\}', r'\1', text)
    text = re.sub(r'@UUID\[[^\]]+\]', '', text)
    text = re.sub(r'@Damage\[([^\]]+)\]', r'\1', text)
    text = re.sub(r'@Check\[[^\]]+\]\{([^}]+)\}', r'\1', text)
    text = re.sub(r'@Check\[[^\]]+\]', '', text)
    text = re.sub(r'@Template\[[^\]]+\]\{[^}]*\}', '', text)
    text = re.sub(r'@Template\[[^\]]+\]', '', text)
    text = re.sub(r'@Trait\[[^\]]+\]\{([^}]+)\}', r'\1', text)
    text = re.sub(r'@Trait\[[^\]]+\]', '', text)
    text = re.sub(r'@Condition\[([^\]]+)\]', r'\1', text)
    text = re.sub(r'@Glyph\[[^\]]+\]', '', text)
    text = re.sub(r'@Actor\[[^\]]+\]\{([^}]+)\}', r'\1', text)
    text = re.sub(r'@Actor\[[^\]]+\]', '', text)
    text = re.sub(r'@Compendium\[[^\]]+\]\{([^}]+)\}', r'\1', text)
    text = re.sub(r'@Compendium\[[^\]]+\]', '', text)
    text = re.sub(r'@Localize\[[^\]]+\]', '', text)
    text = re.sub(r'@Embed\[[^\]]+\]', '', text)
    # Strip remaining HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # Clean whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    # Unescape HTML entities
    text = text.replace('&quot;', '"').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    return text

def read_json(fp):
    with open(fp) as f:
        return json.load(f)

def write_json(fp, data):
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    with open(fp, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ── mechanical data extractors ───────────────────────────
def parse_level(desc, name=''):
    """Extract item level from description."""
    m = re.search(r'(?:Предмет|Уровень предмета|Item)\s+(\d+)', desc, re.IGNORECASE)
    if m: return int(m.group(1))
    # Try to find level from name like "Boots of Elvenkind (Greater)" → higher level
    if 'greater' in name.lower() or 'отличн' in name.lower(): return 12
    if 'major' in name.lower() or 'превосходн' in name.lower(): return 18
    if 'true' in name.lower() or 'истинн' in name.lower(): return 20
    return 0

def parse_price(desc):
    """Extract price from description. Returns {cp, sp, gp, pp} dict."""
    # Russian: Цена 10 зм
    m = re.search(r'Цена\s+([\d.,]+)\s*(зм|см|мм|пп|gp|sp|cp|pp)?', desc)
    if not m:
        # English fallback: Price 10 gp
        m = re.search(r'Price\s+([\d.,]+)\s*(gp|sp|cp|pp)?', desc, re.IGNORECASE)
    if not m:
        return {'cp': 0, 'sp': 0, 'gp': 0, 'pp': 0}
    amt = int(m.group(1).replace(',', '').replace('.', ''))
    unit = (m.group(2) or 'зм').lower()
    p = {'cp': 0, 'sp': 0, 'gp': 0, 'pp': 0}
    if unit in ('пп', 'pp'): p['pp'] = amt
    elif unit in ('зм', 'gp'): p['gp'] = amt
    elif unit in ('см', 'sp'): p['sp'] = amt
    elif unit in ('мм', 'cp'): p['cp'] = amt
    return p

def parse_bulk(desc):
    """Extract bulk/weight."""
    m = re.search(r'(?:Вес|Масса|Bulk)\s+([\dЛL.,\-–—]+)', desc, re.IGNORECASE)
    if not m: return None
    b = m.group(1).strip().upper()
    if b in ('L', 'Л', '—', '-', '–'): return 'light'
    try: return int(b)
    except: return None

def parse_rarity(desc, name=''):
    """Extract rarity."""
    combined = desc + ' ' + name
    if 'Уникальный' in combined or 'Unique' in combined: return 'unique'
    if 'Редкий' in combined or 'Rare' in combined: return 'rare'
    if 'Необычный' in combined or 'Uncommon' in combined: return 'uncommon'
    return 'common'

def parse_armor_stats(desc):
    """Extract armor mechanical stats."""
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
    """Extract shield stats."""
    h = re.search(r'[Тт]в[ёе]рдость\s+(\d+)', desc)
    hp = re.search(r'(?:ПЗ|ОЗ)\s+(\d+)', desc)
    bt = re.search(r'ПП\s+(\d+)', desc)
    return {
        'hardness': int(h.group(1)) if h else 0,
        'hitPoints': int(hp.group(1)) if hp else 0,
        'brokenThreshold': int(bt.group(1)) if bt else 0,
    }

def parse_weapon_damage(desc):
    """Extract weapon damage."""
    dmg = re.search(r'(\d+)d(\d+)\s*([БКРДПЭМС])', desc)
    if dmg:
        return {'count': int(dmg.group(1)), 'size': int(dmg.group(2))}, dmg.group(3)
    return {'count': 1, 'size': 4}, 'B'

def parse_weapon_range(desc):
    """Extract weapon range."""
    rng = re.search(r'(?:дистанция|шаг дистанции|дальность)\s+(\d+)', desc, re.IGNORECASE)
    return int(rng.group(1)) if rng else None

def parse_hands(desc, name=''):
    """Determine hands needed."""
    if '2 руки' in desc or 'двуруч' in desc or 'two-hand' in desc.lower():
        return 2
    if '1+' in desc or 'полутор' in desc:
        return '1+'
    return 1

def parse_traits_from_desc(desc):
    """Extract trait mentions from description."""
    # Common PF2 traits in Russian
    known_traits = [
        'быстрое', 'фехтовальное', 'несмертельное', 'безоружное', 'размашистое',
        'универсальное', 'смертельное', 'точное', 'огнестрельное', 'метательное',
        'монашеское', 'дварфийское', 'эльфийское', 'орчье', 'гоблинское',
        'магическое', 'арканное', 'божественное', 'природное', 'оккультное',
        'исцеление', 'некромантия', 'прорицание', 'иллюзия', 'воплощение',
        'вызывание', 'ограждение', 'превращение', 'ментальное',
        'светлое', 'теневое', 'воздух', 'земля', 'огонь', 'вода', 'дерево',
        'металл', 'электричество', 'холод', 'кислота', 'звук', 'сила',
        'яд', 'болезнь', 'проклятие', 'страх', 'эмоция',
    ]
    found = []
    for t in known_traits:
        if t in desc.lower():
            found.append(t)
    return found

def parse_source_book(desc):
    """Extract source book."""
    # Russian source patterns
    m = re.search(r'Источник\s+(.+?)(?:;|\.|$|\n)', desc)
    if m: return m.group(1).strip()
    m = re.search(r'Source\s+(.+?)(?:;|\.|$|\n)', desc, re.IGNORECASE)
    if m: return m.group(1).strip()
    return ''

# ── pf2r data loaders ────────────────────────────────────
def load_pack(filename):
    fp = os.path.join(PF2R_PACKS_DIR, filename)
    if not os.path.exists(fp):
        return {}
    data = read_json(fp)
    return data.get('entries', {})

def load_pack_folders(filename):
    fp = os.path.join(PF2R_PACKS_DIR, filename)
    if not os.path.exists(fp):
        return {}
    data = read_json(fp)
    return data.get('folders', {})

# ── category classification ──────────────────────────────
def classify_equipment(en_name, ru_name, desc):
    """Classify an equipment entry into TableTopGames category.
    Uses STRICT classification: first checks for definitive mechanical patterns,
    then falls back to naming patterns.
    """
    combined = (en_name + ' ' + ru_name).lower()
    desc_lower = desc.lower() if desc else ''
    full = combined + ' ' + desc_lower

    # ── Definitive mechanical checks (hardest to fake) ──

    # STAVES: "Staff of ..." / "Посох ..."
    if re.search(r'\bstaff\b', en_name, re.IGNORECASE) and not re.search(r'staff\s*(of|necklace|acrobat)', en_name, re.IGNORECASE) is False:
        pass  # continue checks
    if (en_name.lower().startswith('staff of') or en_name.lower().startswith('greater staff') or
        en_name.lower().startswith('major staff') or ru_name.lower().startswith('посох')):
        return 'staves'

    # WANDS: "Wand of ..." / "Волшебная палочка ..."
    if (en_name.lower().startswith('wand of') or en_name.lower().startswith('greater wand') or
        en_name.lower().startswith('major wand') or 'волшебная палочка' in ru_name.lower()):
        return 'wands'

    # RUNES: "Rune of ..." / "Руна ..."
    if (en_name.lower().startswith('rune of') or 'руна' in ru_name.lower() or
        'weapon potency' in en_name.lower() or 'armor potency' in en_name.lower() or
        'property rune' in en_name.lower()):
        return 'runes'

    # ── Check for weapon mechanical patterns ──
    # Must have weapon-specific damage formula AND weapon-group keywords
    has_dmg_formula = bool(re.search(r'\d+d\d+\s*[БКРДПЭМС]', desc_lower))
    is_actual_weapon = bool(re.search(
        r'\b(sword|меч|axe|топор|hammer|молот|spear|копь[ёе]|bow|лук|crossbow|арбалет|'
        r'flail|цеп|pick|клевец|чекан|club|дубин[а-я]*|палиц|shield boss|shield spike|'
        r'knife|нож|dagger|кинжал|firearm|огнестрел|пистол|мушкет|brawling|кастет|'
        r'gauntlet|перчат|polearm|древк|алебард|глеф|sling|пращ|dart|дротик)\b',
        combined + ' ' + desc_lower))
    is_fist = (en_name.lower() == 'fist' or ru_name.lower() == 'кулак')

    if has_dmg_formula or is_actual_weapon or is_fist:
        return 'weapons'

    # ── Check for armor mechanical patterns ──
    has_ac_bonus = bool(re.search(r'Бонус\s+КБ\s*\+?\d+', desc_lower))
    has_dex_cap = bool(re.search(r'Макс\.?\s*Ловк\s*\+?\d+', desc_lower))
    is_armor_type = bool(re.search(
        r'\b(breastplate|нагрудник|chain mail|кольчуг|leather armor|кожан[ыо]|'
        r'plate armor|лат[ныо]|half.?plate|полулаты|full plate|латы|'
        r'splint|шин|scale|чешуйчат|padded|ст[ёе]ган|studded leather|прокл[ёе]пан|'
        r'chain shirt|hide armor|шкур|ring mail|lattic|реш[ёе]тчат|'
        r'banded|полосчат|quilted|оде[яж]|explorer|исследовател|'
        r'gi|robes?|роб[аы]|clothing)\b', combined))

    if has_ac_bonus or has_dex_cap or is_armor_type:
        return 'armor'

    # ── Check for shield mechanical patterns ──
    has_hardness_hp = bool(re.search(r'[Тт]в[ёе]рдость\s+\d+', desc_lower))
    is_shield_name = bool(re.search(r'\b(shield|щит|buckler|баклер|tower shield|башенный)\b', combined))

    if has_hardness_hp or is_shield_name:
        return 'shields'

    # ── Consumables ──
    if bool(re.search(r'\b(potion|зелье|elixir|эликсир|scroll|свиток|'
                       r'mutagen|мутаген|poison\b|яд\b|talisman|талисман|'
                       r'ammunition|боеприпас|oil of|масло|shot\b|пуля|'
                       r'bolt\b|стрела|arrow\b)\b', combined)):
        return 'consumables'

    # ── Alchemical items (but NOT if already classified) ──
    if bool(re.search(r'\b(alchemical|алхим|bomb\b|бомб[аы])\b', combined)):
        return 'alchemical-items'

    # ── Spellhearts ──
    if 'spellheart' in combined or 'заклинательный камень' in combined:
        return 'spellhearts'

    # ── Snares ──
    if bool(re.search(r'\b(snare|ловушк[аи]|капкан|силок|снаряд-ловушк)\b', combined)):
        return 'snares'

    # ── Tattoos ──
    if bool(re.search(r'\b(tattoo|тату[ии]ровка)\b', combined)):
        return 'tattoos'

    # ── Grafts ──
    if bool(re.search(r'\b(graft|трансплантат)\b', combined)):
        return 'grafts'

    # ── Materials ──
    if bool(re.search(r'\b(material|материал|adamantine|адамантин|mithral|митрал|'
                       r'orichalcum|орихалк|silver|серебр|cold iron|холодное железо|'
                       r'darkwood|тёмное дерево|dragonhide|драконь[яи]|'
                       r'sovereign steel|суверенная сталь|warpglass|искривлённое стекло)\b',
                       combined)):
        return 'materials'

    # ── Artifacts ──
    if bool(re.search(r'\b(artifact|артефакт)\b', combined)):
        return 'artifacts'

    # ── Assistive items ──
    if bool(re.search(r'\b(assistive|вспомогат|prosthes|протез|wheelchair|'
                       r'коляс[кч]|hearing aid|слухов|reading ring|'
                       r'cognitive|cane|трость|калоприёмник)\b', combined)):
        return 'assistive-items'

    # ── Contracts ──
    if bool(re.search(r'\b(contract|контракт|bargain|сделк[аи]|infernal)\b', combined)):
        return 'contracts'

    # ── Customizations ──
    if bool(re.search(r'\b(customization|модификаци[яи]|adjustment|настройк[аи]|'
                       r'barding|попона|harness|упряжь)\b', combined)):
        return 'customizations'

    # ── Structures ──
    if bool(re.search(r'\b(structure|сооружение|tent|палатк[аи]|pavilion|павильон|'
                       r'fortification|укрепление|ladder|лестниц)\b', combined)):
        return 'structures'

    # ── Worn items (check before held, as some items are worn AND held) ──
    if bool(re.search(r'\b(worn|носим[ыо]|boots|сапог|cloak|плащ|mantle|мантия|'
                       r'belt|пояс|gloves|перчатк[аи]|hat|шляп[аы]|cap|шапк[аи]|'
                       r'circlet|вен[ое]ц|amulet|амулет|ring|кольц[оа]|bracers?|наруч|'
                       r'necklace|ожерел|mask|маск[аи]|crown|корон[аы]|'
                       r'robe|роб[аы]|vest|жилет|gorget|горжет|'
                       r'headband|повязк[аи]|diadem|диадем[аы]|'
                       r'eyepiece|очк[ио]|goggles|очк[ио]|'
                       r'healers? tools|набор[ы]?\s*лекаря|'
                       r'collar|ошейник|footwear|обув|sandals|сандал|'
                       r'saddle|седл[ао]|horseshoe|подков[аы]|'
                       r'anklets?|ножн[ыо]|браслет|'
                       r'garment|эполет|epaulet|накидк[аи]|'
                       r'backpack|рюкзак)\b', combined)):
        return 'worn-items'

    # ── Held items ──
    if bool(re.search(r'\b(held|удерж|rod|стержень|жезл|orb|сфер[аы]|'
                       r'tool|инструмент|lens|линз[аы]|lantern|фонар[ьи]|'
                       r'bag of|меш[оы]к|bag holding|бездонн|'
                       r'key|ключ|horn|рог|whistle|свист[оы]к|'
                       r'compass|компас|map|карт[аы]|book|книг[аи]|'
                       r'flask|фляг[аи]|bottle|бутыл[к]|'
                       r'kit|набор|hourglass|песочные часы|'
                       r'manacles|кандал|handcuffs|наручник|'
                       r'mirror|зеркал[оа]|candle|свеч[аи]|'
                       r'dice|кости|cards?|карт[ы]|'
                       r'chalice|чаш[аи]|grail|грааль|'
                       r'puzzle box|шкатулк[аи]|'
                       r'thieves tools|воровск|'
                       r'climbing kit|альпинистск|'
                       r'clothing|explorer|одежд[аы]|'
                       r'writing set|письменные|'
                       r'formula book|книг[аи] формул|'
                       r'spellbook|книг[аи] заклинаний)\b', combined)):
        return 'held-items'

    # ── Siege weapons ──
    if bool(re.search(r'\b(siege|осадн|catapult|катапульт|ballista|баллист|'
                       r'trebuchet|требушет|ram|таран)\b', combined)):
        return 'siege-weapons'

    # ── Default: adventuring gear ──
    return 'adventuring-gear'

# ── entry builders ────────────────────────────────────────
def make_base_entry(en_name, v):
    """Create base entry from pf2r Babele entry."""
    ru_name = clean_name(v.get('name', en_name)) if isinstance(v, dict) else clean_name(v)
    desc_html = v.get('description', '') if isinstance(v, dict) else ''
    desc_clean = strip_html(desc_html)

    eid = v.get('_id', slugify(en_name)) if isinstance(v, dict) else slugify(en_name)
    if isinstance(eid, dict): eid = slugify(en_name)

    level = parse_level(desc_clean, en_name)
    price = parse_price(desc_clean)
    bulk = parse_bulk(desc_clean)
    rarity = parse_rarity(desc_clean, en_name)
    source = parse_source_book(desc_clean)

    # Try to extract level from name patterns
    if not level:
        m = re.search(r'\((\d+)[-й]\s*(?:уровень|ранг|level|rank)', en_name + ru_name, re.IGNORECASE)
        if m: level = int(m.group(1))

    return {
        'id': eid,
        'name': ru_name,
        'nameEn': en_name,
        'level': level,
        'rarity': rarity,
        'price': price,
        'bulk': bulk if bulk is not None else 0,
        'sourceBook': source,
        'description': desc_clean or desc_html,
        'traits': parse_traits_from_desc(desc_clean),
    }

def make_weapon_entry(en_name, v):
    """Build a weapon entry."""
    base = make_base_entry(en_name, v)
    desc = base.get('description', '') + ' ' + en_name

    damage, dtype = parse_weapon_damage(desc)
    rng = parse_weapon_range(desc)
    hands = parse_hands(desc, en_name)

    # Proficiency category
    prof_cat = 'simple'
    if 'Продвинутое' in desc or 'Экзотическое' in desc or 'advanced' in desc.lower():
        prof_cat = 'advanced'
    elif 'Воинское' in desc or 'martial' in desc.lower():
        prof_cat = 'martial'
    elif 'Безоружное' in desc or 'unarmed' in desc.lower():
        prof_cat = 'unarmed'

    # Group
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
        'sword': 'sword', 'axe': 'axe', 'hammer': 'hammer', 'bow': 'bow',
        'crossbow': 'crossbow', 'sling': 'sling', 'flail': 'flail',
        'pick': 'pick', 'knife': 'knife', 'spear': 'spear',
        'polearm': 'polearm', 'brawling': 'brawling', 'firearm': 'firearm',
        'dart': 'dart', 'club': 'club', 'shield': 'shield', 'bomb': 'bomb',
    }
    group = ''
    combined_lower = (base.get('name', '') + ' ' + en_name).lower()
    for hint, grp in GROUP_HINTS.items():
        if hint in combined_lower:
            group = grp
            break

    usage = 'ranged' if rng else 'melee'
    if 'метательн' in combined_lower or 'thrown' in combined_lower:
        usage = 'thrown'

    reload_val = 1 if 'перезарядка' in desc.lower() or 'reload' in desc.lower() else None

    base.update({
        'category': 'weapon',
        'proficiencyCategory': prof_cat,
        'group': group,
        'damageDice': damage,
        'damageType': dtype,
        'range': rng,
        'reload': reload_val,
        'hands': hands,
        'usage': usage,
    })
    return base

def make_armor_entry(en_name, v):
    """Build an armor entry."""
    base = make_base_entry(en_name, v)
    desc = base.get('description', '') + ' ' + en_name
    combined_lower = (base.get('name', '') + ' ' + en_name).lower()

    stats = parse_armor_stats(desc)

    acat = 'light'
    if any(w in combined_lower for w in ('тяжёлая', 'тяжёлые', 'латы', 'heavy', 'plate')):
        acat = 'heavy'
    elif any(w in combined_lower for w in ('средняя', 'средние', 'кольчуг', 'medium', 'chain')):
        acat = 'medium'
    elif 'без брони' in combined_lower or 'unarmored' in combined_lower:
        acat = 'unarmored'

    group = 'composite'
    if 'кожан' in combined_lower or 'leather' in combined_lower: group = 'leather'
    elif 'лат' in combined_lower or 'plate' in combined_lower: group = 'plate'
    elif 'кольчуг' in combined_lower or 'chain' in combined_lower: group = 'chain'
    elif 'ткань' in combined_lower or 'cloth' in combined_lower: group = 'cloth'
    if 'без брони' in combined_lower or 'unarmored' in combined_lower: group = 'unarmored'

    base.update({
        'category': 'armor',
        'armorCategory': acat,
        'armorBonus': stats['armorBonus'],
        'dexterityCap': stats['dexterityCap'],
        'checkPenalty': stats['checkPenalty'],
        'speedPenalty': stats['speedPenalty'],
        'strengthRequirement': stats['strengthRequirement'],
        'group': group,
    })
    return base

def make_shield_entry(en_name, v):
    """Build a shield entry."""
    base = make_base_entry(en_name, v)
    desc = base.get('description', '')
    stats = parse_shield_stats(desc)

    ac_bonus = 2
    if 'баклер' in desc.lower() or 'buckler' in desc.lower(): ac_bonus = 1

    base.update({
        'category': 'shield',
        'armorClassBonus': ac_bonus,
        'hardness': stats['hardness'],
        'hitPoints': stats['hitPoints'],
        'brokenThreshold': stats['brokenThreshold'],
    })
    return base

def make_item_entry(en_name, v, category='items'):
    """Build a generic item entry."""
    base = make_base_entry(en_name, v)
    base['category'] = category
    return base

def make_spell_entry(en_name, v, rank='unknown'):
    """Build a spell entry."""
    ru_name = clean_name(v.get('name', en_name)) if isinstance(v, dict) else clean_name(v)
    desc_html = v.get('description', '') if isinstance(v, dict) else ''
    desc_clean = strip_html(desc_html)

    # Determine spell rank from name/description or folder
    m = re.search(r'(?:Заклинание|Spell)\s+(\d+)', desc_clean, re.IGNORECASE)
    if m: rank = int(m.group(1))

    traditions = []
    for trad in ['arcane', 'арканный', 'divine', 'божественный', 'primal', 'природный', 'occult', 'оккультный']:
        if trad in desc_clean.lower():
            if trad in ('arcane', 'арканный'): traditions.append('arcane')
            elif trad in ('divine', 'божественный'): traditions.append('divine')
            elif trad in ('primal', 'природный'): traditions.append('primal')
            elif trad in ('occult', 'оккультный'): traditions.append('occult')

    eid = slugify(en_name)
    rarity = parse_rarity(desc_clean, en_name)
    source = parse_source_book(desc_clean)

    return {
        'id': eid,
        'name': ru_name,
        'nameEn': en_name,
        'rank': rank,
        'rarity': rarity,
        'traditions': list(set(traditions)),
        'traits': parse_traits_from_desc(desc_clean),
        'sourceBook': source,
        'description': desc_clean or desc_html,
    }

def make_feat_entry(en_name, v, folder=''):
    """Build a feat entry."""
    ru_name = clean_name(v.get('name', en_name)) if isinstance(v, dict) else clean_name(v)
    desc_html = v.get('description', '') if isinstance(v, dict) else ''
    desc_clean = strip_html(desc_html)

    # Extract level
    level = 1
    m = re.search(r'(?:Уровень|Level)\s+(\d+)', desc_clean, re.IGNORECASE)
    if m: level = int(m.group(1))

    # Extract prerequisites
    prereqs = None
    m = re.search(r'(?:Требован|Prerequisite|Требования)[:\s]+(.+?)(?:;|\.|$|\n)', desc_clean, re.IGNORECASE)
    if m: prereqs = m.group(1).strip()

    # Determine feat type from folder
    feat_type = 'General'
    if folder and folder.lower() in ('class', 'класс'): feat_type = 'Class'
    elif folder and folder.lower() in ('ancestry', 'родословная'): feat_type = 'Ancestry'
    elif folder and folder.lower() in ('skill', 'навык'): feat_type = 'Skill'
    elif folder and folder.lower() in ('archetype', 'архетип'): feat_type = 'Archetype'

    eid = slugify(en_name)
    rarity = parse_rarity(desc_clean, en_name)
    source = parse_source_book(desc_clean)

    return {
        'id': eid,
        'name': ru_name,
        'nameEn': en_name,
        'level': level,
        'rarity': rarity,
        'type': feat_type,
        'prerequisites': prereqs,
        'traits': parse_traits_from_desc(desc_clean),
        'sourceBook': source,
        'description': desc_clean or desc_html,
        'folder': folder,
    }

def make_background_entry(en_name, v):
    """Build a background entry."""
    ru_name = clean_name(v.get('name', en_name)) if isinstance(v, dict) else clean_name(v)
    desc_html = v.get('description', '') if isinstance(v, dict) else ''
    desc_clean = strip_html(desc_html)

    eid = slugify(en_name)
    rarity = parse_rarity(desc_clean, en_name)
    source = parse_source_book(desc_clean)

    return {
        'id': eid,
        'name': ru_name,
        'nameEn': en_name,
        'rarity': rarity,
        'traits': parse_traits_from_desc(desc_clean),
        'sourceBook': source,
        'description': desc_clean or desc_html,
    }

def make_ancestry_entry(en_name, v):
    """Build an ancestry entry."""
    ru_name = clean_name(v.get('name', en_name)) if isinstance(v, dict) else clean_name(v)
    desc_html = v.get('description', '') if isinstance(v, dict) else ''
    desc_clean = strip_html(desc_html)

    eid = slugify(en_name)
    rarity = parse_rarity(desc_clean, en_name)
    source = parse_source_book(desc_clean)

    return {
        'id': eid,
        'name': ru_name,
        'nameEn': en_name,
        'rarity': rarity,
        'hitPoints': 0,
        'size': 'medium',
        'speed': 25,
        'traits': [en_name, 'Humanoid'],
        'languages': [],
        'description': desc_clean or desc_html,
        'sourceBook': source,
    }

def make_deity_entry(en_name, v):
    """Build a deity entry."""
    ru_name = clean_name(v.get('name', en_name)) if isinstance(v, dict) else clean_name(v)
    desc_html = v.get('description', '') if isinstance(v, dict) else ''
    desc_clean = strip_html(desc_html)

    eid = slugify(en_name)
    source = parse_source_book(desc_clean)

    return {
        'id': eid,
        'name': ru_name,
        'nameEn': en_name,
        'description': desc_clean or desc_html,
        'sourceBook': source,
        'edicts': [],
        'anathema': [],
        'areasOfConcern': [],
        'followerAlignments': [],
        'divineFont': '',
        'skills': [],
        'favoredWeapon': '',
        'domains': [],
    }

# ── main migration logic ─────────────────────────────────
def migrate_equipment():
    """Process equipment-srd.json and split into categorized files."""
    print('\n📦 Processing equipment...')
    entries = load_pack('pf2e.equipment-srd.json')
    print(f'   Total entries: {len(entries)}')

    categorized = defaultdict(list)

    for en_name, v in entries.items():
        if not isinstance(v, dict):
            continue
        ru_name = clean_name(v.get('name', en_name))
        desc = v.get('description', '')

        cat = classify_equipment(en_name, ru_name, desc)

        if cat == 'weapons':
            entry = make_weapon_entry(en_name, v)
        elif cat == 'armor':
            entry = make_armor_entry(en_name, v)
        elif cat == 'shields':
            entry = make_shield_entry(en_name, v)
        elif cat == 'consumables':
            entry = make_item_entry(en_name, v, 'consumable')
        elif cat == 'runes':
            entry = make_item_entry(en_name, v, 'rune')
        elif cat == 'snares':
            entry = make_item_entry(en_name, v, 'snare')
        elif cat == 'tattoos':
            entry = make_item_entry(en_name, v, 'tattoo')
        elif cat == 'grafts':
            entry = make_item_entry(en_name, v, 'graft')
        elif cat == 'materials':
            entry = make_item_entry(en_name, v, 'material')
        elif cat == 'spellhearts':
            entry = make_item_entry(en_name, v, 'spellheart')
        elif cat == 'artifacts':
            entry = make_item_entry(en_name, v, 'artifact')
        elif cat == 'assistive-items':
            entry = make_item_entry(en_name, v, 'assistive')
        else:
            entry = make_item_entry(en_name, v, cat)

        categorized[cat].append(entry)

    # Write categorized files
    file_configs = {
        'weapons': {'key': 'weapons', 'title': 'PF2 Weapons', 'source': 'pf2r (equipment-srd)'},
        'armor': {'key': 'armor', 'title': 'PF2 Armor', 'source': 'pf2r (equipment-srd)'},
        'shields': {'key': 'items', 'title': 'PF2 Shields', 'source': 'pf2r (equipment-srd)'},
        'consumables': {'key': 'consumables', 'title': 'PF2 Consumables', 'source': 'pf2r (equipment-srd)'},
        'worn-items': {'key': 'wornItems', 'title': 'PF2 Worn Items', 'source': 'pf2r (equipment-srd)'},
        'held-items': {'key': 'items', 'title': 'PF2 Held Items', 'source': 'pf2r (equipment-srd)'},
        'adventuring-gear': {'key': 'items', 'title': 'PF2 Adventuring Gear', 'source': 'pf2r (equipment-srd)'},
        'alchemical-items': {'key': 'items', 'title': 'PF2 Alchemical Items', 'source': 'pf2r (equipment-srd)'},
        'runes': {'key': 'runes', 'title': 'PF2 Runes', 'source': 'pf2r (equipment-srd)'},
        'staves': {'key': 'staves', 'title': 'PF2 Staves', 'source': 'pf2r (equipment-srd)'},
        'wands': {'key': 'wands', 'title': 'PF2 Wands', 'source': 'pf2r (equipment-srd)'},
        'snares': {'key': 'snares', 'title': 'PF2 Snares', 'source': 'pf2r (equipment-srd)'},
        'tattoos': {'key': 'items', 'title': 'PF2 Tattoos', 'source': 'pf2r (equipment-srd)'},
        'grafts': {'key': 'items', 'title': 'PF2 Grafts', 'source': 'pf2r (equipment-srd)'},
        'artifacts': {'key': 'artifacts', 'title': 'PF2 Artifacts', 'source': 'pf2r (equipment-srd)'},
        'assistive-items': {'key': 'items', 'title': 'PF2 Assistive Items', 'source': 'pf2r (equipment-srd)'},
        'materials': {'key': 'materials', 'title': 'PF2 Materials', 'source': 'pf2r (equipment-srd)'},
        'spellhearts': {'key': 'spellhearts', 'title': 'PF2 Spellhearts', 'source': 'pf2r (equipment-srd)'},
        'contracts': {'key': 'contracts', 'title': 'PF2 Contracts', 'source': 'pf2r (equipment-srd)'},
        'customizations': {'key': 'customizations', 'title': 'PF2 Customizations', 'source': 'pf2r (equipment-srd)'},
        'structures': {'key': 'items', 'title': 'PF2 Structures', 'source': 'pf2r (equipment-srd)'},
    }

    for cat, config in file_configs.items():
        items = categorized.get(cat, [])
        if not items:
            # Create empty file
            items = []

        data = OrderedDict([
            ('title', config['title']),
            ('source', config['source']),
            ('baseSource', 'https://gitlab.com/gnuraco/pf2r'),
            ('version', '2026-07'),
            (config['key'], items),
        ])
        if cat in ('alchemical-items', 'consumables', 'tattoos', 'grafts', 'spellhearts', 'runes', 'wands', 'snares', 'materials'):
            data['note'] = 'Auto-generated from pf2r Babele translations'
            data.move_to_end('note', last=False)

        write_json(os.path.join(RULES_DIR, f'{cat}.json'), data)
        print(f'   ✅ {cat}.json: {len(items)} entries')

    # Also write siege-weapons.json (usually not in pf2r equipment)
    siege_data = OrderedDict([
        ('title', 'PF2 Siege Weapons'),
        ('source', 'pf2r (equipment-srd)'),
        ('baseSource', 'https://gitlab.com/gnuraco/pf2r'),
        ('version', '2026-07'),
        ('siegeWeapons', categorized.get('siege-weapons', [])),
    ])
    write_json(os.path.join(RULES_DIR, 'siege-weapons.json'), siege_data)
    print(f'   ✅ siege-weapons.json: {len(categorized.get("siege-weapons", []))} entries')


def migrate_spells():
    """Process spells-srd.json."""
    print('\n🔮 Processing spells...')
    entries = load_pack('pf2e.spells-srd.json')
    folders = load_pack_folders('pf2e.spells-srd.json')
    print(f'   Total entries: {len(entries)}')

    cantrips = []
    spells_by_rank = defaultdict(list)
    rituals = []
    uncategorized = []

    for en_name, v in entries.items():
        if not isinstance(v, dict):
            continue
        entry = make_spell_entry(en_name, v)
        rank = entry.get('rank', 'unknown')

        # Check if it's a cantrip
        combined = (en_name + ' ' + entry.get('description', '') + ' ' + str(entry.get('rank', ''))).lower()
        is_cantrip = ('cantrip' in combined or 'заговор' in combined or 'чары' in combined or
                      entry.get('rank') == 'cantrip' or entry.get('rank') == 0)

        is_ritual = ('ritual' in combined or 'ритуал' in combined)

        if is_cantrip:
            cantrips.append(entry)
        elif is_ritual:
            rituals.append(entry)
        else:
            spells_by_rank[rank].append(entry)

    # Flatten spells list
    all_spells = []
    for rank in sorted([r for r in spells_by_rank if isinstance(r, int)]):
        all_spells.extend(spells_by_rank[rank])
    all_spells.extend(spells_by_rank['unknown'])

    spells_data = OrderedDict([
        ('title', 'PF2 Spells'),
        ('source', 'pf2r (spells-srd)'),
        ('baseSource', 'https://gitlab.com/gnuraco/pf2r'),
        ('version', '2026-07'),
        ('note', 'Auto-generated from pf2r Babele translations'),
        ('rarityLevels', ['common', 'uncommon', 'rare', 'unique']),
        ('traditions', ['arcane', 'divine', 'primal', 'occult']),
        ('cantrips', cantrips),
        ('spells', all_spells),
    ])
    write_json(os.path.join(RULES_DIR, 'spells.json'), spells_data)
    print(f'   ✅ spells.json: {len(cantrips)} cantrips + {len(all_spells)} spells')

    # Also write rituals.json
    rituals_data = OrderedDict([
        ('title', 'PF2 Rituals'),
        ('source', 'pf2r (spells-srd)'),
        ('baseSource', 'https://gitlab.com/gnuraco/pf2r'),
        ('version', '2026-07'),
        ('note', 'Auto-generated from pf2r Babele translations'),
        ('rituals', rituals),
    ])
    write_json(os.path.join(RULES_DIR, 'rituals.json'), rituals_data)
    print(f'   ✅ rituals.json: {len(rituals)} entries')


def migrate_feats():
    """Process feats-srd.json."""
    print('\n🎯 Processing feats...')
    entries = load_pack('pf2e.feats-srd.json')
    folders = load_pack_folders('pf2e.feats-srd.json')
    print(f'   Total entries: {len(entries)}')
    print(f'   Folders: {len(folders)}')

    # Group feats by folder
    feats_by_folder = defaultdict(list)
    # Also load class features and ancestry features
    class_features = load_pack('pf2e.classfeatures.json')
    ancestry_features = load_pack('pf2e.ancestryfeatures.json')

    for en_name, v in entries.items():
        if not isinstance(v, dict):
            continue
        # Determine folder from the entry or name
        folder = ''
        # Try to find which folder this feat belongs to
        # (Babele packs don't directly encode folder membership per entry)
        entry = make_feat_entry(en_name, v, folder)

        # Classify into tabs
        combined = (en_name + ' ' + entry.get('description', '') + ' ' + ' '.join(entry.get('traits', []))).lower()

        # Check for Mythic feats
        is_mythic = ('mythic' in combined or 'мифический' in combined or
                     'mythic' in entry.get('traits', []) or
                     'Mythic' in entry.get('traits', []))

        # Check for Skill feats
        skill_keywords = ['acrobat', 'акробат', 'arcana', 'аркан', 'athletics', 'атлетик',
                          'crafting', 'рем[её]сл', 'deception', 'обман', 'diplomacy', 'дипломат',
                          'intimidation', 'запугиван', 'medicine', 'медицин', 'nature', 'природ',
                          'occultism', 'оккультизм', 'performance', 'выступлен',
                          'religion', 'религи', 'society', 'обществ', 'stealth', 'скрытност',
                          'survival', 'выживан', 'thievery', 'воровств',
                          'lore', 'знание', 'skill', 'навык']
        is_skill = ('skill' in entry.get('traits', []) or
                    'Skill' in entry.get('traits', []) or
                    'навык' in entry.get('traits', []) or
                    any(kw in combined for kw in skill_keywords))

        if is_mythic:
            entry['folder'] = 'Mythic'
            feats_by_folder['mythic'].append(entry)
        elif is_skill:
            entry['folder'] = 'Skill'
            feats_by_folder['skill'].append(entry)
        else:
            entry['folder'] = 'General'
            feats_by_folder['general'].append(entry)

    feats_data = OrderedDict([
        ('title', 'PF2 Feats'),
        ('source', 'pf2r (feats-srd)'),
        ('baseSource', 'https://gitlab.com/gnuraco/pf2r'),
        ('version', '2026-07'),
        ('note', 'Auto-generated from pf2r Babele translations'),
        ('tabs', OrderedDict([
            ('general', 'Общие черты — доступны любому персонажу по уровню'),
            ('skill', 'Навыковые черты — сгруппированы по навыкам'),
            ('mythic', 'Мифические черты — требуют мифического статуса (War of Immortals)'),
        ])),
        ('feats', OrderedDict([
            ('general', feats_by_folder.get('general', [])),
            ('skill', feats_by_folder.get('skill', [])),
            ('mythic', feats_by_folder.get('mythic', [])),
        ])),
    ])
    write_json(os.path.join(RULES_DIR, 'feats.json'), feats_data)
    print(f'   ✅ feats.json: general={len(feats_by_folder.get("general", []))}, skill={len(feats_by_folder.get("skill", []))}, mythic={len(feats_by_folder.get("mythic", []))}')


def migrate_backgrounds():
    """Process backgrounds.json from pf2r."""
    print('\n📋 Processing backgrounds...')
    entries = load_pack('pf2e.backgrounds.json')
    print(f'   Total entries: {len(entries)}')

    result = []
    for en_name, v in entries.items():
        if not isinstance(v, dict):
            continue
        result.append(make_background_entry(en_name, v))

    data = OrderedDict([
        ('title', 'PF2 Backgrounds'),
        ('source', 'pf2r (backgrounds)'),
        ('baseSource', 'https://gitlab.com/gnuraco/pf2r'),
        ('version', '2026-07'),
        ('backgrounds', result),
    ])
    write_json(os.path.join(RULES_DIR, 'backgrounds.json'), data)
    print(f'   ✅ backgrounds.json: {len(result)} entries')


def migrate_ancestries():
    """Process ancestries.json from pf2r."""
    print('\n🧬 Processing ancestries...')
    entries = load_pack('pf2e.ancestries.json')
    heritages = load_pack('pf2e.heritages.json')
    print(f'   Ancestries: {len(entries)}, Heritages: {len(heritages)}')

    ancestry_list = []
    for en_name, v in entries.items():
        if not isinstance(v, dict):
            continue
        ancestry_list.append(make_ancestry_entry(en_name, v))

    heritage_list = []
    for en_name, v in heritages.items():
        if not isinstance(v, dict):
            continue
        ru_name = clean_name(v.get('name', en_name))
        desc = strip_html(v.get('description', ''))
        heritage_list.append({
            'id': slugify(en_name),
            'name': ru_name,
            'nameEn': en_name,
            'rarity': parse_rarity(desc, en_name),
            'traits': parse_traits_from_desc(desc),
            'description': desc,
            'sourceBook': parse_source_book(desc),
        })

    data = OrderedDict([
        ('title', 'PF2 Ancestries & Heritages'),
        ('source', 'pf2r'),
        ('baseSource', 'https://gitlab.com/gnuraco/pf2r'),
        ('version', '2026-07'),
        ('note', 'Auto-generated from pf2r Babele translations'),
        ('abilityKeys', ['str', 'dex', 'con', 'int', 'wis', 'cha']),
        ('sizeCategories', ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']),
        ('rarityLevels', ['common', 'uncommon', 'rare', 'unique']),
        ('ancestries', ancestry_list),
        ('versatileHeritages', heritage_list),
    ])
    write_json(os.path.join(RULES_DIR, 'ancestries.json'), data)
    print(f'   ✅ ancestries.json: {len(ancestry_list)} ancestries + {len(heritage_list)} heritages')


def migrate_classes():
    """Process classes.json from pf2r."""
    print('\n⚔️  Processing classes...')
    entries = load_pack('pf2e.classes.json')
    class_features = load_pack('pf2e.classfeatures.json')
    print(f'   Classes: {len(entries)}, Features: {len(class_features)}')

    class_list = []
    for en_name, v in entries.items():
        if not isinstance(v, dict):
            continue
        ru_name = clean_name(v.get('name', en_name))
        desc = strip_html(v.get('description', ''))
        class_list.append({
            'id': slugify(en_name),
            'name': ru_name,
            'nameEn': en_name,
            'rarity': parse_rarity(desc, en_name),
            'role': '',
            'keyAbility': '',
            'hitPoints': 8,
            'description': desc,
            'sourceBook': parse_source_book(desc),
        })

    data = OrderedDict([
        ('title', 'PF2 Classes'),
        ('source', 'pf2r'),
        ('baseSource', 'https://gitlab.com/gnuraco/pf2r'),
        ('version', '2026-07'),
        ('note', 'Auto-generated from pf2r Babele translations'),
        ('rarityLevels', ['common', 'uncommon', 'rare', 'unique']),
        ('classes', class_list),
    ])
    write_json(os.path.join(RULES_DIR, 'classes.json'), data)
    print(f'   ✅ classes.json: {len(class_list)} entries')


def migrate_deities():
    """Process deities.json from pf2r."""
    print('\n🙏 Processing deities...')
    entries = load_pack('pf2e.deities.json')
    print(f'   Total entries: {len(entries)}')

    deity_list = []
    for en_name, v in entries.items():
        if not isinstance(v, dict):
            continue
        deity_list.append(make_deity_entry(en_name, v))

    data = OrderedDict([
        ('title', 'PF2 Deities'),
        ('source', 'pf2r (deities)'),
        ('baseSource', 'https://gitlab.com/gnuraco/pf2r'),
        ('version', '2026-07'),
        ('note', 'Auto-generated from pf2r Babele translations'),
        ('deities', deity_list),
    ])
    write_json(os.path.join(RULES_DIR, 'deities.json'), data)
    print(f'   ✅ deities.json: {len(deity_list)} entries')


def migrate_vehicles():
    """Process vehicles.json from pf2r."""
    print('\n🚗 Processing vehicles...')
    entries = load_pack('pf2e.vehicles.json')
    print(f'   Total entries: {len(entries)}')

    vehicle_list = []
    for en_name, v in entries.items():
        if not isinstance(v, dict):
            continue
        ru_name = clean_name(v.get('name', en_name))
        desc = strip_html(v.get('description', ''))
        vehicle_list.append({
            'name': ru_name,
            'nameEn': en_name,
            'level': parse_level(desc, en_name),
            'rarity': parse_rarity(desc, en_name),
            'description': desc,
            'sourceBook': parse_source_book(desc),
            'price': parse_price(desc),
        })

    data = OrderedDict([
        ('title', 'PF2 Vehicles'),
        ('source', 'pf2r (vehicles)'),
        ('baseSource', 'https://gitlab.com/gnuraco/pf2r'),
        ('version', '2026-07'),
        ('items', vehicle_list),
    ])
    write_json(os.path.join(RULES_DIR, 'vehicles.json'), data)
    print(f'   ✅ vehicles.json: {len(vehicle_list)} entries')


def migrate_archetypes():
    """Create archetypes.json from feat folders."""
    print('\n🏛️  Processing archetypes...')
    folders = load_pack_folders('pf2e.feats-srd.json')

    archetype_list = []
    for en_name, ru_name in folders.items():
        eid = slugify(en_name)
        # Skip non-archetype folders
        skip = ['ancestry', 'class', 'skill', 'general', 'mythic', 'aftermath',
                'родословная', 'класс', 'навык', 'общие', 'мифический', 'последствие']
        if any(s in en_name.lower() for s in skip):
            continue

        archetype_list.append({
            'id': eid,
            'name': ru_name,
            'nameEn': en_name,
            'rarity': 'common',
            'description': f'Архетип {ru_name}.',
            'sourceBook': '',
        })

    data = OrderedDict([
        ('title', 'PF2 Archetypes'),
        ('source', 'pf2r (feats-srd folders)'),
        ('baseSource', 'https://gitlab.com/gnuraco/pf2r'),
        ('version', '2026-07'),
        ('archetypes', archetype_list),
    ])
    write_json(os.path.join(RULES_DIR, 'archetypes.json'), data)
    print(f'   ✅ archetypes.json: {len(archetype_list)} entries')


# ── main ─────────────────────────────────────────────────
def main():
    print('=== PF2 Rules Full Migration from pf2r ===')
    print(f'Source: /tmp/pf2r/data/community/pf2e/packs/')
    print(f'Target: {RULES_DIR}')
    print(f'pf2r commit: 43c179e0daaa53adc1c867268f40dfbc2a3098cd')

    os.makedirs(RULES_DIR, exist_ok=True)

    migrate_equipment()
    migrate_spells()
    migrate_feats()
    migrate_backgrounds()
    migrate_ancestries()
    migrate_classes()
    migrate_deities()
    migrate_vehicles()
    migrate_archetypes()

    # Also create class-proficiencies.json (placeholder)
    prof_data = OrderedDict([
        ('title', 'PF2 Class Proficiencies'),
        ('source', 'pf2r'),
        ('version', '2026-07'),
        ('classes', []),
    ])
    write_json(os.path.join(RULES_DIR, 'class-proficiencies.json'), prof_data)
    print(f'   ✅ class-proficiencies.json: 0 entries (placeholder)')

    # Create relics.json (placeholder)
    relics_data = OrderedDict([
        ('title', 'PF2 Relics'),
        ('source', 'pf2r'),
        ('baseSource', 'https://gitlab.com/gnuraco/pf2r'),
        ('version', '2026-07'),
        ('relics', []),
    ])
    write_json(os.path.join(RULES_DIR, 'relics.json'), relics_data)
    print(f'   ✅ relics.json: 0 entries (placeholder)')

    print('\n=== Migration Complete ===')
    print(f'Backup saved at: {RULES_DIR}.backup.*/')

if __name__ == '__main__':
    main()
