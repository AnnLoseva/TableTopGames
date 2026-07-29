

// ==================== ВЕСЬ СКРИПТ (все части вместе) ====================
// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let RULES = {};
let currentPackage = 'balanced';
let clanDisciplines = [];
let predatorDisciplines = [];
let currentClanData = [];
let currentPredatorData = [];
let currentGenerationData = [];
let currentClanGalleryBaseData = [];
let currentClanGalleryOptions = {};
let currentClanGallerySearch = '';
let currentPredatorGalleryBaseData = [];
let currentPredatorGallerySearch = '';
let currentClanIndex = 0;
let currentPredatorIndex = 0;
let currentGenerationIndex = 0;
let currentClanDisciplines = [];     // какие дисциплины дал клан
let currentPredatorDisciplines = []; // какие дисциплины дал стиль охоты
let clanProvidedDisciplines = {};      // дисциплины от текущего клана
let predatorProvidedDisciplines = {};  // дисциплины от текущего стиля охоты
let selectedMerits = [];   // {category, name, points, fullDesc, mechanic}
let selectedFlaws = [];
let selectedThinBloodMerits = [];
let selectedThinBloodFlaws = [];

let startingSheetFixed = false;
let baseLevels = {};
let sheetLockSnapshot = null;
let isApplyingCharacterData = false;
let isExperiencePurchaseInProgress = false;
let expShopMode = false;
let expShopSnapshot = null;
let expShopStartLevels = {};
let expShopDisciplineMode = 'клановая';
let xpShopDisciplineSearch = '';
let startingSheetBase = null;
let sheetUnlockedForEditing = false;
let expHistory = [];
let lastAutoExperienceBonus = null;
let characterImageData = '';
let touchstones = [];
let moralityState = { chronicleTenets: [], convictions: [], touchstones: [] };
let inventory = [];
let explicitBloodPotency = null;
let vitalAutoSaveTimeout = null;
let currentCharType = 'vampire';
let currentMortalTemplate = null;
let characterHasBeenSaved = false;
// Stable-identity name pairs for comparisons against clan/discipline/predator-type/merit
// DISPLAY NAMES, which differ between rules.json (RU) and rules_eng.json (EN). The app
// compares against these names directly in several places; vtmName() keeps those
// comparisons working regardless of which rules file is currently loaded. Keyed by the
// Russian name (matches the i18n dictionary convention used elsewhere). Defined here, near
// the top of the file, because THIN_BLOOD_CLAN etc. below need it immediately.
const VTM_NAME_EN = {
    'Тремер': 'Tremere',
    'Вентру': 'Ventrue',
    'Суррогатчик': 'Bagger',
    'Фермер': 'Farmer',
    'Слабокровные': 'Thin-blood',
    'Каитиф': 'Caitiff',
    'Кровавое чародейство': 'Blood Sorcery',
    'Алхимия слабокровных': 'Thin-blood Alchemy',
    'Алхимик': 'Alchemist',
    'Склонность к Дисциплине': 'Discipline Affinity',
    'тремер': 'tremere',
    'СЛАБОКРОВНЫЕ': 'THIN_BLOODED',
    'Достоинства слабокровных': 'Thin-blooded Merits',
    'Недостатки слабокровных': 'Thin-blooded Flaws',
    // Clan/bloodline gallery names (main.js's own lookup tables, not sourced from rules.json)
    'Бруха': 'Brujah',
    'Гангрел': 'Gangrel',
    'Малкавиан': 'Malkavian',
    'Носферату': 'Nosferatu',
    'Тореадор': 'Toreador',
    'Ассамиты': 'Assamites',
    'Джованни': 'Giovanni',
    'Ласомбра': 'Lasombra',
    'Последователи Сета': 'Followers of Set',
    'Равнос': 'Ravnos',
    'Цимисхи': 'Tzimisce',
    'Каппадокийцы': 'Cappadocians',
    'Киасиды': 'Kiasyd',
    'Кровные Братья': 'Blood Brothers',
    'Ламии': 'Lamia',
    'Лианнан': 'Liannan',
    'Нагараджа': 'Nagaraja',
    'Нойады': 'Noiad',
    'Предвестники Черепов': 'Harbingers of Skulls',
    'Салюбри': 'Salubri',
    'Самеди': 'Samedi',
    // Predator Type gallery names (currentPredatorData below is hardcoded, not RULES-sourced)
    'Бестия': 'Blood Leech',
    'Джентльмен': 'Consensualist',
    'Идол': 'Osiris',
    'Искуситель': 'Siren',
    'Морфей': 'Sandman',
    'Налётчик': 'Alleycat',
    'Семьянин': 'Cleaver',
    'Тусовщик': 'Scene Queen',
    // The 9 core Attributes and 27 Skills. input[name=...] / data-attr / data-skill / data-name
    // in the DOM always stay Russian (renderAttributes/renderSkills hardcode it); RULES.attributes
    // and RULES.skills are keyed in whichever language rules.json/rules_eng.json provides.
    'Сила': 'Strength',
    'Ловкость': 'Dexterity',
    'Выносливость': 'Stamina',
    'Обаяние': 'Charisma',
    'Манипуляция': 'Manipulation',
    'Самообладание': 'Composure',
    'Интеллект': 'Intelligence',
    'Смекалка': 'Wits',
    'Упорство': 'Resolve',
    'Атлетика': 'Athletics',
    'Вождение': 'Drive',
    'Воровство': 'Larceny',
    'Выживание': 'Survival',
    'Драка': 'Brawl',
    'Ремесло': 'Craft',
    'Скрытность': 'Stealth',
    'Стрельба': 'Firearms',
    'Фехтование': 'Melee',
    'Запугивание': 'Intimidation',
    'Исполнение': 'Performance',
    'Лидерство': 'Leadership',
    'Обращение с животными': 'Animal Ken',
    'Проницательность': 'Insight',
    'Убеждение': 'Persuasion',
    'Уличное чутьё': 'Streetwise',
    'Хитрость': 'Subterfuge',
    'Этикет': 'Etiquette',
    'Гуманитарные науки': 'Academics',
    'Естественные науки': 'Science',
    'Медицина': 'Medicine',
    'Наблюдательность': 'Awareness',
    'Оккультизм': 'Occult',
    'Политика': 'Politics',
    'Расследование': 'Investigation',
    'Техника': 'Technology',
    'Финансы': 'Finance',
};

const VTM_NAME_RU = Object.entries(VTM_NAME_EN).reduce((map, [ru, en]) => {
    map[en] = ru;
    return map;
}, {});

function vtmName(ruName) {
    return (window.VTM_LANG === 'en') ? (VTM_NAME_EN[ruName] || ruName) : ruName;
}

/** Converts a name back to its canonical Russian form, whichever language it's currently in.
 *  Used to look up main.js's own RU-keyed tables (clan gallery images/descriptions/sections)
 *  by a name that may have come from RULES.clans in either language. */
function vtmCanonicalName(name) {
    return VTM_NAME_RU[name] || name;
}

const THIN_BLOOD_CLAN = vtmName('Слабокровные');
const CAITIFF_CLAN = vtmName('Каитиф');
const THIN_BLOOD_ALCHEMY = vtmName('Алхимия слабокровных');
const INVENTORY_CATEGORIES = ['Оружие', 'Одежда', 'Документы', 'Деньги', 'Артефакты', 'Расходники', 'Другое'];

function isNpcCharacterType(type = currentCharType) {
    return String(type || '').startsWith('npc-');
}

function isPlayerVampire(type = currentCharType) {
    return type === 'vampire';
}

function isStrictPlayerCreation() {
    return isPlayerVampire() && !startingSheetFixed && !expShopMode && !isApplyingCharacterData;
}

function getAllocationCounts(type) {
    const result = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    document.querySelectorAll(`.dot-input[data-type="${type}"]:checked`).forEach(input => {
        const value = parseInt(input.value, 10) || 0;
        if (value >= 1 && value <= 5) result[value]++;
    });
    return result;
}

function allocationMatchesLimits(actual, limits) {
    return [1, 2, 3, 4, 5].every(value => (actual[value] || 0) === (limits[value] || 0));
}

function formatAllocationLimits(limits) {
    return [1, 2, 3, 4, 5]
        .filter(value => (limits[value] || 0) > 0)
        .map(value => `${limits[value]}×${value}`)
        .join(', ');
}

function getPaidCreationMeritPoints() {
    return selectedMerits.reduce((sum, item) => sum + getPaidMeritPoints(item), 0);
}

function getPaidCreationFlawPoints() {
    return selectedFlaws.reduce((sum, item) => item.fromPredator ? sum : sum + getTraitPoints(item), 0);
}

function getClanDisciplineDots(clanName = getCurrentClan()) {
    return Object.values(disciplineSources || {}).reduce((total, sources) => {
        return total + Object.entries(sources || {}).reduce((sum, [source, dots]) => {
            return source === `${t("Клан")} ${clanName}` ? sum + (parseInt(dots, 10) || 0) : sum;
        }, 0);
    }, 0);
}

function getPlayerCreationIssues() {
    if (!isPlayerVampire()) return [];

    const issues = [];
    const clan = getCurrentClan();
    const predator = document.getElementById('predator-input')?.value || '';
    const generation = document.getElementById('generation-input')?.value || '';
    const type = document.getElementById('type-input')?.value || '';
    const skillPackage = document.getElementById('skill-package')?.value || '';
    const baseHumanity = parseInt(document.getElementById('base-humanity')?.value || '7', 10) || 7;
    const allowedGenerations = {
        childe: ['12', '13', '14', '15', '16'],
        neonate: ['12', '13'],
        ancilla: ['8', '9', '10', '11']
    };

    if (!clan) issues.push(t('выбери клан'));
    if (!predator) issues.push(t('выбери тип охоты'));
    if (!generation) issues.push(t('выбери поколение'));
    if (!type) issues.push(t('выбери тип вампира'));
    if (type && !allowedGenerations[type]) issues.push(t('игроку доступны Птенец, Неонат или Анцилла'));
    if (type && generation && allowedGenerations[type] && !allowedGenerations[type].includes(generation)) {
        issues.push(t('поколение не соответствует выбранному типу вампира'));
    }
    if (clan === THIN_BLOOD_CLAN && generation && parseInt(generation, 10) < 14) {
        issues.push(t('слабокровному нужно выбрать 14–16 поколение'));
    }
    if (clan && clan !== THIN_BLOOD_CLAN && generation && parseInt(generation, 10) >= 14) {
        issues.push(t('14–16 поколение доступно только слабокровным'));
    }

    const attributes = getAllocationCounts('attr');
    if (!allocationMatchesLimits(attributes, ATTR_LIMITS)) {
        issues.push(tf('распредели характеристики строго по схеме {scheme}', { scheme: formatAllocationLimits(ATTR_LIMITS) }));
    }

    if (!skillPackage) {
        issues.push(t('выбери набор навыков'));
    } else {
        const skillLimits = SKILL_PACKAGES[skillPackage];
        const skills = getAllocationCounts('skill');
        if (!allocationMatchesLimits(skills, skillLimits)) {
            issues.push(tf('распредели навыки строго по схеме {scheme}', { scheme: formatAllocationLimits(skillLimits) }));
        }
    }

    if (getSpecialtyCount() > VAMPIRE_SPECIALTY_LIMIT) {
        issues.push(tf('оставь не больше {limit} специализаций', { limit: VAMPIRE_SPECIALTY_LIMIT }));
    }
    if (getPaidCreationMeritPoints() !== getMeritsLimit()) {
        issues.push(tf('распредели ровно {limit} точек преимуществ', { limit: getMeritsLimit() }));
    }
    if (getPaidCreationFlawPoints() !== getFlawsLimit()) {
        issues.push(tf('возьми ровно {limit} точки недостатков', { limit: getFlawsLimit() }));
    }
    if (!isThinBloodClan(clan) && clan && getClanDisciplineDots(clan) !== 3) {
        issues.push(t('выбери две клановые дисциплины: одну на 2 точки и одну на 1'));
    }
    if (baseHumanity < 1 || baseHumanity > 10) issues.push(t('стартовая Человечность должна быть от 1 до 10'));
    if (clampHunger(vitalTrackers.hunger) !== 1) issues.push(t('стартовый Голод должен быть 1'));
    if (getCurrentBloodPotencyValue() !== getCalculatedBloodPotency()) {
        issues.push(t('Сила крови должна соответствовать поколению, типу и типу охоты'));
    }
    if (!validateThinBloodBalance({ silent: true })) {
        issues.push(t('уравновесь слабокровные преимущества и недостатки'));
    }

    return issues;
}

function validatePlayerCreation({ requireFixed = false, silent = false } = {}) {
    if (!isPlayerVampire()) return true;
    if (startingSheetFixed) return true;
    const issues = getPlayerCreationIssues();
    if (requireFixed && !startingSheetFixed) issues.push(t('заверши создание кнопкой «Завершить создание и зафиксировать»'));
    if (issues.length && !silent) {
        alert(tf('Стартовый лист ещё не готов:\n\n• {issues}', { issues: issues.join('\n• ') }));
    }
    return issues.length === 0;
}

function updateCreationRuleControls() {
    const playerVampire = isPlayerVampire();
    const npc = isNpcCharacterType();
    document.body.classList.toggle('strict-player-vampire', playerVampire);
    document.body.classList.toggle('npc-freeform', npc);

    const baseHumanity = document.getElementById('base-humanity');
    if (baseHumanity) {
        Array.from(baseHumanity.options).forEach(option => {
            option.disabled = false;
            option.hidden = false;
        });
    }

    const typeSelect = document.getElementById('type-input');
    if (typeSelect) {
        Array.from(typeSelect.options).forEach(option => {
            const unavailable = playerVampire && ['elder', 'methuselah', 'antediluvian'].includes(option.value);
            option.disabled = unavailable;
            option.hidden = unavailable;
        });
        if (playerVampire && ['elder', 'methuselah', 'antediluvian'].includes(typeSelect.value)) typeSelect.value = '';
    }

    const generationSelect = document.getElementById('generation-input');
    if (generationSelect) {
        Array.from(generationSelect.options).forEach(option => {
            const unavailable = playerVampire && option.value && parseInt(option.value, 10) <= 7;
            option.disabled = unavailable;
            option.hidden = unavailable;
        });
        if (playerVampire && generationSelect.value && parseInt(generationSelect.value, 10) <= 7) {
            generationSelect.value = '';
        }
    }

    const hunger = document.getElementById('initial-hunger');
    if (hunger && playerVampire && !startingSheetFixed) {
        vitalTrackers.hunger = 1;
        hunger.value = '1';
    }
    if (hunger && (!startingSheetFixed || npc)) {
        hunger.disabled = playerVampire;
        hunger.setAttribute('aria-disabled', playerVampire ? 'true' : 'false');
    }

    if (playerVampire && !startingSheetFixed) {
        explicitBloodPotency = null;
        updateBloodPotencyVital();
        renderVitalTracker('hunger');
    }
    const bloodPotency = document.getElementById('val-blood-potency');
    if (bloodPotency && (!startingSheetFixed || npc)) {
        bloodPotency.disabled = playerVampire;
        bloodPotency.setAttribute('aria-disabled', playerVampire ? 'true' : 'false');
    }

    const creationModeNote = document.getElementById('creation-mode-note');
    if (creationModeNote) {
        creationModeNote.textContent = npc
            ? t('Режим НПС: значения свободные, счётчики и карточки работают как рекомендации.')
            : playerVampire
                ? t('Режим игрока: стартовые значения и распределения обязательны; после фиксации изменения идут только за опыт.')
                : t('Режим игрока: счётчики слева помогают собрать стартовый лист.');
    }
}



function getTypeBonuses(type) {
    const byType = {
        childe: { meritsBonus: 0, flawsBonus: 0, humanityMod: 0 },
        neonate: { meritsBonus: 0, flawsBonus: 0, humanityMod: 0 },
        ancilla: { meritsBonus: 2, flawsBonus: 2, humanityMod: -1 },
        elder: { meritsBonus: 0, flawsBonus: 0, humanityMod: -2 },
        methuselah: { meritsBonus: 0, flawsBonus: 0, humanityMod: -3 },
        antediluvian: { meritsBonus: 0, flawsBonus: 0, humanityMod: -4 }
    };

    return byType[type] || { meritsBonus: 0, flawsBonus: 0, humanityMod: 0 };
}

function getMeritsLimit() {
    if ((currentCharType === 'mortal' || currentCharType === 'npc-mortal') && currentMortalTemplate) {
        const tpl = MORTAL_TEMPLATES.find(t => t.id === currentMortalTemplate);
        if (tpl) return tpl.merits;
    }
    const type = document.getElementById('type-input')?.value;
    return 7 + getTypeBonuses(type).meritsBonus;
}

function getFlawsLimit() {
    if ((currentCharType === 'mortal' || currentCharType === 'npc-mortal') && currentMortalTemplate) {
        const tpl = MORTAL_TEMPLATES.find(t => t.id === currentMortalTemplate);
        if (tpl) return tpl.maxFlaws;
    }
    const type = document.getElementById('type-input')?.value;
    return 2 + getTypeBonuses(type).flawsBonus;
}

function getCurrentClan() {
    return document.getElementById('clan-input')?.value?.trim() || '';
}

function isThinBloodClan(clanName = getCurrentClan()) {
    return clanName === THIN_BLOOD_CLAN;
}

function isCaitiffClan(clanName = getCurrentClan()) {
    return clanName === CAITIFF_CLAN;
}

function canUseDiscipline(name, clanName = getCurrentClan()) {
    if (isThinBloodClan(clanName)) return name === THIN_BLOOD_ALCHEMY;
    return name !== THIN_BLOOD_ALCHEMY;
}

function getStandardDisciplineNames(clanName = getCurrentClan()) {
    return Object.keys(RULES.disciplines || {})
        .filter(name => canUseDiscipline(name, clanName))
        .sort();
}

function hasThinBloodAlchemyMerit() {
    return selectedThinBloodMerits.some(item => item.name === vtmName('Алхимик'));
}

function rebuildDisciplineListFromSources() {
    const list = document.getElementById('disciplines-list');
    if (!list) return;

    pruneSelectedPowersForCurrentDisciplines();
    list.innerHTML = '';
    Object.keys(disciplineSources || {}).forEach(name => {
        const total = Object.values(disciplineSources[name]).reduce((a, b) => a + b, 0);
        addDisciplineRow(name, total, Object.keys(disciplineSources[name]).join(' + '));
    });
    renderDisciplines();
    updateDisciplineTotal();
}

function pruneSelectedPowersForCurrentDisciplines() {
    Object.keys(selectedPowers || {}).forEach(name => {
        const dots = Object.values(disciplineSources?.[name] || {})
            .reduce((sum, value) => sum + (parseInt(value, 10) || 0), 0);

        if (dots <= 0) {
            delete selectedPowers[name];
            return;
        }

        if (Array.isArray(selectedPowers[name]) && selectedPowers[name].length > dots) {
            selectedPowers[name] = selectedPowers[name].slice(0, dots);
        }
    });
}

// ==================== ЗАГРУЗКА ДАННЫХ ====================
async function loadRules() {
    const rulesFile = (window.VTM_LANG === 'en') ? 'rules_eng.json' : 'rules.json';
    try {
        const response = await fetch(rulesFile, { cache: 'no-cache' });
        if (!response.ok) throw new Error(rulesFile + ' не найден');

        RULES = await response.json();
        window.VTM_RULES = RULES;

        console.log('✅ RULES успешно загружены из ' + rulesFile);
        console.log('Преимуществ:', Object.keys(RULES.advantages?.merits || {}).length);
        console.log('Недостатков:', Object.keys(RULES.flaws || {}).length);

    } catch (err) {
        console.error('❌ Ошибка загрузки ' + rulesFile + ':', err);
        alert(t('Не удалось загрузить rules.json'));
        return;
    }

    // ←←← ИСПРАВЛЕНИЕ: сначала рендерим, потом заполняем подсказки
    renderAttributes();
    renderSkills();

    await new Promise(r => setTimeout(r, 50)); // маленький таймаут

    preloadAllSkills();
    preloadAllAttributes();

    populateSelects();
}
// ==================== ЗАПУСК ====================

async function initializeApp() {
    try {
        console.log("🚀 Инициализация приложения...");

        await loadRules();
        
        // Ждём, пока RULES загрузятся и DOM готов
        await new Promise(r => setTimeout(r, 100));

       
        renderDisciplines();
        setupEventListeners();
        setupSaveButton();
        setupDiceRollsFromLockedSheet();
        setupSheetLockGuards();
        setupCreationRuleGuards();
        setupExpShopDotEditing();
        setupSheetTabs();
        setupInventoryEditor();
        setupCharacterDetails();
        setupBloodPotencyField();
        renderInventory();

        // Дополнительные настройки
        setupGenerationHint();
        setupExperienceListener();
        updateBloodPotencyAndBonuses();
        updateExperienceBonus();
        applySheetLockState();
        renderThinBloodMeritsFlaws();
        updateExpPurchasedStyles();

        // Инициализация типа персонажа
        const savedType = localStorage.getItem('vtm-char-type') || 'vampire';
        const savedMortalTpl = localStorage.getItem('vtm-mortal-template');
        if (savedMortalTpl) currentMortalTemplate = savedMortalTpl;
        setCharacterSavedState(Boolean(new URLSearchParams(window.location.search).get('characterId')));
        setCharacterType(savedType);
        renderVitalTrackers();
        renderDerivedStatsPanel();
        renderActiveDisciplineEffects();

        // Обновлять морталь-трекер при смене характеристик/навыков
        document.addEventListener('change', function(e) {
            if (e.target?.matches?.('input[name="Выносливость"]')) {
                updateVitals();
                const attributes = {};
                document.querySelectorAll('.dot-input[data-type="attr"]:checked').forEach(input => {
                    if (parseInt(input.value, 10) > 0) attributes[input.name] = parseInt(input.value, 10);
                });
                if (window.autoSaveCharacterPatch && !isApplyingCharacterData) {
                    window.autoSaveCharacterPatch({ ...getVitalAutosavePatch(), attributes });
                }
            }
            if (
                (currentCharType === 'mortal' || currentCharType === 'npc-mortal') &&
                currentMortalTemplate &&
                (e.target.closest('#attributes-grid') || e.target.closest('#skills-grid'))
            ) {
                renderMortalAttrTracker();
            }
        });

        window.__vtmSheetReady = true;
        window.dispatchEvent(new CustomEvent('vtm-sheet-ready'));
        console.log("✅ Приложение полностью инициализировано");
    } catch (err) {
        console.error("❌ Ошибка инициализации:", err);
    }
}

// Один единственный load listener
window.addEventListener('load', initializeApp);

function populateSelects() {
    // === КЛАНЫ ===
    const clanSelect = document.getElementById('clan-input');
    clanSelect.innerHTML = '<option value="">' + t('Выберите клан') + '</option>';

    groupClansBySection(buildClanSelectData()).forEach(group => {
        const optGroup = document.createElement('optgroup');
        optGroup.label = group.title;

        group.clans.forEach(clan => {
            const opt = document.createElement('option');
            opt.value = clan.name;
            opt.textContent = clan.name;
            optGroup.appendChild(opt);
        });

        clanSelect.appendChild(optGroup);
    });

    // === СТИЛИ ОХОТЫ ===
    const predSelect = document.getElementById('predator-input');
    predSelect.innerHTML = '<option value="">' + t('Стиль Охоты') + '</option>';
    
    Object.keys(RULES.predator_types || {}).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        predSelect.appendChild(opt);
    });
}


function renderAttributes() {
    const container = document.getElementById('attributes-grid');
    if (!container) return;
    container.innerHTML = '';

    const categories = {
        "Физические": ["Сила", "Ловкость", "Выносливость"],
        "Социальные": ["Обаяние", "Манипуляция", "Самообладание"],
        "Ментальные": ["Интеллект", "Смекалка", "Упорство"]
    };

    Object.keys(categories).forEach(cat => {
        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `<div class="cat-name">${t(cat)}</div>`;

        categories[cat].forEach(name => {
            let dotsHTML = '';

            // Только точки 1–5 (как у навыков)
            for (let i = 5; i >= 1; i--) {
                dotsHTML += `
                    <input type="radio" id="a-${name}-${i}" name="${name}"
                           value="${i}" class="dot-input" data-type="attr"
                           style="display:none;">
                    <label for="a-${name}-${i}" class="dot-label"
                           data-level="${i}" data-name="${name}"></label>`;
            }

            // Скрытое радио для сброса в 0
            dotsHTML += `
                <input type="radio" id="a-${name}-0" name="${name}" value="0"
                       class="dot-input" data-type="attr" style="display:none;" checked>`;

            col.innerHTML += `
                <div class="row">
                    <span class="attr-name tooltip-trigger" data-attr="${name}">${t(name)}</span>
                    <div class="dots">${dotsHTML}</div>
                </div>`;
        });

        container.appendChild(col);
    });
}

function enforceClanSpecificRules() {
    const clanName = getCurrentClan();

    if (isThinBloodClan(clanName)) {
        Object.keys(disciplineSources || {}).forEach(name => {
            if (name !== THIN_BLOOD_ALCHEMY) {
                delete disciplineSources[name];
                delete selectedPowers[name];
            }
        });
        if (!hasThinBloodAlchemyMerit()) {
            delete disciplineSources[THIN_BLOOD_ALCHEMY];
            delete selectedPowers[THIN_BLOOD_ALCHEMY];
        }
    } else {
        selectedThinBloodMerits = [];
        selectedThinBloodFlaws = [];
        delete disciplineSources[THIN_BLOOD_ALCHEMY];
        delete selectedPowers[THIN_BLOOD_ALCHEMY];
    }

    rebuildDisciplineListFromSources();

    renderThinBloodMeritsFlaws();
}

function renderSkills() {
    const container = document.getElementById('skills-grid');
    if (!container) return;
    container.innerHTML = '';

    const categories = {
        "Физические": ["Атлетика", "Вождение", "Воровство", "Выживание", "Драка", "Ремесло", "Скрытность", "Стрельба", "Фехтование"],
        "Социальные": ["Запугивание", "Исполнение", "Лидерство", "Обращение с животными", "Проницательность", "Убеждение", "Уличное чутьё", "Хитрость", "Этикет"],
        "Ментальные": ["Гуманитарные науки", "Естественные науки", "Медицина", "Наблюдательность", "Оккультизм", "Политика", "Расследование", "Техника", "Финансы"]
    };

    Object.keys(categories).forEach(cat => {
        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `<div class="cat-name">${t(cat)}</div>`;

        categories[cat].forEach(name => {
            let dotsHTML = '';
            for (let i = 5; i >= 1; i--) {
                dotsHTML += `
                    <input type="radio" id="sk-${name}-${i}" name="${name}" value="${i}" class="dot-input" data-type="skill" style="display:none;">
                    <label for="sk-${name}-${i}" class="dot-label" data-level="${i}" data-name="${name}"></label>`;
            }

            dotsHTML += `
                <input type="radio" id="sk-${name}-0" name="${name}" value="0" class="dot-input" data-type="skill" style="display:none;" checked>`;

            col.innerHTML += `
                <div class="row">
                    <div class="label-group">
                        <input type="checkbox" id="s-${name}" class="spec-checkbox" style="display:none;">
                        <label for="s-${name}" class="s-badge">S</label>
                        <span class="skill-name tooltip-trigger" data-skill="${name}">${t(name)}</span>
                    </div>
                    <div class="dots">${dotsHTML}</div>
                </div>
                <div id="specs-${name}" class="skill-specs"></div>`;
        });

        container.appendChild(col);
    });

    // Инициализация состояния S-бейджей после рендера
    setTimeout(() => {
        document.querySelectorAll('.skill-name').forEach(el => {
            const skillName = el.getAttribute('data-skill') || el.textContent.trim();
            if (skillName) updateSBadgeState(skillName);
        });
    }, 150);
}




// ==================== ОБНОВЛЕНИЕ ВИТАЛОВ + ПОДСКАЗКИ ====================
const VITAL_TRACKER_CONFIG = {
    health: { valueId: 'val-hp', trackId: 'track-health', captionId: 'track-health-caption', label: 'Здоровье' },
    willpower: { valueId: 'val-wp', trackId: 'track-willpower', captionId: 'track-willpower-caption', label: 'Сила воли' },
    humanity: { valueId: 'val-humanity', trackId: 'track-humanity', captionId: 'track-humanity-caption', label: 'Человечность', max: 10 },
    hunger: { valueId: 'val-hunger', trackId: 'track-hunger', captionId: 'track-hunger-caption', label: 'Голод', max: 5, displayCurrent: true }
};

let vitalTrackers = { health: { superficial: 0, aggravated: 0, bonusMax: 0, maxOverride: null }, willpower: { superficial: 0, aggravated: 0 }, humanity: 0, hunger: 0 };
let humanityState = { value: 7, stains: 0, stainEvents: [], lastRemorseCheckAt: null, lastHumanityLossAt: null };
let damageProfile = 'vampire';
let characterPhysicalState = 'healthy';
let healthState = {};

const WILLPOWER_IMPAIRED_ATTRIBUTES = ['Обаяние', 'Манипуляция', 'Самообладание', 'Интеллект', 'Смекалка', 'Упорство'];
const HEALTH_IMPAIRED_ATTRIBUTES = ['Сила', 'Ловкость', 'Выносливость'];

function resolveCharacterSheetFixed(data = {}) {
    if (typeof data.sheetFixed === 'boolean') return data.sheetFixed;
    if (typeof data.sheetLock?.fixed === 'boolean') return data.sheetLock.fixed;
    if (typeof data.creationCompleted === 'boolean') return data.creationCompleted;
    return true;
}

function getVitalMax(key) {
    const config = VITAL_TRACKER_CONFIG[key];
    if (!config) return 0;
    if (Number.isFinite(config.max)) return config.max;
    return Math.max(0, parseInt(document.getElementById(config.valueId)?.textContent || '0', 10) || 0);
}

function normalizeWillpowerTracker(value, max = getVitalMax('willpower')) {
    const safeMax = Math.max(0, parseInt(max, 10) || 0);
    if (typeof value === 'number') {
        const current = Math.max(0, Math.min(safeMax, parseInt(value, 10) || 0));
        return { superficial: safeMax - current, aggravated: 0 };
    }
    if (value && typeof value === 'object') {
        const aggravated = Math.max(0, Math.min(safeMax, parseInt(value.aggravated || 0, 10) || 0));
        const superficial = Math.max(0, Math.min(Math.max(0, safeMax - aggravated), parseInt(value.superficial || 0, 10) || 0));
        return { superficial, aggravated };
    }
    return { superficial: 0, aggravated: 0 };
}

function getWillpowerTracker(max = getVitalMax('willpower')) {
    const tracker = normalizeWillpowerTracker(vitalTrackers.willpower, max);
    vitalTrackers.willpower = tracker;
    return tracker;
}

function normalizeCharacterType(value) {
    if (value === 'mortal' || value === 'npc-mortal' || value === 'npc-ghost') return 'mortal';
    if (value === 'ghoul') return 'ghoul';
    if (value === 'thinblood') return 'thinblood';
    return 'vampire';
}

function getCharacterType(characterData = {}) {
    return normalizeCharacterType(
        characterData.characterType ||
        characterData.creatureType ||
        characterData.kind ||
        'vampire'
    );
}

function getDefaultDamageProfile(characterType) {
    switch (normalizeCharacterType(characterType)) {
        case 'mortal':
        case 'ghoul':
            return 'mortal';
        case 'thinblood':
            return 'thinblood';
        case 'vampire':
        default:
            return 'vampire';
    }
}

function getCurrentCharacterType() {
    if (normalizeCharacterType(currentCharType) === 'vampire' && isThinBloodClan()) {
        return 'thinblood';
    }
    return normalizeCharacterType(currentCharType);
}

function getSheetDamageProfile() {
    damageProfile = window.VTMHealth.normalizeDamageProfile(
        damageProfile || getDefaultDamageProfile(getCurrentCharacterType())
    );
    return damageProfile;
}

function getHealthTracker() {
    const stamina = getCurrentAttributeDotsForDerived('Выносливость');
    const sourceHealth = isFullSheetObject(vitalTrackers.health)
        ? vitalTrackers.health
        : { superficial: 0, aggravated: 0, bonusMax: 0, maxOverride: null };
    const derived = getFullSheetDerivedStats();
    const tracker = window.VTMHealth.normalizeHealthTracker({
        superficial: sourceHealth.superficial,
        aggravated: sourceHealth.aggravated,
        bonusMax: Math.max(0, derived.health.totalMax - stamina - 3),
        maxOverride: derived.health.totalMax
    }, stamina, getSheetDamageProfile());
    vitalTrackers.health = {
        superficial: tracker.superficial,
        aggravated: tracker.aggravated,
        bonusMax: Math.max(0, parseInt(sourceHealth.bonusMax || 0, 10) || 0),
        maxOverride: sourceHealth.maxOverride === null || sourceHealth.maxOverride === undefined
            ? null
            : Math.max(0, parseInt(sourceHealth.maxOverride, 10) || 0)
    };
    characterPhysicalState = tracker.physicalState;
    return tracker;
}

function getHealthMetaState(state = getHealthTracker()) {
    return {
        max: state.max,
        superficial: state.superficial,
        aggravated: state.aggravated,
        current: state.current,
        impaired: state.impaired,
        physicalState: state.physicalState
    };
}

function getWillpowerState(max = getVitalMax('willpower')) {
    const tracker = getWillpowerTracker(max);
    const current = Math.max(0, max - tracker.superficial - tracker.aggravated);
    return {
        ...tracker,
        max,
        current,
        impaired: max > 0 && current <= 0
    };
}

function getWillpowerMetaState(state = getWillpowerState()) {
    return {
        max: state.max,
        superficial: state.superficial,
        aggravated: state.aggravated,
        current: state.current
    };
}

function getWillpowerRecoveryPool() {
    const composureInput = document.querySelector('input[name="Самообладание"]:checked');
    const resolveInput = document.querySelector('input[name="Упорство"]:checked');
    const composure = composureInput ? parseInt(composureInput.value, 10) || 0 : 0;
    const resolve = resolveInput ? parseInt(resolveInput.value, 10) || 0 : 0;
    return Math.max(composure, resolve);
}

function getVitalTrackerData() {
    const health = getHealthTracker();
    const willpower = getWillpowerTracker();
    return {
        health: {
            superficial: health.superficial,
            aggravated: health.aggravated,
            bonusMax: health.bonusMax,
            maxOverride: health.maxOverride
        },
        willpower: {
            superficial: willpower.superficial,
            aggravated: willpower.aggravated
        },
        humanity: getHumanityState().value,
        hunger: Math.max(0, Math.min(getVitalMax('hunger'), parseInt(vitalTrackers.hunger || 0, 10) || 0))
    };
}

function getVitalTrackerSummary(key) {
    const max = getVitalMax(key);
    if (key === 'health') {
        const state = getHealthTracker();
        return tf('{max} (доступно {current}/{max}; / {superficial}, X {aggravated})', state);
    }
    if (key === 'willpower') {
        const state = getWillpowerState(max);
        return tf('{max} (доступно {current}/{max}; / {superficial}, X {aggravated})', state);
    }
    const current = getVitalTrackerData()[key] || 0;
    return tf('{max} (закрашено {current}/{max})', { max, current });
}

function normalizeVitalTrackerData(data = {}) {
    const sourceHealth = data && Object.prototype.hasOwnProperty.call(data, 'health')
        ? data.health
        : { superficial: 0, aggravated: 0, bonusMax: 0, maxOverride: null };
    const sourceWillpower = data && Object.prototype.hasOwnProperty.call(data, 'willpower')
        ? data.willpower
        : { superficial: 0, aggravated: 0 };
    return {
        health: sourceHealth && typeof sourceHealth === 'object'
            ? {
                superficial: Math.max(0, parseInt(sourceHealth.superficial || 0, 10) || 0),
                aggravated: Math.max(0, parseInt(sourceHealth.aggravated || 0, 10) || 0),
                bonusMax: Math.max(0, parseInt(sourceHealth.bonusMax || 0, 10) || 0),
                maxOverride: sourceHealth.maxOverride === null || sourceHealth.maxOverride === undefined
                    ? null
                    : Math.max(0, parseInt(sourceHealth.maxOverride, 10) || 0)
            }
            : Math.max(0, parseInt(sourceHealth || 0, 10) || 0),
        willpower: sourceWillpower && typeof sourceWillpower === 'object'
            ? {
                superficial: Math.max(0, parseInt(sourceWillpower.superficial || 0, 10) || 0),
                aggravated: Math.max(0, parseInt(sourceWillpower.aggravated || 0, 10) || 0)
            }
            : Math.max(0, parseInt(sourceWillpower || 0, 10) || 0),
        humanity: Math.max(0, parseInt(data.humanity || 0, 10) || 0),
        hunger: Math.max(0, parseInt(data.hunger || 0, 10) || 0)
    };
}

function clampHunger(value) {
    return Math.max(0, Math.min(5, parseInt(value, 10) || 0));
}

function clampBloodPotency(value) {
    return Math.max(0, Math.min(10, parseInt(value, 10) || 0));
}

function getCalculatedBloodPotency() {
    const predatorName = document.getElementById('predator-input')?.value || '';
    const base = getCurrentBloodPotencyEstimate();
    const predBonus = predatorName && RULES?.predator_types?.[predatorName]
        ? Number(RULES.predator_types[predatorName].blood_potency || 0)
        : 0;
    return clampBloodPotency(base + predBonus);
}

function getCurrentBloodPotencyValue() {
    const el = document.getElementById('val-blood-potency');
    if (el && 'value' in el) return clampBloodPotency(el.value);
    return clampBloodPotency(el?.textContent || getCalculatedBloodPotency());
}

function getBloodSurgeBonus(bloodPotency = getCurrentBloodPotencyValue()) {
    const bp = clampBloodPotency(bloodPotency);
    if (bp <= 0) return 1;
    if (bp <= 2) return 2;
    if (bp <= 4) return 3;
    if (bp <= 6) return 4;
    if (bp <= 8) return 5;
    return 6;
}

function getVitalAutosavePatch() {
    const health = getHealthTracker();
    const baseHumanity = parseInt(document.getElementById('base-humanity')?.value || '7', 10) || 7;
    const humanity = getHumanityState();
    return {
        vitalTrackers: getVitalTrackerData(),
        characterType: getCurrentCharacterType(),
        bloodPotency: getCurrentBloodPotencyValue(),
        damageProfile: getSheetDamageProfile(),
        baseHumanity: String(baseHumanity),
        humanity: { ...humanity, base: baseHumanity },
        morality: getMoralityData(),
        touchstones: getTouchstonesSnapshot(),
        status: {
            physicalState: health.physicalState,
            humanityState: humanity.value <= 0 ? 'lost_to_beast' : null
        },
        healthState: { ...healthState }
    };
}

function autoSaveVitalState({ immediate = false } = {}) {
    if (isApplyingCharacterData) return;
    if (!window.autoSaveCharacterDataPatch) return;
    const run = () => window.autoSaveCharacterDataPatch(getVitalAutosavePatch(), { immediate, silent: true });

    if (vitalAutoSaveTimeout) {
        clearTimeout(vitalAutoSaveTimeout);
        vitalAutoSaveTimeout = null;
    }

    if (immediate) {
        return run();
    }

    vitalAutoSaveTimeout = setTimeout(run, 650);
}

function getHumanityState(characterData = null) {
    if (characterData) return window.VTMHumanity.getHumanityState(characterData);
    humanityState = window.VTMHumanity.getHumanityState({ humanity: humanityState });
    vitalTrackers.humanity = humanityState.value;
    return humanityState;
}

function getMoralityData() {
    const normalized = window.VTMHumanity.normalizeMorality(moralityState);
    const legacyTouchstones = (touchstones || []).flatMap((item, index) => {
        item = normalizeTouchstoneItem(item, index);
        const hasContent = [item.name, item.principle, item.description].some(value => String(value || '').trim());
        if (!hasContent) return [];
        const name = getTouchstoneLabel(item, index);
        return [{
            id: item.id || `touchstone-${index}`,
            name,
            description: getTouchstoneDescription(item),
            status: ['safe', 'threatened', 'harmed', 'lost'].includes(item.status) ? item.status : 'safe'
        }];
    });
    const byId = new Map(normalized.touchstones.map(item => [item.id, item]));
    legacyTouchstones.forEach(item => byId.set(item.id, { ...(byId.get(item.id) || {}), ...item }));
    moralityState = { ...normalized, touchstones: Array.from(byId.values()) };
    return JSON.parse(JSON.stringify(moralityState));
}

function setHumanityNotice(text = '', kind = '') {
    const notice = document.getElementById('humanity-notice');
    if (!notice) return;
    notice.textContent = text;
    notice.dataset.kind = kind;
    notice.hidden = !text;
}

function getHumanityWarning(state = getHumanityState()) {
    const warning = window.VTMHumanity.getHumanityWarning(state);
    return warning ? t(warning) : '';
}

function renderHumanityEvents() {
    const container = document.getElementById('humanity-stain-events');
    if (!container) return;
    const events = [...(getHumanityState().stainEvents || [])].reverse().slice(0, 8);
    container.innerHTML = events.length
        ? events.map(event => {
            const date = event.createdAt ? new Date(event.createdAt).toLocaleString('ru-RU') : '';
            const amount = event.amount > 0 ? `+${event.amount}` : t('лимит');
            const details = [event.reasonText, event.mitigatedByConviction ? t('смягчено Убеждением') : ''].filter(Boolean).join(' · ');
            return `<li><strong>${amount}</strong> ${escapeHTML(event.reason || t('Сомнение'))}${details ? `<small>${escapeHTML(details)}</small>` : ''}${date ? `<time>${escapeHTML(date)}</time>` : ''}</li>`;
        }).join('')
        : `<li class="humanity-events-empty">${t('Сомнений пока не записано.')}</li>`;
}

function updateHumanityFormOptions() {
    const morality = getMoralityData();
    const convictionSelect = document.getElementById('humanity-event-conviction');
    const touchstoneSelect = document.getElementById('humanity-event-touchstone');
    if (convictionSelect) {
        const selected = convictionSelect.value;
        convictionSelect.innerHTML = `<option value="">${t('— Убеждение не выбрано —')}</option>${morality.convictions.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.text)}</option>`).join('')}`;
        convictionSelect.value = morality.convictions.some(item => item.id === selected) ? selected : '';
    }
    if (touchstoneSelect) {
        const selected = touchstoneSelect.value;
        touchstoneSelect.innerHTML = `<option value="">${t('— Опора не выбрана —')}</option>${morality.touchstones.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}${item.status && item.status !== 'safe' ? ` · ${escapeHTML(item.status)}` : ''}</option>`).join('')}`;
        touchstoneSelect.value = morality.touchstones.some(item => item.id === selected) ? selected : '';
    }
    const tenets = document.getElementById('morality-tenets-input');
    const convictions = document.getElementById('morality-convictions-input');
    if (tenets && document.activeElement !== tenets) tenets.value = morality.chronicleTenets.join('\n');
    if (convictions && document.activeElement !== convictions) convictions.value = morality.convictions.map(item => item.text).join('\n');
}

function syncMoralityEditor() {
    const tenets = document.getElementById('morality-tenets-input')?.value || '';
    const convictionLines = (document.getElementById('morality-convictions-input')?.value || '')
        .split('\n')
        .map(value => value.trim())
        .filter(Boolean);
    const current = getMoralityData();
    moralityState = {
        ...current,
        chronicleTenets: tenets.split('\n').map(value => value.trim()).filter(Boolean),
        convictions: convictionLines.map((text, index) => ({
            id: current.convictions[index]?.id || `conviction-${Date.now()}-${index}`,
            text,
            touchstoneId: current.convictions[index]?.touchstoneId
        }))
    };
    updateHumanityFormOptions();
    autoSaveVitalState();
}

async function saveHumanityState({ immediate = true } = {}) {
    return autoSaveVitalState({ immediate });
}

function publishHumanityEvent(poolName, meta = {}) {
    const roll = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        room: getDiceRoom(),
        characterName: document.getElementById('char-name')?.value?.trim() || t('Безымянный'),
        poolName,
        poolType: 'humanity-event',
        diceCount: 0,
        dice: [],
        successes: 0,
        createdAt: new Date().toISOString(),
        meta: {
            source: 'humanity',
            hungerDice: 0,
            rollKind: 'humanity_check',
            ...meta
        }
    };
    return publishDiceRoll(roll);
}

async function addHumanityStains(character, amount, reason, options = {}) {
    if (!isCharacterSheetFixed()) return null;
    const source = options.source || 'manual';
    const result = window.VTMHumanity.addStains(
        { humanity: getHumanityState() },
        amount,
        reason || window.VTMHumanity.SOURCE_LABELS[source] || t('ручное решение'),
        { ...options, source }
    );
    humanityState = result.humanity;
    renderVitalTracker('humanity');
    await saveHumanityState({ immediate: true });

    const state = getHumanityState();
    const sourceText = result.event.reasonText || result.event.reason;
    const historyText = tf('{name} получает {applied} Сомнение: {sourceText}. Человечность: {value}, Сомнения: {stains}/{remaining}.', {
        name: document.getElementById('char-name')?.value?.trim() || t('Персонаж'),
        applied: result.applied,
        sourceText,
        value: state.value,
        stains: state.stains,
        remaining: 10 - state.value,
    });
    await publishHumanityEvent(historyText, {
        humanityBefore: result.before.value,
        humanityAfter: state.value,
        stainsBefore: result.before.stains,
        stainsAfter: state.stains,
        stainEvents: [result.event],
        warnings: result.warning ? [result.warning] : []
    });
    setHumanityNotice(result.warning || tf('Добавлено Сомнений: {amount}.', { amount: result.applied }), result.warning ? 'warning' : 'success');
    return result;
}

async function removeHumanityStains(amount = 1) {
    if (!isCharacterSheetFixed()) return;
    const before = getHumanityState();
    const removed = Math.min(before.stains, Math.max(0, Math.floor(Number(amount) || 0)));
    if (!removed) {
        setHumanityNotice(t('Сомнений для снятия нет.'), 'neutral');
        return;
    }
    humanityState = { ...before, stains: before.stains - removed };
    renderVitalTracker('humanity');
    await saveHumanityState({ immediate: true });
    setHumanityNotice(tf('Снято Сомнений: {amount}.', { amount: removed }), 'success');
}

async function clearHumanityStains() {
    if (!isCharacterSheetFixed()) return;
    const before = getHumanityState();
    if (!before.stains) {
        setHumanityNotice(t('Сомнений для очистки нет.'), 'neutral');
        return;
    }
    if (!confirm(tf('Очистить все Сомнения ({stains})?', { stains: before.stains }))) return;
    humanityState = { ...before, stains: 0 };
    renderVitalTracker('humanity');
    await saveHumanityState({ immediate: true });
    setHumanityNotice(tf('Сомнения очищены: {stains} → 0.', { stains: before.stains }), 'success');
}

async function performRemorseCheck(character = null, options = {}) {
    if (!isCharacterSheetFixed()) return null;
    const before = getHumanityState();
    if (before.stains <= 0) {
        setHumanityNotice(t('Нет Сомнений для проверки.'), 'neutral');
        return null;
    }

    const remorseDice = window.VTMHumanity.getRemorseDice(before);
    const dice = remorseDice <= 0 ? [] : rollD10Pool(remorseDice, 0);
    const resolution = window.VTMHumanity.applyRemorseCheckResult(before, {
        remorseDice,
        diceValues: dice.map(die => die.value)
    });
    const { automaticFailure, successes, success, humanityAfter: valueAfter, nextState } = resolution;
    const now = nextState.lastRemorseCheckAt;
    humanityState = nextState;
    vitalTrackers.humanity = valueAfter;
    renderVitalTracker('humanity');
    await saveHumanityState({ immediate: true });

    const lostToBeast = valueAfter <= 0;
    const poolName = automaticFailure
        ? tf('Проверка мук совести: свободных ячеек нет. Результат: автоматический провал. Человечность: {before} → {after}. Сомнения очищены.', { before: before.value, after: valueAfter })
        : success
            ? tf('Проверка мук совести: {dice}d10. Результат: успех. Человечность остаётся {after}. Сомнения очищены: {stains} → 0.', { dice: remorseDice, after: valueAfter, stains: before.stains })
            : tf('Проверка мук совести: {dice}d10. Результат: провал. Человечность: {before} → {after}. Сомнения очищены: {stains} → 0.', { dice: remorseDice, before: before.value, after: valueAfter, stains: before.stains });
    const warnings = [
        t('Проверка мук совести не использует кубики Голода, Прилив Крови и переброс Воли.'),
        ...(lostToBeast ? [t('Человечность 0: персонаж окончательно уступает Зверю и переходит под контроль Рассказчика.')] : [])
    ];
    const roll = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        room: getDiceRoom(),
        characterName: document.getElementById('char-name')?.value?.trim() || t('Безымянный'),
        poolName,
        poolType: 'remorse-check',
        diceCount: dice.length,
        dice,
        successes,
        createdAt: now,
        meta: {
            source: 'humanity',
            rollKind: 'remorse_check',
            hungerDice: 0,
            humanityBefore: before.value,
            humanityAfter: valueAfter,
            stainsBefore: before.stains,
            stainsAfter: 0,
            remorseDice,
            automaticFailure,
            humanityLost: !success,
            stainEvents: before.stainEvents || [],
            warnings
        }
    };
    await publishDiceRoll(roll);

    const modal = getDiceRollModal();
    modal.querySelector('#dice-roll-title').textContent = t('Проверка мук совести');
    modal.querySelector('#dice-roll-subtitle').textContent = automaticFailure
        ? t('Свободных ячеек не осталось: автоматический провал.')
        : t('Обычные d10, успех на 6+. Кубики Голода и переброс Воли не используются.');
    modal.querySelector('#dice-roll-result').innerHTML = renderDicePreview(dice, successes, roll.meta);
    modal.style.display = 'flex';
    setHumanityNotice(lostToBeast ? warnings[1] : success ? t('Раскаяние удерживает Человечность. Сомнения очищены.') : t('Проверка провалена: потеряна 1 Человечность, Сомнения очищены.'), lostToBeast || !success ? 'danger' : 'success');
    return { roll, success, automaticFailure, before, after: getHumanityState() };
}

async function submitHumanityEvent(event) {
    event?.preventDefault?.();
    if (!isCharacterSheetFixed()) return;
    const type = document.getElementById('humanity-event-type')?.value || 'storyteller';
    const amountSelect = document.getElementById('humanity-event-amount')?.value || '1';
    const customAmount = document.getElementById('humanity-event-custom-amount')?.value || '1';
    const amount = amountSelect === 'custom' ? parseInt(customAmount, 10) || 0 : parseInt(amountSelect, 10) || 0;
    const reasonText = document.getElementById('humanity-event-reason')?.value?.trim() || '';
    const sourceMap = {
        chronicle_tenet_violation: 'chronicle_tenet_violation',
        conviction_violation: 'conviction_violation',
        touchstone_harmed: 'touchstone_harmed',
        diablerie: 'diablerie',
        cruelty: 'storyteller',
        discipline_risk: 'discipline_risk',
        predator_type_flaw: 'predator_type_flaw',
        storyteller: 'storyteller'
    };
    const source = sourceMap[type] || 'storyteller';
    const result = await addHumanityStains(null, amount, window.VTMHumanity.SOURCE_LABELS[source], {
        source,
        reasonText,
        mitigatedByConviction: Boolean(document.getElementById('humanity-event-mitigated')?.checked),
        relatedConvictionId: document.getElementById('humanity-event-conviction')?.value || undefined,
        relatedTouchstoneId: document.getElementById('humanity-event-touchstone')?.value || undefined
    });
    if (result?.applied > 0) {
        const reasonInput = document.getElementById('humanity-event-reason');
        if (reasonInput) reasonInput.value = '';
    }
}

function updateHumanityEventAmountControl() {
    const custom = document.getElementById('humanity-event-custom-amount');
    if (!custom) return;
    custom.hidden = document.getElementById('humanity-event-amount')?.value !== 'custom';
}

function renderVitalTracker(key) {
    const config = VITAL_TRACKER_CONFIG[key];
    if (!config) return;
    const track = document.getElementById(config.trackId);
    const caption = document.getElementById(config.captionId);
    if (!track) return;

    const max = getVitalMax(key);
    if (key === 'humanity') {
        const state = getHumanityState();
        const valueEl = document.getElementById('val-humanity');
        const gameValueEl = document.getElementById('val-humanity-game');
        if (valueEl) valueEl.textContent = state.value;
        if (gameValueEl) gameValueEl.textContent = state.value;
        track.innerHTML = '';
        for (let index = 1; index <= 10; index++) {
            const status = index <= state.value
                ? 'humanity-filled'
                : index <= state.value + state.stains
                    ? 'stain'
                    : 'empty';
            const cell = document.createElement('span');
            cell.className = `vital-box vital-humanity ${status}`;
            cell.setAttribute('aria-label', tf('Человечность: клетка {index} из 10, {status}', { index, status: status === 'humanity-filled' ? t('Человечность') : status === 'stain' ? t('Сомнение') : t('свободно') }));
            cell.title = status === 'humanity-filled' ? t('Человечность') : status === 'stain' ? t('Сомнение') : t('Свободная клетка');
            track.appendChild(cell);
        }
        const freeBoxes = Math.max(0, 10 - state.value - state.stains);
        if (caption) caption.textContent = tf('Человечность {value} · Сомнения {stains}/{remaining} · свободно {free}', { value: state.value, stains: state.stains, remaining: 10 - state.value, free: freeBoxes });
        const remorseButton = document.getElementById('humanity-remorse-btn');
        if (remorseButton) {
            remorseButton.disabled = state.stains <= 0;
            remorseButton.title = state.stains <= 0 ? t('Нет Сомнений для проверки.') : tf('Пул: {dice}к10', { dice: window.VTMHumanity.getRemorseDice(state) });
        }
        const warning = getHumanityWarning(state);
        const warningEl = document.getElementById('humanity-risk-warning');
        if (warningEl) {
            warningEl.textContent = warning;
            warningEl.hidden = !warning;
        }
        renderHumanityEvents();
        updateHumanityFormOptions();
        return;
    }
    if (key === 'health') {
        const state = getHealthTracker();
        const valueEl = document.getElementById(config.valueId);
        if (valueEl) {
            valueEl.textContent = state.max;
            valueEl.setAttribute('data-tooltip', tf('Здоровье: доступно {current} из {max}', state));
        }
        const gameValueEl = document.getElementById('val-hp-game');
        if (gameValueEl) gameValueEl.textContent = state.max;
        track.innerHTML = '';
        for (let index = 1; index <= state.max; index++) {
            const status = index <= state.aggravated
                ? 'aggravated'
                : index <= state.aggravated + state.superficial
                    ? 'superficial'
                    : 'empty';
            const cell = document.createElement('span');
            cell.className = `vital-box vital-health hp-${status}`;
            cell.textContent = status === 'aggravated' ? 'X' : status === 'superficial' ? '/' : '';
            cell.setAttribute('aria-label', tf('Здоровье: клетка {index} из {max}, {status}', { index, max: state.max, status: status === 'aggravated' ? t('тяжёлое повреждение') : status === 'superficial' ? t('лёгкое повреждение') : t('пусто') }));
            track.appendChild(cell);
        }
        if (caption) caption.textContent = tf('Доступно {current} / {max} · / {superficial} · X {aggravated}{impairedNote}', { ...state, impairedNote: state.impaired ? t(' · -2к10') : '' });
        const note = document.getElementById('health-state-note');
        if (note) note.textContent = window.VTMHealth.warningFor(state, getSheetDamageProfile());
        return;
    }
    if (key === 'willpower') {
        const state = getWillpowerState(max);
        const gameValueEl = document.getElementById('val-wp-game');
        if (gameValueEl) gameValueEl.textContent = state.max;
        track.innerHTML = '';
        for (let index = 1; index <= max; index++) {
            const status = index <= state.aggravated
                ? 'aggravated'
                : index <= state.aggravated + state.superficial
                    ? 'superficial'
                    : 'empty';
            const cell = document.createElement('span');
            cell.className = `vital-box vital-willpower wp-${status}`;
            cell.textContent = status === 'aggravated' ? 'X' : status === 'superficial' ? '/' : '';
            cell.setAttribute('aria-label', tf('Сила воли: клетка {index} из {max}, {status}', { index, max, status: status === 'aggravated' ? t('тяжёлый стресс') : status === 'superficial' ? t('поверхностный стресс') : t('пусто') }));
            track.appendChild(cell);
        }
        if (caption) {
            caption.textContent = tf('Доступно {current} / {max} · / {superficial} · X {aggravated}{impairedNote}', { ...state, impairedNote: state.impaired ? ' · -2' : '' });
        }
        return;
    }

    const current = Math.max(0, Math.min(max, parseInt(vitalTrackers[key] || 0, 10) || 0));
    vitalTrackers[key] = current;
    if (key === 'hunger') {
        const initialHunger = document.getElementById('initial-hunger');
        if (initialHunger) initialHunger.value = String(current);
    }
    if (config.displayCurrent) {
        const valueEl = document.getElementById(config.valueId);
        if (valueEl) {
            valueEl.textContent = current;
            valueEl.setAttribute('data-tooltip', tf('{label} = {current} из {max}', { label: t(config.label), current, max }));
        }
        const gameValueEl = document.getElementById(`${config.valueId}-game`);
        if (gameValueEl) gameValueEl.textContent = current;
    }

    track.innerHTML = '';
    for (let index = 1; index <= max; index++) {
        const cell = document.createElement('span');
        cell.className = `vital-box vital-${key}${index <= current ? ' filled' : ''}`;
        cell.setAttribute('aria-label', tf('{label}: {index} из {max}', { label: t(config.label), index, max }));
        cell.title = `${t(config.label)}: ${index} / ${max}`;
        track.appendChild(cell);
    }
    if (caption) caption.textContent = `${current} / ${max}`;
}

function renderVitalTrackers() {
    Object.keys(VITAL_TRACKER_CONFIG).forEach(renderVitalTracker);
    updateCreationSummaryFormulas();
    updateVitalProfileVisibility();
    updateCreationVsGameVitalsVisibility();
}

function setVitalTrackerValue(key, value) {
    if (!isCharacterSheetFixed()) return;
    if (key === 'health') {
        cycleHealthCell(value);
        return;
    }
    if (key === 'willpower') {
        cycleWillpowerCell(value);
        return;
    }
    const max = getVitalMax(key);
    const next = vitalTrackers[key] === value ? value - 1 : value;
    vitalTrackers[key] = Math.max(0, Math.min(max, next));
    renderVitalTracker(key);
    if (key === 'hunger') autoSaveVitalState();
}

function quenchHunger(amount = 1) {
  if (!isCharacterSheetFixed()) return;
  const current = clampHunger(vitalTrackers.hunger || 0);
  const delta = Math.max(1, Math.floor(Number(amount) || 1));
  const next = Math.max(0, Math.min(5, current - delta));
  if (next === current) return;
  vitalTrackers.hunger = next;
  renderVitalTracker('hunger');
  autoSaveVitalState();
}

function setHealthTracker(nextTracker, { autosave = true, immediate = true, publish = false, reason = t('Здоровье обновлено'), before = null, meta = {} } = {}) {
    vitalTrackers.health = {
        superficial: nextTracker.superficial,
        aggravated: nextTracker.aggravated,
        bonusMax: nextTracker.bonusMax || 0,
        maxOverride: nextTracker.maxOverride ?? null
    };
    const after = getHealthTracker();
    characterPhysicalState = after.physicalState;
    renderVitalTracker('health');
    if (autosave) autoSaveVitalState({ immediate });
    if (publish) publishHealthEvent(reason, before || after, after, meta);
    return after;
}

function getHealthCellStatuses(state = getHealthTracker()) {
    return Array.from({ length: state.max }, (_, index) => {
        const cell = index + 1;
        if (cell <= state.aggravated) return 'aggravated';
        if (cell <= state.aggravated + state.superficial) return 'superficial';
        return 'empty';
    });
}

function cycleHealthCell(index) {
    if (!isCharacterSheetFixed()) return;
    const before = getHealthTracker();
    const statuses = getHealthCellStatuses(before);
    const current = statuses[index - 1] || 'empty';
    statuses[index - 1] = current === 'empty' ? 'superficial' : current === 'superficial' ? 'aggravated' : 'empty';
    const next = {
        superficial: statuses.filter(status => status === 'superficial').length,
        aggravated: statuses.filter(status => status === 'aggravated').length,
        bonusMax: before.bonusMax,
        maxOverride: before.maxOverride
    };
    setHealthTracker(next, { immediate: false });
}

function publishHealthEvent(reason, beforeState, afterState, meta = {}) {
    if (typeof publishDiceRoll !== 'function') return;
    const roll = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        room: getDiceRoom(),
        characterName: document.getElementById('char-name')?.value?.trim() || t('Безымянный'),
        poolName: reason,
        poolType: 'health',
        diceCount: 0,
        dice: [],
        successes: 0,
        createdAt: new Date().toISOString(),
        meta: {
            source: 'health',
            healthBefore: getHealthMetaState(beforeState),
            healthAfter: getHealthMetaState(afterState),
            healthImpaired: afterState.impaired,
            physicalState: afterState.physicalState,
            warnings: meta.warnings || [],
            damage: meta.damage,
            healing: meta.healing,
            rouseChecks: meta.rouseChecks,
            hungerBefore: meta.hungerBefore,
            hungerAfter: meta.hungerAfter
        }
    };
    publishDiceRoll(roll);
}

function applySheetHealthDamage(amount, severity, options = {}) {
    const before = getHealthTracker();
    const result = window.VTMHealth.applyHealthDamage(before, amount, severity, options, getSheetDamageProfile());
    const after = setHealthTracker(result.tracker, {
        before,
        publish: true,
        reason: t('Урон здоровью'),
        meta: {
            warnings: result.warnings,
            damage: {
                source: options.source || 'manual',
                originalAmount: result.originalAmount,
                finalAmount: result.finalAmount,
                severity,
                halved: result.halved,
                weaponModifier: options.weaponModifier,
                margin: options.margin
            }
        }
    });
    return { ...result, after };
}

function adjustSheetHealthDamage(severity, delta) {
    if (!isCharacterSheetFixed()) return;
    const before = getHealthTracker();
    if (delta > 0) {
        applySheetHealthDamage(delta, severity, { source: 'manual', ignoreHalving: true });
        return;
    }
    const result = window.VTMHealth.recoverHealthDamage(before, Math.abs(delta), severity, getSheetDamageProfile());
    setHealthTracker(result.tracker, {
        before,
        publish: result.recovered > 0,
        reason: t('Ручное лечение здоровья'),
        meta: {
            healing: {
                type: 'manual',
                amountSuperficial: severity === 'superficial' ? result.recovered : 0,
                amountAggravated: severity === 'aggravated' ? result.recovered : 0
            }
        }
    });
}

function openSheetHealthDamagePrompt() {
    if (!isCharacterSheetFixed()) return;
    const amount = parseInt(prompt(t('Сколько урона нанести?'), '1') || '0', 10);
    if (!amount || amount < 1) return;
    const aggravated = confirm(t('Нанести тяжёлый урон? Нажмите «Отмена» для лёгкого.'));
    const severity = aggravated ? 'aggravated' : 'superficial';
    const ignoreHalving = severity === 'superficial'
        ? !confirm(t('Делить лёгкий урон пополам с округлением вверх?'))
        : true;
    const note = prompt(t('Комментарий к урону (необязательно):'), '') || '';
    applySheetHealthDamage(amount, severity, {
        source: 'manual',
        ignoreHalving,
        notes: note ? [note] : []
    });
}

async function mendSheetVampireSuperficial() {
    if (!isCharacterSheetFixed()) return;
    if (getSheetDamageProfile() !== 'vampire' && getSheetDamageProfile() !== 'thinblood') {
        alert(t('Это лечение предназначено для вампиров. Для смертного используйте восстановление в начале встречи.'));
        return;
    }
    const before = getHealthTracker();
    if (before.superficial < 1) return;
    const hungerBefore = clampHunger(vitalTrackers.hunger);
    const check = await performRouseCheck(t('Заживление лёгких повреждений'), { publish: false });
    const amount = window.VTMHealth.getSuperficialMendAmount(getCurrentBloodPotencyValue());
    const result = window.VTMHealth.recoverHealthDamage(before, amount, 'superficial', getSheetDamageProfile());
    setHealthTracker(result.tracker, {
        before,
        publish: true,
        reason: t('Заживление лёгких повреждений'),
        meta: {
            rouseChecks: [check],
            hungerBefore,
            hungerAfter: clampHunger(vitalTrackers.hunger),
            warnings: [getRouseWarning(check)].filter(Boolean),
            healing: { type: 'vampire_superficial', amountSuperficial: result.recovered, rouseChecks: [check] }
        }
    });
}

async function mendSheetVampireAggravated() {
    if (!isCharacterSheetFixed()) return;
    const before = getHealthTracker();
    if (before.aggravated < 1) return;
    if (!confirm(t('По правилам это можно делать не чаще одного раза за ночь и требует 3 Испытания Крови. Продолжить?'))) return;
    const lastMendDate = healthState.lastAggravatedMendAt ? new Date(healthState.lastAggravatedMendAt) : null;
    const mendedTonight = lastMendDate
        && !Number.isNaN(lastMendDate.getTime())
        && lastMendDate.toDateString() === new Date().toDateString();
    if (mendedTonight && !confirm(t('Тяжёлое повреждение уже лечили этой ночью. Применить мастерский override?'))) return;
    const hungerBefore = clampHunger(vitalTrackers.hunger);
    const checks = [];
    for (let index = 0; index < 3; index += 1) {
        checks.push(await performRouseCheck(tf('Заживление тяжёлого повреждения {n}/3', { n: index + 1 }), { publish: false }));
    }
    const result = window.VTMHealth.recoverHealthDamage(before, 1, 'aggravated', getSheetDamageProfile());
    healthState.lastAggravatedMendAt = new Date().toISOString();
    setHealthTracker(result.tracker, {
        before,
        publish: true,
        reason: t('Заживление тяжёлого повреждения'),
        meta: {
            rouseChecks: checks,
            hungerBefore,
            hungerAfter: clampHunger(vitalTrackers.hunger),
            warnings: checks.map(getRouseWarning).filter(Boolean),
            healing: { type: 'vampire_aggravated', amountAggravated: result.recovered, rouseChecks: checks }
        }
    });
}

function recoverSheetMortalHealth() {
    if (!isCharacterSheetFixed()) return;
    if (!['mortal', 'ghoul', 'custom'].includes(getSheetDamageProfile())) {
        alert(t('Вампиры лечат лёгкие повреждения через Пробуждение Крови.'));
        return;
    }
    const before = getHealthTracker();
    const stamina = parseInt(document.querySelector('input[name="Выносливость"]:checked')?.value || '0', 10) || 0;
    const result = window.VTMHealth.recoverHealthDamage(before, stamina, 'superficial', getSheetDamageProfile());
    setHealthTracker(result.tracker, {
        before,
        publish: result.recovered > 0,
        reason: t('Восстановление смертного'),
        meta: { healing: { type: 'mortal_superficial', amountSuperficial: result.recovered } }
    });
}

function treatSheetMortalHealth() {
    if (!isCharacterSheetFixed()) return;
    const before = getHealthTracker();
    if (before.aggravated < 1) return;
    const medicine = parseInt(prompt(t('Медицина лекаря:'), '1') || '0', 10);
    if (!medicine || medicine < 1) return;
    const selfTreatment = confirm(t('Лекарь лечит сам себя? Это повышает сложность на 1.'));
    const difficulty = before.aggravated + (selfTreatment ? 1 : 0);
    const success = confirm(tf('Проверка Интеллект + Медицина успешна? Сложность {difficulty}.', { difficulty }));
    const converted = success ? Math.min(before.aggravated, Math.ceil(medicine / 2)) : 0;
    const next = {
        ...before,
        aggravated: before.aggravated - converted,
        superficial: before.superficial + converted
    };
    setHealthTracker(next, {
        before,
        publish: true,
        reason: t('Лечение смертного'),
        meta: {
            warnings: success
                ? [t('Тяжёлые повреждения превращены в лёгкие. Восстановление занимает ночь.')]
                : [t('Проверка лечения провалена: здоровье не изменилось.')],
            healing: { type: 'mortal_aggravated_medicine', amountAggravated: converted }
        }
    });
}

function clearSheetHealth() {
    if (!isCharacterSheetFixed()) return;
    if (!confirm(t('Полностью очистить шкалу здоровья?'))) return;
    const before = getHealthTracker();
    setHealthTracker({ ...before, superficial: 0, aggravated: 0 }, { before, publish: true, reason: t('Здоровье очищено') });
}

function markSheetHealthDefeated() {
    if (!isCharacterSheetFixed()) return;
    const profile = getSheetDamageProfile();
    const message = profile === 'vampire' ? t('Отметить торпор и заполнить шкалу X?') : t('Отметить кому/смерть и заполнить шкалу X?');
    if (!confirm(message)) return;
    const before = getHealthTracker();
    setHealthTracker({ ...before, superficial: 0, aggravated: before.max }, {
        before,
        publish: true,
        reason: profile === 'vampire' ? t('Торпор') : t('Кома / смерть'),
        meta: { warnings: [window.VTMHealth.warningFor({ ...before, superficial: 0, aggravated: before.max }, profile)] }
    });
}

function syncDamageProfileFromCharacterType({ autosave = false } = {}) {
    damageProfile = getDefaultDamageProfile(getCurrentCharacterType());
    renderVitalTracker('health');
    updateVitalProfileVisibility();
    if (autosave) autoSaveVitalState({ immediate: true });
}

function updateVitalProfileVisibility() {
    const usesVampireResources = ['vampire', 'thinblood'].includes(getCurrentCharacterType());
    document.querySelectorAll('[data-vampire-resource="true"]').forEach(element => {
        element.hidden = !usesVampireResources;
    });
}

function setWillpowerTracker(nextTracker, { autosave = true, publish = false, reason = t('Воля обновлена'), before = null, meta = {} } = {}) {
    const max = getVitalMax('willpower');
    vitalTrackers.willpower = normalizeWillpowerTracker(nextTracker, max);
    renderVitalTracker('willpower');
    if (autosave) autoSaveVitalState({ immediate: true });
    if (publish) {
        publishWillpowerEvent(reason, before || getWillpowerState(max), getWillpowerState(max), meta);
    }
}

function getWillpowerCellStatuses(state = getWillpowerState()) {
    return Array.from({ length: state.max }, (_, index) => {
        const cell = index + 1;
        if (cell <= state.aggravated) return 'aggravated';
        if (cell <= state.aggravated + state.superficial) return 'superficial';
        return 'empty';
    });
}

function trackerFromWillpowerStatuses(statuses) {
    return {
        superficial: statuses.filter(status => status === 'superficial').length,
        aggravated: statuses.filter(status => status === 'aggravated').length
    };
}

function cycleWillpowerCell(index) {
    if (!isCharacterSheetFixed()) return;
    const before = getWillpowerState();
    const statuses = getWillpowerCellStatuses(before);
    const current = statuses[index - 1] || 'empty';
    statuses[index - 1] = current === 'empty' ? 'superficial' : current === 'superficial' ? 'aggravated' : 'empty';
    setWillpowerTracker(trackerFromWillpowerStatuses(statuses), {
        before,
        meta: { warnings: getWillpowerState().impaired ? [t('Трек Воли заполнен: ментальные и социальные проверки получают -2к10.')] : [] }
    });
}

function applyWillpowerStress(tracker, amount = 1) {
    const max = getVitalMax('willpower');
    const next = normalizeWillpowerTracker(tracker, max);
    let applied = 0;
    const warnings = [];

    for (let index = 0; index < amount; index++) {
        if (next.aggravated >= max) {
            warnings.push(t('Воля полностью заполнена тяжёлым стрессом: потратить Волю нельзя.'));
            break;
        }
        if (next.superficial + next.aggravated < max) {
            next.superficial += 1;
            applied += 1;
            continue;
        }
        if (next.superficial > 0) {
            next.superficial -= 1;
            next.aggravated += 1;
            applied += 1;
            warnings.push(t('Трек Воли был заполнен: один поверхностный стресс превращён в тяжёлый.'));
            continue;
        }
        warnings.push(t('Воля полностью заполнена: потратить Волю нельзя.'));
        break;
    }

    if (max > 0 && next.superficial + next.aggravated >= max) {
        warnings.push(t('Трек Воли заполнен: ментальные и социальные проверки получают -2к10.'));
    }
    return { tracker: next, applied, warnings };
}

function recoverWillpowerStress(tracker, amount = 1, severity = 'superficial') {
    const next = normalizeWillpowerTracker(tracker, getVitalMax('willpower'));
    let recovered = 0;
    for (let index = 0; index < amount; index++) {
        if (severity === 'aggravated') {
            if (next.aggravated <= 0) break;
            next.aggravated -= 1;
            recovered += 1;
        } else {
            if (next.superficial <= 0) break;
            next.superficial -= 1;
            recovered += 1;
        }
    }
    return { tracker: next, recovered };
}

function publishWillpowerEvent(reason, beforeState, afterState, meta = {}) {
    if (typeof publishDiceRoll !== 'function') return;
    const spent = typeof meta.spentWillpower === 'number' ? meta.spentWillpower : undefined;
    const recovered = typeof meta.recoveredWillpower === 'number' ? meta.recoveredWillpower : undefined;
    const roll = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        room: getDiceRoom(),
        characterName: document.getElementById('char-name')?.value?.trim() || t('Безымянный'),
        poolName: reason,
        poolType: 'willpower',
        diceCount: 0,
        dice: [],
        successes: 0,
        createdAt: new Date().toISOString(),
        meta: {
            source: 'willpower',
            willpowerBefore: getWillpowerMetaState(beforeState),
            willpowerAfter: getWillpowerMetaState(afterState),
            spentWillpower: spent,
            recoveredWillpower: recovered,
            willpowerImpaired: afterState.impaired,
            warnings: meta.warnings || []
        }
    };
    publishDiceRoll(roll);
}

function spendSheetWillpower(reason = t('Потратить Волю')) {
    if (!isCharacterSheetFixed()) return false;
    const before = getWillpowerState();
    const result = applyWillpowerStress(before, 1);
    if (result.applied < 1) {
        alert(result.warnings[0] || t('Волю сейчас потратить нельзя.'));
        return false;
    }
    setWillpowerTracker(result.tracker, {
        before,
        publish: true,
        reason,
        meta: { spentWillpower: 1, warnings: result.warnings }
    });
    return true;
}

function recoverSheetWillpowerSessionStart() {
    if (!isCharacterSheetFixed()) return;
    const before = getWillpowerState();
    const amount = getWillpowerRecoveryPool();
    const result = recoverWillpowerStress(before, amount, 'superficial');
    setWillpowerTracker(result.tracker, {
        before,
        publish: result.recovered > 0,
        reason: t('Воля: начало встречи'),
        meta: { recoveredWillpower: result.recovered }
    });
}

function recoverSheetWillpowerDesire() {
    if (!isCharacterSheetFixed()) return;
    const before = getWillpowerState();
    const result = recoverWillpowerStress(before, 1, 'superficial');
    setWillpowerTracker(result.tracker, {
        before,
        publish: result.recovered > 0,
        reason: t('Воля: Прихоть'),
        meta: { recoveredWillpower: result.recovered }
    });
}

function recoverSheetWillpowerAggravated() {
    if (!isCharacterSheetFixed()) return;
    const before = getWillpowerState();
    if (before.aggravated <= 0) return;
    if (!confirm(t('Снять один тяжёлый стресс Воли?'))) return;
    const result = recoverWillpowerStress(before, 1, 'aggravated');
    setWillpowerTracker(result.tracker, {
        before,
        publish: result.recovered > 0,
        reason: t('Воля: восстановление тяжёлого стресса'),
        meta: { recoveredWillpower: result.recovered }
    });
}

function adjustSheetWillpowerStress(severity, delta) {
    if (!isCharacterSheetFixed()) return;
    const before = getWillpowerState();
    const next = { superficial: before.superficial, aggravated: before.aggravated };
    if (severity === 'aggravated') {
        next.aggravated = Math.max(0, Math.min(before.max, next.aggravated + delta));
        if (next.superficial + next.aggravated > before.max) next.superficial = Math.max(0, before.max - next.aggravated);
    } else {
        next.superficial = Math.max(0, Math.min(Math.max(0, before.max - next.aggravated), next.superficial + delta));
    }
    setWillpowerTracker(next, { before });
}

function updateVitals() {
    const derived = getFullSheetDerivedStats();
    const hp = derived.health.totalMax;
    const healthValue = document.getElementById('val-hp');
    if (healthValue) {
        healthValue.textContent = hp;
        healthValue.setAttribute('data-tooltip', formatDerivedStatFormula('health', derived));
    }
    const healthFormula = document.getElementById('creation-health-formula');
    if (healthFormula) healthFormula.textContent = formatDerivedStatFormula('health', derived);

    const wp = derived.willpower.totalMax;
    const willpowerValue = document.getElementById('val-wp');
    if (willpowerValue) {
        willpowerValue.textContent = wp;
        willpowerValue.setAttribute('data-tooltip', formatDerivedStatFormula('willpower', derived));
    }
    const willpowerFormula = document.getElementById('creation-willpower-formula');
    if (willpowerFormula) willpowerFormula.textContent = formatDerivedStatFormula('willpower', derived);
    renderDerivedStatsPanel(derived);
    renderVitalTracker('health');
    renderVitalTracker('willpower');

    // Человечность
    updateHumanity();

    // Сила крови
    updateBloodPotencyVital();
    renderVitalTracker('hunger');
    updateCreationSummaryFormulas();
}

function updateBloodPotencyVital() {
    const predatorName = document.getElementById('predator-input')?.value || '';
    const base = getCurrentBloodPotencyEstimate();
    let predBonus = 0;
    if (predatorName && RULES?.predator_types?.[predatorName]) {
        predBonus = RULES.predator_types[predatorName].blood_potency || 0;
    }
    const calculated = clampBloodPotency(base + predBonus);
    const total = explicitBloodPotency === null ? calculated : clampBloodPotency(explicitBloodPotency);
    const el = document.getElementById('val-blood-potency');
    if (!el) return;
    if ('value' in el) el.value = String(total);
    else el.textContent = total;
    const summaryEl = document.getElementById('val-blood-potency-summary');
    if (summaryEl) summaryEl.textContent = String(total);
    const gameEl = document.getElementById('val-blood-potency-game');
    if (gameEl) gameEl.textContent = String(total);
    let tip = tf('Сила крови: {base} (от поколения/типа)', { base });
    if (predBonus) tip += ` + ${predBonus} (${predatorName})`;
    tip += ` = ${calculated}`;
    if (explicitBloodPotency !== null && total !== calculated) tip += tf('; вручную: {total}', { total });
    el.setAttribute('data-tooltip', tip);
}

function getStartingHumanityValue() {
    const predatorName = document.getElementById('predator-input')?.value || '';
    const baseHumanity = parseInt(document.getElementById('base-humanity')?.value || '7') || 7;

    let predatorMod = 0;

    if (predatorName && RULES.predator_types?.[predatorName]) {
        predatorMod = RULES.predator_types[predatorName].humanity || 0;
    }

    return Math.max(1, Math.min(10, baseHumanity + predatorMod));
}

function updateHumanity() {
    const predatorName = document.getElementById('predator-input')?.value || '';
    const baseHumanity = parseInt(document.getElementById('base-humanity')?.value || '7') || 7;
    const predatorMod = predatorName && RULES.predator_types?.[predatorName]
        ? RULES.predator_types[predatorName].humanity || 0
        : 0;
    const humanity = isCharacterSheetFixed() ? getHumanityState().value : getStartingHumanityValue();
    if (!isCharacterSheetFixed()) {
        humanityState = { ...getHumanityState(), value: humanity, stains: 0 };
        vitalTrackers.humanity = humanity;
    }
    const el = document.getElementById('val-humanity');

    if (el) {
        el.textContent = humanity;
        el.style.color = 'white';
        el.setAttribute('data-tooltip',
            tf('Человечность = старт({baseHumanity}) + стиль охоты({sign}{predatorMod}) = {humanity}', { baseHumanity, sign: predatorMod >= 0 ? '+' : '', predatorMod, humanity }));
    }
    const gameEl = document.getElementById('val-humanity-game');
    if (gameEl) gameEl.textContent = humanity;
    const formulaEl = document.getElementById('creation-humanity-formula');
    if (formulaEl) {
        const modifiers = [
            predatorMod ? tf('стиль {sign}{predatorMod}', { sign: predatorMod > 0 ? '+' : '', predatorMod }) : ''
        ].filter(Boolean);
        formulaEl.textContent = modifiers.length
            ? tf('Старт {baseHumanity} · {modifiers} = {humanity}', { baseHumanity, modifiers: modifiers.join(' · '), humanity })
            : tf('Стартовая человечность: {humanity}', { humanity });
    }
    renderVitalTracker('humanity');
}

function updateCreationSummaryFormulas() {
    const derived = getFullSheetDerivedStats();
    const healthFormula = document.getElementById('creation-health-formula');
    const willpowerFormula = document.getElementById('creation-willpower-formula');
    if (healthFormula) healthFormula.textContent = formatDerivedStatFormula('health', derived);
    if (willpowerFormula) willpowerFormula.textContent = formatDerivedStatFormula('willpower', derived);
    renderDerivedStatsPanel(derived);
}

function setInitialHunger(value) {
    if (isCharacterSheetFixed()) return;
    if (isPlayerVampire()) {
        vitalTrackers.hunger = 1;
        const select = document.getElementById('initial-hunger');
        if (select) select.value = '1';
        renderVitalTracker('hunger');
        return;
    }
    vitalTrackers.hunger = clampHunger(value);
    const select = document.getElementById('initial-hunger');
    if (select) select.value = String(vitalTrackers.hunger);
    renderVitalTracker('hunger');
    autoSaveVitalState();
}




// ==================== ЧИСТАЯ СИСТЕМА ДИСЦИПЛИН ====================

let disciplineSources = {}; 
let selectedPowers = {};
let activeDisciplineEffects = [];
let disciplineAutoSaveTimeout = null;

function getDisciplineDetailsHTML(name) {
    const discipline = RULES.disciplines?.[name];
    if (!discipline) {
        return `<p>${t('Описание дисциплины пока не добавлено.')}</p>`;
    }

    const system = discipline.system || {};
    const facts = [
        [t('Тип'), system.type],
        [t('Маскарад'), system.masquerade],
        [t('Резонанс'), system.resonance],
        [t('Ограничения'), system.limitations]
    ].filter(([, value]) => value);

    return `
        <p>${discipline.description || t('Описание дисциплины пока не добавлено.')}</p>
        ${facts.length ? `
            <dl>
                ${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}
            </dl>
        ` : ''}
    `;
}

function setupDisciplineDetails(item, name) {
    const title = item.querySelector('.discipline-title');
    const details = item.querySelector('.discipline-details');
    if (!title || !details) return;

    title.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const expanded = title.getAttribute('aria-expanded') === 'true';
        title.setAttribute('aria-expanded', String(!expanded));
        details.hidden = expanded;
    });
    title.title = tf('Открыть описание дисциплины «{name}»', { name });
}

function getSelectedPowerName(power) {
    return typeof power === 'string' ? power : power?.name || power?.название || '';
}

function findDisciplinePower(disciplineName, powerName, pathName = '') {
    return loadDisciplinePowersForFullSheet(disciplineName)
        .find(power => power.name === powerName && (!pathName || power.path === pathName)) || null;
}

function getPowerRollSummary(power) {
    return [
        power.pool || power.roll || '',
        power.extra_roll ? tf('Дополнительно: {value}', { value: power.extra_roll }) : '',
        power.control_roll ? tf('Контроль: {value}', { value: power.control_roll }) : '',
        power.resistance ? tf('Сопротивление: {value}', { value: power.resistance }) : ''
    ].filter(Boolean).join(' · ');
}

function getPowerDifficultySummary(power) {
    return [
        power.difficulty || '',
        power.difficulty_for_victim ? tf('для цели: {value}', { value: power.difficulty_for_victim }) : '',
        power.soak_difficulty ? tf('прочность: {value}', { value: power.soak_difficulty }) : ''
    ].filter(Boolean).join(' · ');
}

function getPowerDetailsHTML(disciplineName, powerName, pathName = '') {
    const resolved = findDisciplinePower(disciplineName, powerName, pathName);
    if (!resolved) return `<p>${t('Описание способности пока не добавлено.')}</p>`;

    const { level, path, rule: power } = resolved;
    const rollSummary = getPowerRollSummary(power);
    const difficultySummary = getPowerDifficultySummary(power);
    const facts = [
        [t('Уровень'), level],
        [t('Путь'), path],
        [t('Бросок'), rollSummary],
        [t('Сложность'), difficultySummary],
        [t('Стоимость'), power.cost],
        [t('Длительность'), power.duration],
        [t('Эффект'), power.effect]
    ].filter(([, value]) => value !== undefined && value !== null && value !== '');

    return `
        <p>${power.description || t('Описание способности пока не добавлено.')}</p>
        ${facts.length ? `
            <dl>
                ${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}
            </dl>
        ` : ''}
    `;
}

function setupPowerDetails(panel) {
    panel.querySelectorAll('.power-title').forEach(title => {
        title.addEventListener('click', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const expanded = title.getAttribute('aria-expanded') === 'true';
            title.setAttribute('aria-expanded', String(!expanded));
            const details = title.closest('.power-entry')?.querySelector('.power-details');
            if (details) details.hidden = expanded;
        });
    });

    panel.querySelectorAll('[data-discipline-activate]').forEach(button => {
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            activateFullSheetDisciplinePower(
                button.dataset.discipline || '',
                button.dataset.power || '',
                button.dataset.path || ''
            );
        });
    });

    panel.querySelectorAll('[data-discipline-deactivate]').forEach(button => {
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            deactivateFullSheetDisciplinePower(
                button.dataset.discipline || '',
                button.dataset.power || '',
                button.dataset.path || ''
            );
        });
    });
}

function isFullSheetObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cloneFullSheetData(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function showFullSheetSaveStatus(text, kind = '') {
    if (typeof setAutoSaveStatus === 'function') {
        setAutoSaveStatus(text, kind);
        return;
    }
    const status = document.getElementById('autosave-status');
    if (!status) return;
    status.textContent = text || '';
    status.dataset.kind = kind;
}

function getCurrentAttributeDotsForDerived(name) {
    const checked = document.querySelector(`input[name="${CSS.escape(name)}"]:checked`);
    return Math.max(0, parseInt(checked?.value || '0', 10) || 0);
}

function getFullSheetAttributeSnapshot() {
    return {
        'Выносливость': getCurrentAttributeDotsForDerived('Выносливость'),
        'Самообладание': getCurrentAttributeDotsForDerived('Самообладание'),
        'Упорство': getCurrentAttributeDotsForDerived('Упорство')
    };
}

function getFullSheetLegacyHealthSettings() {
    const health = isFullSheetObject(vitalTrackers?.health) ? vitalTrackers.health : {};
    const legacyBonus = Math.max(0, Math.floor(Number(health.bonusMax) || 0));
    const maxOverride = health.maxOverride === null || health.maxOverride === undefined
        ? null
        : Math.max(0, Math.floor(Number(health.maxOverride) || 0));
    return { legacyBonus, maxOverride };
}

function getPowerContainerFromRule(value) {
    if (!isFullSheetObject(value)) return null;
    if (isFullSheetObject(value.powers)) return value.powers;
    const levelEntries = Object.entries(value).filter(([key]) => Number.isFinite(Number(key)));
    return levelEntries.length ? Object.fromEntries(levelEntries) : null;
}

function collectRulePowers(disciplineName, pathName, container) {
    if (!isFullSheetObject(container)) return [];
    return Object.entries(container).flatMap(([levelKey, levelPowers]) => {
        if (!isFullSheetObject(levelPowers)) return [];
        const level = Number(levelKey);
        if (!Number.isFinite(level)) return [];
        return Object.entries(levelPowers).flatMap(([name, rule]) => {
            if (!isFullSheetObject(rule)) return [];
            return [{
                discipline: disciplineName,
                path: pathName || '',
                level,
                name,
                rule
            }];
        });
    });
}

function loadDisciplinePowersForFullSheet(disciplineName) {
    const discipline = RULES.disciplines?.[disciplineName];
    if (!isFullSheetObject(discipline)) return [];

    const directPowers = collectRulePowers(disciplineName, '', discipline.powers);
    const pathPowers = isFullSheetObject(discipline.paths)
        ? Object.entries(discipline.paths).flatMap(([pathName, pathRule]) => (
            collectRulePowers(disciplineName, pathName, getPowerContainerFromRule(pathRule))
        ))
        : [];
    return [...directPowers, ...pathPowers].sort((a, b) => (
        a.level - b.level || a.name.localeCompare(b.name, 'ru')
    ));
}

function getPowerNameFromSelection(value) {
    if (typeof value === 'string') return value.trim();
    if (!isFullSheetObject(value)) return '';
    return String(value.name || value.power || value['название'] || '').trim();
}

function addSelectedPowerName(bucket, value, fallbackPath = '') {
    const name = getPowerNameFromSelection(value);
    if (!name) return;
    bucket.names.add(name);
    const path = isFullSheetObject(value)
        ? String(value.path || value.pathName || value.path_name || value['путь'] || fallbackPath || '').trim()
        : String(fallbackPath || '').trim();
    if (path) {
        if (!bucket.pathPowers[path]) bucket.pathPowers[path] = new Set();
        bucket.pathPowers[path].add(name);
    }
}

function addSelectedPowerList(bucket, value, fallbackPath = '') {
    if (!Array.isArray(value)) return;
    value.forEach(item => addSelectedPowerName(bucket, item, fallbackPath));
}

function getSelectedDisciplinePowerNames(disciplineName) {
    const bucket = { names: new Set(), pathPowers: {} };
    const value = selectedPowers?.[disciplineName];
    if (Array.isArray(value)) {
        addSelectedPowerList(bucket, value);
        return bucket;
    }
    if (!isFullSheetObject(value)) return bucket;

    ['powers', 'selectedPowers', 'selected_powers'].forEach(key => {
        addSelectedPowerList(bucket, value[key]);
    });
    if (isFullSheetObject(value.paths)) {
        Object.entries(value.paths).forEach(([pathName, pathValue]) => {
            if (Array.isArray(pathValue)) {
                addSelectedPowerList(bucket, pathValue, pathName);
            } else if (isFullSheetObject(pathValue)) {
                ['powers', 'selectedPowers', 'selected_powers'].forEach(key => {
                    addSelectedPowerList(bucket, pathValue[key], pathName);
                });
            }
        });
    }
    Object.entries(value).forEach(([pathName, pathValue]) => {
        if (['paths', 'powers', 'selectedPowers', 'selected_powers', 'sources', 'rating', 'dots', 'value'].includes(pathName)) return;
        if (Array.isArray(pathValue)) addSelectedPowerList(bucket, pathValue, pathName);
    });
    return bucket;
}

function hasSelectedFullSheetPowers(selection) {
    return selection.names.size > 0 || Object.values(selection.pathPowers).some(set => set.size > 0);
}

function getDisciplinePathRatingForFullSheet(disciplineName, pathName = '') {
    const sources = disciplineSources?.[disciplineName] || {};
    if (pathName && Number(sources[pathName]) > 0) return Math.max(0, Number(sources[pathName]) || 0);
    return Object.values(sources).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function getKnownDisciplinePowersForFullSheet(disciplineName) {
    const powers = loadDisciplinePowersForFullSheet(disciplineName);
    const selected = getSelectedDisciplinePowerNames(disciplineName);
    if (hasSelectedFullSheetPowers(selected)) {
        return powers.filter(power => {
            if (selected.names.has(power.name)) return true;
            return Boolean(power.path && selected.pathPowers[power.path]?.has(power.name));
        });
    }

    const rating = getDisciplinePathRatingForFullSheet(disciplineName);
    return powers.filter(power => power.level <= (
        power.path ? getDisciplinePathRatingForFullSheet(disciplineName, power.path) || rating : rating
    ));
}

function isPassiveDisciplineActivation(mechanics) {
    const activation = mechanics?.activation;
    if (activation === 'passive') return true;
    return isFullSheetObject(activation) && (
        activation.passive === true ||
        activation.type === 'passive' ||
        activation.mode === 'passive' ||
        activation.kind === 'passive'
    );
}

function getDisciplineAutomationStatus(mechanics) {
    return isFullSheetObject(mechanics?.automation) ? mechanics.automation.status : '';
}

function resolveFullSheetTraitValue(trait, disciplineName) {
    const normalizedTrait = String(trait || '').trim().toLocaleLowerCase('ru');
    if (
        normalizedTrait === 'discipline' ||
        normalizedTrait === 'discipline_rating' ||
        normalizedTrait === disciplineName.toLocaleLowerCase('ru')
    ) {
        return getDisciplinePathRatingForFullSheet(disciplineName);
    }
    const attributes = getFullSheetAttributeSnapshot();
    if (Object.prototype.hasOwnProperty.call(attributes, trait)) return attributes[trait];
    return getDisciplinePathRatingForFullSheet(trait);
}

function applyFullSheetFormulaBounds(value, formula) {
    let result = value;
    const multiplier = Number(formula.multiplier);
    const offset = Number(formula.offset);
    const min = Number(formula.min);
    const max = Number(formula.max);
    if (Number.isFinite(multiplier)) result *= multiplier;
    if (Number.isFinite(offset)) result += offset;
    if (Number.isFinite(min)) result = Math.max(min, result);
    if (Number.isFinite(max)) result = Math.min(max, result);
    return result;
}

function resolveFullSheetFormulaValue(value, disciplineName) {
    if (value === undefined) return getDisciplinePathRatingForFullSheet(disciplineName);
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : resolveFullSheetTraitValue(value, disciplineName);
    }
    if (!isFullSheetObject(value)) return 0;
    if (value.formula === 'discipline_rating') {
        return applyFullSheetFormulaBounds(
            getDisciplinePathRatingForFullSheet(String(value.discipline || disciplineName)),
            value
        );
    }
    if (value.type === 'trait' && typeof value.trait === 'string') {
        return applyFullSheetFormulaBounds(resolveFullSheetTraitValue(value.trait, disciplineName), value);
    }
    if (value.type === 'formula' && typeof value.expression === 'string') {
        const expression = value.expression.trim();
        const numeric = Number(expression);
        return Number.isFinite(numeric)
            ? numeric
            : applyFullSheetFormulaBounds(resolveFullSheetTraitValue(expression, disciplineName), value);
    }
    return 0;
}

function getFullSheetPassiveTrackerModifiers() {
    const modifiers = [];
    Object.keys(disciplineSources || {}).forEach(disciplineName => {
        getKnownDisciplinePowersForFullSheet(disciplineName).forEach(power => {
            const mechanics = isFullSheetObject(power.rule?.mechanics) ? power.rule.mechanics : null;
            const status = getDisciplineAutomationStatus(mechanics);
            if (status !== 'auto' && status !== 'partial') return;
            if (!isPassiveDisciplineActivation(mechanics)) return;
            const effects = Array.isArray(mechanics.effects) ? mechanics.effects : [];
            effects.forEach(effect => {
                if (!isFullSheetObject(effect) || effect.type !== 'tracker_modifier') return;
                if (effect.operation !== 'add_max') return;
                if (effect.tracker !== 'health' && effect.tracker !== 'willpower') return;
                const value = Math.floor(resolveFullSheetFormulaValue(effect.value ?? effect.amount, disciplineName));
                if (!Number.isFinite(value) || value === 0) return;
                modifiers.push({
                    tracker: effect.tracker,
                    operation: 'add_max',
                    value,
                    source: {
                        discipline: disciplineName,
                        power: power.name,
                        path: power.path || '',
                        level: power.level
                    }
                });
            });
        });
    });
    return modifiers;
}

function getFullSheetDerivedStats() {
    const attrs = getFullSheetAttributeSnapshot();
    const healthBaseMax = Math.max(0, Math.floor(attrs['Выносливость'] + 3));
    const willpowerBaseMax = Math.max(0, Math.floor(attrs['Самообладание'] + attrs['Упорство']));
    const modifiers = getFullSheetPassiveTrackerModifiers();
    const healthPassiveBonus = modifiers
        .filter(modifier => modifier.tracker === 'health')
        .reduce((total, modifier) => total + modifier.value, 0);
    const willpowerPassiveBonus = modifiers
        .filter(modifier => modifier.tracker === 'willpower')
        .reduce((total, modifier) => total + modifier.value, 0);
    const { legacyBonus, maxOverride } = getFullSheetLegacyHealthSettings();

    return {
        health: {
            baseMax: healthBaseMax,
            passiveBonus: healthPassiveBonus,
            legacyBonus,
            totalMax: maxOverride ?? Math.max(0, healthBaseMax + legacyBonus + healthPassiveBonus)
        },
        willpower: {
            baseMax: willpowerBaseMax,
            passiveBonus: willpowerPassiveBonus,
            legacyBonus: 0,
            totalMax: Math.max(0, willpowerBaseMax + willpowerPassiveBonus)
        },
        modifiers
    };
}

function formatDerivedStatFormula(kind, derived = getFullSheetDerivedStats()) {
    const attrs = getFullSheetAttributeSnapshot();
    if (kind === 'health') {
        const parts = [tf('Выносливость {stamina} + 3', { stamina: attrs['Выносливость'] })];
        if (derived.health.legacyBonus) parts.push(tf('бонус +{bonus}', { bonus: derived.health.legacyBonus }));
        if (derived.health.passiveBonus) parts.push(tf('пассивные силы +{bonus}', { bonus: derived.health.passiveBonus }));
        if (vitalTrackers.health?.maxOverride !== null && vitalTrackers.health?.maxOverride !== undefined) {
            parts.push(tf('ручной максимум {max}', { max: derived.health.totalMax }));
        }
        return `${parts.join(' · ')} = ${derived.health.totalMax}`;
    }
    const parts = [tf('Самообладание {composure} + Упорство {resolve}', {
        composure: attrs['Самообладание'],
        resolve: attrs['Упорство']
    })];
    if (derived.willpower.passiveBonus) parts.push(tf('пассивные силы +{bonus}', { bonus: derived.willpower.passiveBonus }));
    return `${parts.join(' · ')} = ${derived.willpower.totalMax}`;
}

function renderDerivedStatsPanel(derived = getFullSheetDerivedStats()) {
    const healthTotal = document.getElementById('derived-health-total');
    const healthFormula = document.getElementById('derived-health-formula');
    const willpowerTotal = document.getElementById('derived-willpower-total');
    const willpowerFormula = document.getElementById('derived-willpower-formula');

    if (healthTotal) healthTotal.textContent = derived.health.totalMax;
    if (healthFormula) healthFormula.textContent = formatDerivedStatFormula('health', derived);
    if (willpowerTotal) willpowerTotal.textContent = derived.willpower.totalMax;
    if (willpowerFormula) willpowerFormula.textContent = formatDerivedStatFormula('willpower', derived);
}

function normalizeActiveDisciplineEffect(value) {
    if (!isFullSheetObject(value) || typeof value.id !== 'string' || !value.id.trim()) return null;
    const source = isFullSheetObject(value.source) ? value.source : {};
    const effect = isFullSheetObject(value.effect) && typeof value.effect.type === 'string' ? value.effect : null;
    if (!effect) return null;
    const duration = isFullSheetObject(value.duration) ? value.duration : null;
    const durationType = duration && ['scene', 'night', 'turn', 'permanent'].includes(duration.type)
        ? duration.type
        : null;

    return {
        ...cloneFullSheetData(value),
        id: value.id,
        source: {
            discipline: typeof source.discipline === 'string' ? source.discipline : '',
            power: typeof source.power === 'string' ? source.power : '',
            path: typeof source.path === 'string' ? source.path : undefined,
            level: Number.isFinite(Number(source.level)) ? Number(source.level) : undefined
        },
        effect: cloneFullSheetData(effect),
        targetCharacterId: typeof value.targetCharacterId === 'string' ? value.targetCharacterId : undefined,
        startedAt: typeof value.startedAt === 'string' ? value.startedAt : new Date(0).toISOString(),
        expiresAt: typeof value.expiresAt === 'string' || value.expiresAt === null ? value.expiresAt : undefined,
        remainingUses: typeof value.remainingUses === 'number' || value.remainingUses === null ? value.remainingUses : undefined,
        duration: durationType ? {
            type: durationType,
            turns: Number.isFinite(Number(duration.turns)) ? Number(duration.turns) : undefined,
            startedAt: typeof duration.startedAt === 'string'
                ? duration.startedAt
                : typeof value.startedAt === 'string'
                    ? value.startedAt
                    : new Date(0).toISOString()
        } : undefined,
        active: value.active !== false
    };
}

function normalizeActiveDisciplineEffects(value) {
    return Array.isArray(value)
        ? value.map(normalizeActiveDisciplineEffect).filter(Boolean)
        : [];
}

function getActiveDisciplineEffects() {
    activeDisciplineEffects = normalizeActiveDisciplineEffects(activeDisciplineEffects);
    return cloneFullSheetData(activeDisciplineEffects);
}

function setActiveDisciplineEffectsFromData(effects, { render = true } = {}) {
    activeDisciplineEffects = normalizeActiveDisciplineEffects(effects);
    if (window.__loadedCharacterData && isFullSheetObject(window.__loadedCharacterData)) {
        window.__loadedCharacterData.activeEffects = getActiveDisciplineEffects();
    }
    if (render) {
        renderActiveDisciplineEffects();
        renderDisciplines();
    }
}

function getActiveEffectTitleForFullSheet(activeEffect) {
    return activeEffect.effect?.label || activeEffect.source?.power || activeEffect.effect?.type || t('Эффект');
}

function getActiveEffectDescriptionForFullSheet(activeEffect) {
    const payload = isFullSheetObject(activeEffect.effect?.payload)
        ? Object.entries(activeEffect.effect.payload)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' · ')
        : '';
    return [
        activeEffect.effect?.description,
        payload,
        activeEffect.source?.path,
        activeEffect.source?.level ? tf('уровень {level}', { level: activeEffect.source.level }) : '',
        getFullSheetDurationLabel(activeEffect.duration)
    ].filter(Boolean).join(' · ');
}

function getFullSheetDurationLabel(duration) {
    if (!isFullSheetObject(duration)) return '';
    if (duration.type === 'permanent') return t('постоянно');
    if (duration.type === 'scene') return t('до конца сцены');
    if (duration.type === 'night') return t('до конца ночи');
    if (duration.type === 'turn') return duration.turns
        ? tf('{turns} ход(ов)', { turns: duration.turns })
        : t('ход');
    return '';
}

function renderActiveDisciplineEffects() {
    const list = document.getElementById('active-effects-list');
    if (!list) return;
    const effects = getActiveDisciplineEffects().filter(effect => effect.active);
    if (!effects.length) {
        list.innerHTML = `<p class="power-action-note">${t('Активных эффектов нет.')}</p>`;
        return;
    }
    list.innerHTML = effects.map(effect => `
        <article class="active-effect-item">
            <div>
                <strong>${escapeHTML(getActiveEffectTitleForFullSheet(effect))}</strong>
                <small>${escapeHTML([
                    effect.source?.discipline,
                    effect.source?.power,
                    getActiveEffectDescriptionForFullSheet(effect)
                ].filter(Boolean).join(' · '))}</small>
            </div>
            <button type="button" data-remove-active-effect="${escapeHTML(effect.id)}">${t('Отключить')}</button>
        </article>
    `).join('');
    list.querySelectorAll('[data-remove-active-effect]').forEach(button => {
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            removeFullSheetActiveEffect(button.dataset.removeActiveEffect || '');
        });
    });
}

function isFullSheetPowerActive(disciplineName, powerName, pathName = '') {
    return getActiveDisciplineEffects().some(effect => (
        effect.active &&
        effect.source?.discipline === disciplineName &&
        effect.source?.power === powerName &&
        (!pathName || effect.source?.path === pathName)
    ));
}

function getFullSheetActivationKind(mechanics) {
    return isFullSheetObject(mechanics?.activation) && typeof mechanics.activation.kind === 'string'
        ? mechanics.activation.kind
        : '';
}

function getFullSheetPowerEffects(mechanics, power) {
    if (Array.isArray(mechanics?.effects) && mechanics.effects.length > 0) {
        return mechanics.effects;
    }
    return [{
        type: 'manual_prompt',
        label: power.name,
        message: tf('Активна сила «{power}». Эффект применяется вручную.', { power: power.name })
    }];
}

function normalizeFullSheetDuration(mechanicsDuration, legacyDuration) {
    if (isFullSheetObject(mechanicsDuration) && ['scene', 'night', 'turn', 'permanent'].includes(mechanicsDuration.type)) {
        return {
            type: mechanicsDuration.type,
            turns: Math.max(0, Math.floor(Number(mechanicsDuration.turns) || 0)) || undefined
        };
    }
    const text = String(legacyDuration || '').toLocaleLowerCase('ru');
    if (/постоян|permanent/.test(text)) return { type: 'permanent' };
    if (/ноч|night/.test(text)) return { type: 'night' };
    if (/ход|turn|раунд|round/.test(text)) return { type: 'turn' };
    return { type: 'scene' };
}

function createFullSheetDurationState(duration, startedAt) {
    return {
        type: duration.type,
        turns: duration.type === 'turn' ? duration.turns : undefined,
        startedAt
    };
}

function getFullSheetDurationRemainingUses(duration) {
    return duration.type === 'turn' && duration.turns ? duration.turns : undefined;
}

function resolveFullSheetCost(mechanics = {}, legacyCost = '') {
    const explicitCost = isFullSheetObject(mechanics.cost) ? mechanics.cost : null;
    const costText = String(legacyCost || '').toLocaleLowerCase('ru');
    const rouseFromText = /испытан|rouse/.test(costText) ? 1 : 0;
    const willpowerFromText = /вол[ияи]|willpower/.test(costText) ? 1 : 0;
    const willpowerCost = mechanics.willpower_cost;
    const willpowerFromMechanics = typeof willpowerCost === 'number'
        ? willpowerCost
        : isFullSheetObject(willpowerCost)
            ? Number(willpowerCost.spend || 0)
            : 0;

    return {
        rouseChecks: Math.max(0, Math.floor(Number(explicitCost?.rouseChecks ?? mechanics.rouse_checks ?? rouseFromText) || 0)),
        willpowerSpend: Math.max(0, Math.floor(Number(explicitCost?.willpowerSpend ?? willpowerFromMechanics ?? willpowerFromText) || 0)),
        manualBlood: Boolean(explicitCost?.manualBlood || (Number(explicitCost?.bloodPoints || 0) > 0)),
        manualWillpower: Boolean(explicitCost?.manualWillpower || willpowerCost?.manual_choice),
        willpowerRatingReduction: Math.max(0, Math.floor(Number(explicitCost?.willpowerRatingReduction || willpowerCost?.reduce_rating || 0) || 0)),
        variableRouseChecks: Boolean(explicitCost?.variableRouseChecks || mechanics.variable_rouse_checks)
    };
}

function payFullSheetDisciplineCost(power) {
    const mechanics = power.rule?.mechanics || {};
    const cost = resolveFullSheetCost(mechanics, power.rule?.cost);
    const warnings = [];

    if (cost.willpowerRatingReduction > 0) {
        return {
            success: false,
            warnings: [t('Стоимость требует ручного изменения максимума Воли.')]
        };
    }

    if (cost.manualBlood) warnings.push(t('Стоимость в пунктах крови отмечена как ручная.'));
    if (cost.manualWillpower && cost.willpowerSpend <= 0) warnings.push(t('Стоимость Воли требует ручного решения.'));

    let spentWillpower = 0;
    if (cost.willpowerSpend > 0 && !cost.manualWillpower) {
        const before = getWillpowerState();
        const result = applyWillpowerStress(before, cost.willpowerSpend);
        if (result.applied < cost.willpowerSpend) {
            return {
                success: false,
                warnings: [t('Воля полностью заполнена тяжёлым стрессом: оплатить силу нельзя.')]
            };
        }
        vitalTrackers.willpower = {
            superficial: result.tracker.superficial,
            aggravated: result.tracker.aggravated
        };
        spentWillpower = result.applied;
        warnings.push(...result.warnings);
    }

    const rouseChecks = [];
    let hunger = clampHunger(vitalTrackers.hunger || 0);
    const checksCount = cost.variableRouseChecks ? Math.max(1, cost.rouseChecks || 1) : cost.rouseChecks;
    for (let index = 0; index < checksCount; index += 1) {
        const before = hunger;
        const value = Math.floor(Math.random() * 10) + 1;
        const success = value >= 6;
        if (!success) hunger = clampHunger(hunger + 1);
        rouseChecks.push({ value, success, hungerBefore: before, hungerAfter: hunger });
    }
    if (rouseChecks.length) {
        vitalTrackers.hunger = hunger;
        renderVitalTracker('hunger');
    }
    if (spentWillpower > 0) renderVitalTracker('willpower');

    return { success: true, cost, rouseChecks, spentWillpower, warnings };
}

function activateFullSheetDisciplinePower(disciplineName, powerName, pathName = '') {
    const power = loadDisciplinePowersForFullSheet(disciplineName)
        .find(item => item.name === powerName && (!pathName || item.path === pathName));
    if (!power) {
        showFullSheetSaveStatus(t('Сила не найдена'), 'error');
        return;
    }
    const mechanics = isFullSheetObject(power.rule?.mechanics) ? power.rule.mechanics : {};
    if (getFullSheetActivationKind(mechanics) !== 'active') {
        showFullSheetSaveStatus(t('Эта сила не создаёт активный эффект'), 'idle');
        return;
    }
    if (isFullSheetPowerActive(disciplineName, powerName, pathName)) {
        deactivateFullSheetDisciplinePower(disciplineName, powerName, pathName);
        return;
    }

    const payment = payFullSheetDisciplineCost(power);
    if (!payment.success) {
        showFullSheetSaveStatus(payment.warnings?.[0] || t('Сила не активирована'), 'error');
        return;
    }

    const startedAt = new Date().toISOString();
    const duration = normalizeFullSheetDuration(mechanics.duration, power.rule?.duration);
    const createdEffects = getFullSheetPowerEffects(mechanics, power).map((effect, index) => ({
        id: `${disciplineName}:${powerName}:${effect.id || index}:${startedAt}`,
        source: {
            discipline: disciplineName,
            power: powerName,
            path: pathName || undefined,
            level: power.level
        },
        effect: cloneFullSheetData(effect),
        targetCharacterId: undefined,
        startedAt,
        expiresAt: duration.type === 'permanent' ? null : undefined,
        remainingUses: getFullSheetDurationRemainingUses(duration),
        duration: createFullSheetDurationState(duration, startedAt),
        active: true
    }));

    activeDisciplineEffects = normalizeActiveDisciplineEffects([
        ...activeDisciplineEffects,
        ...createdEffects
    ]);
    renderActiveDisciplineEffects();
    renderDisciplines();
    updateVitals();
    queueFullSheetDisciplineAutosave(true);

    const rouseText = payment.rouseChecks?.length
        ? tf('Испытаний Крови: {count}', { count: payment.rouseChecks.length })
        : '';
    const wpText = payment.spentWillpower
        ? tf('Воля: -{count}', { count: payment.spentWillpower })
        : '';
    showFullSheetSaveStatus([t('Сила активирована'), rouseText, wpText, ...(payment.warnings || [])].filter(Boolean).join(' · '), 'saved');
}

function deactivateFullSheetDisciplinePower(disciplineName, powerName, pathName = '') {
    const before = activeDisciplineEffects.length;
    activeDisciplineEffects = normalizeActiveDisciplineEffects(activeDisciplineEffects)
        .filter(effect => !(
            effect.active &&
            effect.source?.discipline === disciplineName &&
            effect.source?.power === powerName &&
            (!pathName || effect.source?.path === pathName)
        ));
    if (activeDisciplineEffects.length === before) {
        showFullSheetSaveStatus(t('Активный эффект не найден'), 'idle');
        return;
    }
    renderActiveDisciplineEffects();
    renderDisciplines();
    queueFullSheetDisciplineAutosave(true);
    showFullSheetSaveStatus(t('Сила отключена'), 'saved');
}

function removeFullSheetActiveEffect(effectId) {
    if (!effectId) return;
    const before = activeDisciplineEffects.length;
    activeDisciplineEffects = normalizeActiveDisciplineEffects(activeDisciplineEffects)
        .filter(effect => effect.id !== effectId);
    if (activeDisciplineEffects.length === before) return;
    renderActiveDisciplineEffects();
    renderDisciplines();
    queueFullSheetDisciplineAutosave(true);
    showFullSheetSaveStatus(t('Эффект отключён'), 'saved');
}

function getFullSheetDisciplineAutosavePatch() {
    return {
        activeEffects: getActiveDisciplineEffects(),
        vitalTrackers: getVitalTrackerData(),
        status: {
            physicalState: getHealthTracker().physicalState,
            humanityState: getHumanityState().value <= 0 ? 'lost_to_beast' : null
        },
        healthState: { ...healthState }
    };
}

function queueFullSheetDisciplineAutosave(immediate = false) {
    if (isApplyingCharacterData) return;
    if (window.__loadedCharacterData && isFullSheetObject(window.__loadedCharacterData)) {
        window.__loadedCharacterData.activeEffects = getActiveDisciplineEffects();
        window.__loadedCharacterData.vitalTrackers = getVitalTrackerData();
    }
    if (!window.autoSaveCharacterPatch) return;

    if (disciplineAutoSaveTimeout) {
        clearTimeout(disciplineAutoSaveTimeout);
        disciplineAutoSaveTimeout = null;
    }

    const run = () => window.autoSaveCharacterPatch(getFullSheetDisciplineAutosavePatch(), {
        immediate,
        silent: true
    });

    if (immediate) {
        run();
        return;
    }
    disciplineAutoSaveTimeout = setTimeout(run, 650);
}

function getPowerActionHTML(power) {
    const mechanics = isFullSheetObject(power.rule?.mechanics) ? power.rule.mechanics : null;
    const automation = getDisciplineAutomationStatus(mechanics);
    const isActiveKind = getFullSheetActivationKind(mechanics) === 'active';
    const active = isFullSheetPowerActive(power.discipline, power.name, power.path || '');
    const label = active ? t('Отключить') : t('Активировать');
    const actionAttr = active ? 'data-discipline-deactivate' : 'data-discipline-activate';

    if (isActiveKind) {
        return `
            <div class="power-action-row">
                <span class="power-action-note">${escapeHTML(automation ? `mechanics: ${automation}` : t('активная сила'))}</span>
                <button type="button"
                        class="power-action-btn${active ? ' is-active' : ''}"
                        ${actionAttr}
                        data-discipline="${escapeHTML(power.discipline)}"
                        data-power="${escapeHTML(power.name)}"
                        data-path="${escapeHTML(power.path || '')}">
                    ${label}
                </button>
            </div>
        `;
    }

    const note = automation === 'manual'
        ? t('Эффект применяется вручную.')
        : automation === 'partial'
            ? t('Частичная автоматизация.')
            : isPassiveDisciplineActivation(mechanics)
                ? t('Пассивный эффект учтён автоматически.')
                : t('Автоматической активации нет.');
    return `<div class="power-action-row"><span class="power-action-note">${escapeHTML(note)}</span></div>`;
}

window.getActiveDisciplineEffects = getActiveDisciplineEffects;
window.setActiveDisciplineEffectsFromData = setActiveDisciplineEffectsFromData;
window.activateFullSheetDisciplinePower = activateFullSheetDisciplinePower;
window.deactivateFullSheetDisciplinePower = deactivateFullSheetDisciplinePower;
window.removeFullSheetActiveEffect = removeFullSheetActiveEffect;

function mergeDiscipline(name, dotsToAdd = 1, source = "") {
    if (!name) return;
    name = name.trim();

    if (!disciplineSources[name]) disciplineSources[name] = {};

    const oldTotal = Object.values(disciplineSources[name]).reduce((sum, val) => sum + val, 0);

    disciplineSources[name][source] = (disciplineSources[name][source] || 0) + dotsToAdd;

    const newTotal = Object.values(disciplineSources[name]).reduce((sum, val) => sum + val, 0);

    console.log(`🔄 Обновляем "${name}" → ${newTotal} точек`);

    // === ЖЁСТКОЕ СТИРАНИЕ ВСЕХ СПОСОБНОСТЕЙ ПРИ УМЕНЬШЕНИИ ===
    if (newTotal < oldTotal) {
        if (selectedPowers[name]) {
            console.log(`🗑️ Точек стало меньше (${oldTotal} → ${newTotal}). ПОЛНОСТЬЮ удаляем ВСЕ способности у "${name}"`);
            delete selectedPowers[name];
        }
    }

    updateDisciplineRow(name);
    updateDisciplineTotal();
    renderDisciplines();
    updateVitals();
}

function removeDisciplineSource(source) {
    if (!source) return;
    Object.keys(disciplineSources || {}).forEach(name => {
        if (!disciplineSources[name] || disciplineSources[name][source] === undefined) return;
        delete disciplineSources[name][source];
        if (Object.keys(disciplineSources[name]).length === 0) {
            delete disciplineSources[name];
        }
    });
    pruneSelectedPowersForCurrentDisciplines();
}

function setDisciplineSource(name, dots, source) {
    if (!name || !source) return;
    name = name.trim();
    if (!disciplineSources[name]) disciplineSources[name] = {};
    disciplineSources[name][source] = dots;
    updateDisciplineRow(name);
    updateDisciplineTotal();
    renderDisciplines();
    updateVitals();
}
// Обновление или создание строки дисциплины
function updateDisciplineRow(name) {
    if (!disciplineSources[name]) return;

    const totalDots = Object.values(disciplineSources[name]).reduce((sum, val) => sum + val, 0);
    const sourcesList = Object.keys(disciplineSources[name]).join(" + ");

    // Удаляем все старые строки с этим именем
    document.querySelectorAll('.discipline-item').forEach(item => {
        if (item.dataset.disciplineName === name) {
            item.remove();
        }
    });

    // Создаём новую
    addDisciplineRow(name, totalDots, sourcesList);
}

function addDisciplineRow(name, dots = 1, sourceText = "") {
    const list = document.getElementById('disciplines-list');
    if (!list) return;

    const item = document.createElement('div');
    item.className = 'discipline-item';
    item.dataset.disciplineName = name;

    let dotsHTML = '';
    const baseDots = getBaseDisciplineLevel(name);
    const shopStartDots = expShopMode
        ? getDisciplineTotal(name, expShopSnapshot?.disciplines || {})
        : dots;
    for (let i = 1; i <= 5; i++) {
        const filled = i <= dots ? 'filled' : '';
        const expClass = filled && i > shopStartDots ? 'exp-pending' : filled && i > baseDots ? 'exp-purchased' : '';
        const priceTitle = expShopMode ? ` title="${tf('До {i}: {cost} XP', { i, cost: getDisciplinePreviewCost(name, i) })}"` : '';
        dotsHTML += `<div class="disc-dot ${filled} ${expClass}" data-level="${i}"${priceTitle}></div>`;
    }

    const sources = sourceText.split('+').map(s => s.trim()).filter(s => s);

    item.innerHTML = `
        <div class="discipline-heading">
            <button type="button" class="discipline-title" aria-expanded="false">${name}<span aria-hidden="true">⌄</span></button>
            <div class="dots-discipline">${dotsHTML}</div>
            <small class="discipline-source">${sources.join('<br>')}</small>
            <button class="remove-disc-btn" style="background:#222;color:#ff6666;border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:20px;">×</button>
            <button type="button" class="show-master-btn" style="background:#111;color:#ffae00;border:1px solid #553500;border-radius:6px;padding:7px 10px;cursor:pointer;">${t('Показать мастеру')}</button>
        </div>
        <div class="discipline-details" hidden>${getDisciplineDetailsHTML(name)}</div>
    `;

    setupDisciplineDetails(item, name);

    // Удаление всей дисциплины
    item.querySelector('.remove-disc-btn').addEventListener('click', () => {
        if (startingSheetFixed && !expShopMode) return alert(t("Лист зафиксирован. Дисциплины сейчас нельзя менять."));
        delete disciplineSources[name];
        delete selectedPowers[name];        // ← тоже стираем способности
        item.remove();
        updateDisciplineTotal();
        renderDisciplines();
        updateVitals();
        if (expShopMode) renderExpShopPanel();
    });

    item.querySelector('.show-master-btn')?.addEventListener('click', (event) => {
        event.stopImmediatePropagation();
        const powers = (selectedPowers[name] || []).map(power => typeof power === 'string' ? power : power.name || power.название || '').filter(Boolean);
        showMasterItem(t('Дисциплина'), name, powers.length ? tf('Способности: {powers}', { powers: powers.join(', ') }) : t('Способности не выбраны'), tf('{dots} точек{sourceSuffix}', { dots, sourceSuffix: sourceText ? ` · ${sourceText}` : '' }));
    });

        // Принудительно обновляем способности при перерисовке строки
    if (selectedPowers[name] && Object.values(disciplineSources[name] || {}).reduce((a,b)=>a+b,0) < selectedPowers[name].length) {
        delete selectedPowers[name];
    }


    list.appendChild(item);

    // === Кнопка "+" с актуальным количеством точек ===
    const addBtn = document.createElement('button');
    addBtn.className = 'add-power-btn';
    addBtn.innerHTML = '+';
    addBtn.title = tf('Добавить способности ({dots} точек)', { dots });
    addBtn.style.cssText = `margin-left:12px;background:#ff3131;color:black;border:none;width:34px;height:34px;border-radius:50%;font-size:22px;cursor:pointer;flex-shrink:0;`;

    addBtn.onclick = (e) => {
        e.stopImmediatePropagation();
        if (startingSheetFixed && !expShopMode) return alert(t("Лист зафиксирован. Способности дисциплин сейчас нельзя менять."));
        openPowerSelectionModal(name, dots);   // используем актуальное dots
    };

    // Вставляем кнопку после названия
    const nameDiv = item.querySelector('.discipline-title');
    if (nameDiv) {
        nameDiv.parentNode.insertBefore(addBtn, nameDiv.nextSibling);
    }
}

function renderShopAvailableDisciplines() {
    if (!expShopMode) return;

    const list = document.getElementById('disciplines-list');
    if (!list) return;
    if (isThinBloodClan()) return;

    let browser = document.getElementById('xp-discipline-shop-browser');
    if (!browser) {
        browser = document.createElement('section');
        browser.id = 'xp-discipline-shop-browser';
        browser.className = 'xp-discipline-browser';
        list.appendChild(browser);
    }

    const availableNames = getStandardDisciplineNames()
        .filter(name => !disciplineSources[name]);
    const visibleNames = getRankedDisciplineNames(availableNames, xpShopDisciplineSearch);

    browser.innerHTML = `
        <header class="xp-discipline-browser-head">
            <div>
                <strong>${t('Дисциплины магазина')}</strong>
                <span>${t('Кликни по точкам, чтобы купить или повысить дисциплину.')}</span>
            </div>
            <small>${tf('Найдено: {count}', { count: visibleNames.length })}</small>
        </header>
        <label class="xp-discipline-search">
            <span>${t('Умный поиск дисциплины')}</span>
            <input id="xp-discipline-shop-search" type="search" value="${escapeHTML(xpShopDisciplineSearch)}"
                placeholder="${t('Например: кровь, скорость, животные, контроль, скрытность...')}">
        </label>
        <div id="xp-discipline-shop-results" class="xp-discipline-results"></div>
    `;

    const results = browser.querySelector('#xp-discipline-shop-results');
    if (!visibleNames.length) {
        results.innerHTML = `<p class="large-list-empty">${t('Ничего не найдено. Попробуй другое ключевое слово.')}</p>`;
    }

    visibleNames.forEach(name => {

        const item = document.createElement('div');
        item.className = 'discipline-item xp-shop-discipline-option';
        item.dataset.disciplineName = name;

        let dotsHTML = '';
        for (let i = 1; i <= 5; i++) {
            const priceTitle = expShopMode ? ` title="${tf('До {i}: {cost} XP', { i, cost: getDisciplinePreviewCost(name, i) })}"` : '';
            dotsHTML += `<div class="disc-dot" data-level="${i}"${priceTitle}></div>`;
        }

        item.innerHTML = `
            <div class="discipline-heading">
                <button type="button" class="discipline-title" aria-expanded="false" style="color:#777;">${name}<span aria-hidden="true">⌄</span></button>
                <div class="dots-discipline">${dotsHTML}</div>
                <small class="discipline-source" style="color:#664400;">${t('доступно в магазине')}<br>${t(expShopDisciplineMode)} • ×${getDisciplineMultiplier(name)}</small>
            </div>
            <div class="discipline-details" hidden>${getDisciplineDetailsHTML(name)}</div>
        `;

        setupDisciplineDetails(item, name);

        results.appendChild(item);
    });

    const search = browser.querySelector('#xp-discipline-shop-search');
    if (search) {
        search.addEventListener('input', () => {
            xpShopDisciplineSearch = search.value;
            renderShopAvailableDisciplines();
            const restored = document.getElementById('xp-discipline-shop-search');
            if (restored) {
                restored.focus();
                const cursor = restored.value.length;
                restored.setSelectionRange(cursor, cursor);
            }
        });
    }
}

function renderDisciplines() {
    document.getElementById('xp-discipline-shop-browser')?.remove();
    document.querySelectorAll('.xp-shop-discipline-option').forEach(item => item.remove());

    document.querySelectorAll('.discipline-item').forEach(item => {
        const nameEl = item.querySelector('.discipline-title');
        if (!nameEl) return;
        const discName = item.dataset.disciplineName || nameEl.textContent.trim();

        // Удаляем старые кнопки и панели
        item.querySelectorAll('.add-power-btn, .powers-panel').forEach(el => el.remove());

        const currentDots = Object.values(disciplineSources[discName] || {}).reduce((a,b) => a + b, 0);

        if (currentDots < 1) return;

        // Кнопка "+"
        const addBtn = document.createElement('button');
        addBtn.className = 'add-power-btn';
        addBtn.innerHTML = '+';
        addBtn.title = tf('Добавить способности ({dots} точек)', { dots: currentDots });
        addBtn.style.cssText = `margin-left:12px;background:#ff3131;color:black;border:none;width:34px;height:34px;border-radius:50%;font-size:22px;cursor:pointer;flex-shrink:0;`;

        addBtn.onclick = (e) => {
            e.stopImmediatePropagation();
            openPowerSelectionModal(discName, currentDots);
        };

        nameEl.parentNode.insertBefore(addBtn, nameEl.nextSibling);

        // Панель известных сил
        const knownPowers = getKnownDisciplinePowersForFullSheet(discName);
        if (knownPowers.length > 0) {
            const panel = document.createElement('div');
            panel.className = 'powers-panel';
            panel.innerHTML = `
                <strong>${t('Известные силы')}</strong>
                <div class="power-list">
                    ${knownPowers.map(power => {
                        const powerName = power.name;
                        return `
                            <section class="power-entry">
                                <button type="button" class="power-title" aria-expanded="false">
                                    <span>${escapeHTML(powerName)} <small style="color:#777;">${tf('ур. {level}', { level: power.level })}${power.path ? ` · ${escapeHTML(power.path)}` : ''}</small></span><i aria-hidden="true">⌄</i>
                                </button>
                                <div class="power-details" hidden>
                                    ${getPowerDetailsHTML(discName, powerName, power.path || '')}
                                    ${getPowerActionHTML(power)}
                                </div>
                            </section>
                        `;
                    }).join('')}
                </div>
            `;
            setupPowerDetails(panel);
            item.appendChild(panel);
        }
    });

    renderShopAvailableDisciplines();
    renderDerivedStatsPanel();
}

// ==================== ПОДТВЕРЖДЕНИЕ ====================

function confirmClanDisciplines(clanName) {
    const disc2 = document.getElementById('clan-disc-2').value;
    const disc1 = document.getElementById('clan-disc-1').value;
    if (disc1 && disc2 && disc1 === disc2) {
        return alert(t("Выберите две разные дисциплины."));
    }
    
    const clanSource = `${t("Клан")} ${clanName}`;
    removeDisciplineSource(clanSource);
    if (disc2) setDisciplineSource(disc2, 2, clanSource);
    if (disc1) setDisciplineSource(disc1, 1, clanSource);

    closeClanDiscModal();
    notifySheetChoice('clanDisciplines', clanName);
}

function confirmPredatorDiscipline(predatorName) {
    const disc = document.getElementById('pred-disc-select').value;
    if (!disc) return alert(t("Выберите дисциплину!"));
    if (!canUseDiscipline(disc) || isThinBloodClan()) return alert(t('Эта дисциплина недоступна текущему клану.'));

    const predatorSource = `${t("Охота")}: ${predatorName}`;
    removeDisciplineSource(predatorSource);
    setDisciplineSource(disc, 1, predatorSource);

    closePredDiscModal();
    notifySheetChoice('predatorDiscipline', predatorName);
}
// ==================== МОДАЛЬНЫЕ ОКНА ДЛЯ ВЫБОРА ДИСЦИПЛИН ====================

function openClanDisciplineModal(clanName) {
    const clanData = RULES.clans?.[clanName];
    if (isThinBloodClan(clanName)) return;

    const disciplineOptions = isNpcCharacterType()
        ? getStandardDisciplineNames(clanName)
        : isCaitiffClan(clanName)
        ? getStandardDisciplineNames(clanName)
        : (clanData?.disciplines || []).filter(name => canUseDiscipline(name, clanName));

    if (!clanData || disciplineOptions.length < 2) {
        alert(tf("Для клана {clan} нет данных по дисциплинам.", { clan: clanName }));
        return;
    }

    const modalHTML = `
    <div id="clan-disc-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.97);z-index:20000;display:flex;align-items:center;justify-content:center;">
        <div style="background:#111;border:3px solid #ff3131;padding:40px;width:960px;border-radius:10px;max-width:95%; display:flex; gap:30px;">
            <div style="flex:1;">
                <h2 style="color:#ff3131;text-align:center;margin:0 0 20px;">${clanName}</h2>
                <p style="text-align:center;color:#ccc;margin-bottom:30px;">${t('Выбери стартовые дисциплины клана')}</p>

                <div style="margin-bottom:25px;">
                    <label style="display:block;color:#ffae00;margin-bottom:8px;font-weight:bold;">${t('Дисциплина на')} <span style="color:#ff3131">${t('2 точки')}</span>:</label>
                    <select id="clan-disc-2" style="width:100%;padding:12px;background:#000;color:white;border:1px solid #555;font-size:16px;" onchange="showDisciplineHint(this.value)">
                        ${disciplineOptions.map(d => `<option value="${d}">${d}</option>`).join('')}
                    </select>
                </div>

                <div style="margin-bottom:35px;">
                    <label style="display:block;color:#ffae00;margin-bottom:8px;font-weight:bold;">${t('Дисциплина на')} <span style="color:#ff3131">${t('1 точку')}</span>:</label>
                    <select id="clan-disc-1" style="width:100%;padding:12px;background:#000;color:white;border:1px solid #555;font-size:16px;" onchange="showDisciplineHint(this.value)">
                        ${disciplineOptions.map(d => `<option value="${d}">${d}</option>`).join('')}
                    </select>
                </div>

                <div style="display:flex;gap:12px;justify-content:space-between;">
                    <button onclick="closeClanDiscModal()"
                            style="background:#333;color:white;padding:15px 35px;border:none;font-size:18px;border-radius:6px;cursor:pointer;">
                        ${t('Отмена')}
                    </button>
                    <button onclick="confirmClanDisciplines('${clanName}')"
                            style="background:#ff3131;color:black;padding:15px 45px;border:none;font-size:18px;border-radius:6px;cursor:pointer;">
                         ${t('Подтвердить')}
                    </button>
                </div>
            </div>

            <div id="discipline-hint-panel" style="width:380px; background:#0a0a0a; border:1px solid #333; border-radius:8px; padding:20px; color:#ddd; font-size:14.5px; line-height:1.6; overflow-y:auto; max-height:520px;">
                <p style="color:#666; text-align:center; font-style:italic;">${t('Выберите дисциплину слева')}</p>
            </div>
        </div>
    </div>`;

    document.getElementById('clan-disc-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function openPredatorDisciplineModal(predName) {
    const predData = RULES.predator_types?.[predName];
    if (!predData) return;

    if (isThinBloodClan()) {
        applyPredatorChoiceItems(predName);
        return;
    }

    const hasDisciplines = predData.disciplines?.increase?.options?.length > 0;
    if (!hasDisciplines) {
        console.log(`ℹ️ Для ${predName} нет дисциплин`);
        applyPredatorChoiceItems(predName);
        return;
    }

    const clanName = document.getElementById('clan-input')?.value || '';
    let options = [...predData.disciplines.increase.options].filter(name => canUseDiscipline(name));
    if (clanName !== vtmName('Тремер') && predData.disciplines.increase.restriction?.toLowerCase().includes(vtmName('тремер'))) {
        options = options.filter(option => option !== vtmName('Кровавое чародейство'));
    }
    if (options.length === 0) {
        alert(tf('Для стиля «{pred}» нет доступной дисциплины с текущим кланом.', { pred: predName }));
        applyPredatorChoiceItems(predName);
        return;
    }

    const value = predData.disciplines.increase.value || 1;

    const modalHTML = `
    <div id="pred-disc-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.97);z-index:20000;display:flex;align-items:center;justify-content:center;">
        <div style="background:#111;border:3px solid #ff3131;padding:40px;width:620px;border-radius:10px;">
            <h2 style="color:#ff3131;text-align:center;margin:0 0 25px;">${predName}</h2>
            <p style="text-align:center;color:#ccc;margin-bottom:25px;">${tf('Выбери дисциплину (+{value} точка)', { value })}</p>

            <select id="pred-disc-select" style="width:100%;padding:14px;background:#000;color:white;border:1px solid #555;font-size:17px;margin-bottom:30px;">
                ${options.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>

            <div style="display:flex;gap:12px;justify-content:space-between;">
                <button onclick="closePredDiscModal()"
                        style="background:#333;color:white;padding:14px 35px;border:none;font-size:17px;border-radius:6px;">
                    ${t('Отмена')}
                </button>
                <button onclick="confirmPredatorDiscipline('${predName}')"
                        style="background:#ff3131;color:black;padding:14px 40px;border:none;font-size:17px;border-radius:6px;">
                    ${t('Подтвердить')}
                </button>
            </div>
        </div>
    </div>`;

    document.getElementById('pred-disc-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeClanDiscModal() {
    document.getElementById('clan-disc-modal')?.remove();
}

function closePredDiscModal() {
    document.getElementById('pred-disc-modal')?.remove();
}

function openNpcDisciplineModal() {
    if (currentCharType !== 'npc-vampire') return;
    if (startingSheetFixed && !expShopMode) {
        alert(t("Лист зафиксирован. Дисциплины сейчас нельзя менять."));
        return;
    }

    const names = Object.keys(RULES.disciplines || {}).sort();
    if (!names.length) return alert(t('Список дисциплин ещё не загрузился.'));

    const modalHTML = `
    <div id="npc-discipline-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:20000;display:flex;align-items:center;justify-content:center;padding:20px;">
        <div style="background:#111;border:2px solid #a14600;padding:28px;width:min(520px,95vw);border-radius:10px;">
            <h2 style="color:#ffae00;text-align:center;margin:0 0 18px;">${t('Дисциплина НПС')}</h2>
            <p style="color:#aaa;line-height:1.45;">${expShopMode
                ? t('Для НПС список не ограничен кланом. Добавление попадёт в чек магазина опыта.')
                : t('Для НПС список не ограничен кланом. После добавления уровень можно менять точками прямо в листе.')}</p>
            <select id="npc-discipline-select" style="width:100%;padding:12px;background:#050505;color:white;border:1px solid #555;font-size:16px;">
                ${names.map(name => `<option value="${name}">${name}</option>`).join('')}
            </select>
            <div style="display:flex;gap:10px;margin-top:20px;">
                <button type="button" onclick="closeNpcDisciplineModal()" style="flex:1;padding:12px;background:#333;color:white;border:none;border-radius:6px;cursor:pointer;">${t('Отмена')}</button>
                <button type="button" onclick="addNpcDiscipline()" style="flex:1;padding:12px;background:#a14600;color:white;border:none;border-radius:6px;cursor:pointer;">${t('Добавить')}</button>
            </div>
        </div>
    </div>`;

    document.getElementById('npc-discipline-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function addNpcDiscipline() {
    const name = document.getElementById('npc-discipline-select')?.value;
    if (!name) return;
    if (!disciplineSources[name]) disciplineSources[name] = { 'НПС вручную': 1 };
    updateAllDisciplineRows();
    updateDisciplineTotal();
    renderDisciplines();
    updateVitals();
    if (expShopMode) {
        updateExpPurchasedStyles();
        renderExpShopPanel();
    }
    closeNpcDisciplineModal();
}

function closeNpcDisciplineModal() {
    document.getElementById('npc-discipline-modal')?.remove();
}

// Подсказка по дисциплине в модальном окне
function showDisciplineHint(discName) {
    const panel = document.getElementById('discipline-hint-panel');
    if (!panel) return;

    if (!discName) {
        panel.innerHTML = `<p style="color:#666;text-align:center;font-style:italic;">${t('Выберите дисциплину')}</p>`;
        return;
    }

    const disc = RULES.disciplines?.[discName];
    if (!disc) {
        panel.innerHTML = `<p style="color:#ffae00;">${tf('Дисциплина не найдена: {name}', { name: `<strong>${discName}</strong>` })}</p>`;
        return;
    }

    let html = `
        <h3 style="color:#ff3131; margin:0 0 12px;">${discName}</h3>
        <div style="color:#ddd; line-height:1.65;">
            ${disc.description || t('Описание отсутствует')}
        </div>
    `;

    if (disc.system) {
        html += `
            <div style="margin-top:15px; background:#1a1a1a; padding:10px; border-radius:6px; font-size:13.5px;">
                <strong>${t('Тип')}:</strong> ${disc.system.type || '—'}<br>
                <strong>${t('Маскарад')}:</strong> ${disc.system.masquerade || '—'}
                ${disc.system.resonance ? `<br><strong>${t('Резонанс')}:</strong> ${disc.system.resonance}` : ''}
                ${disc.system.limitations ? `<br><strong>${t('Ограничения')}:</strong> ${disc.system.limitations}` : ''}
            </div>
        `;
    }

    panel.innerHTML = html;
}

// ==================== СБРОС + ОТКРЫТИЕ ГАЛЕРЕИ ====================
function resetClanDisciplines() {
    console.log("=== СБРОС КЛАНА ЗАПУЩЕН ===");
    console.log("Текущие disciplineSources:", JSON.parse(JSON.stringify(disciplineSources)));

    const huntBackup = {};

    Object.keys(disciplineSources).forEach(disc => {
        Object.keys(disciplineSources[disc]).forEach(src => {
            if (src.includes(t("Охота"))) {
                if (!huntBackup[disc]) huntBackup[disc] = {};
                huntBackup[disc][src] = disciplineSources[disc][src];
                console.log(`   ✅ НАЙДЕНО ОТ ОХОТЫ: ${disc} ← ${src} (${disciplineSources[disc][src]} точек)`);
            }
        });
    });

    console.log("💾 huntBackup:", JSON.parse(JSON.stringify(huntBackup)));

    // Очищаем
    disciplineSources = {};
    clanProvidedDisciplines = {};

    // Восстанавливаем
    Object.keys(huntBackup).forEach(disc => {
        disciplineSources[disc] = { ...huntBackup[disc] };
        const total = Object.values(disciplineSources[disc]).reduce((a,b) => a+b, 0);
        const text = Object.keys(disciplineSources[disc]).join(" + ");
        console.log(`   🔥 ВОССТАНОВЛЕНО: ${disc} → ${total} (${text})`);
    });

    console.log("Итоговые disciplineSources после восстановления:", JSON.parse(JSON.stringify(disciplineSources)));

    updateAllDisciplineRows();
    updateDisciplineTotal();
    renderDisciplines();
}

// ==================== СБРОС ОХОТЫ (оставляем Клан) ====================
function resetPredatorDisciplines() {
    console.log("🗑️ СБРОС ОХОТЫ — сохраняем только КЛАН");

    const clanBackup = {};

    Object.keys(disciplineSources).forEach(disc => {
        const sources = disciplineSources[disc];
        Object.keys(sources).forEach(src => {
            if (src.includes(t("Клан"))) {
                if (!clanBackup[disc]) clanBackup[disc] = {};
                clanBackup[disc][src] = sources[src];
            }
        });
    });

    disciplineSources = {};
    predatorProvidedDisciplines = {};
    selectedMerits = selectedMerits.filter(item => !item.fromPredator);
    selectedFlaws = selectedFlaws.filter(item => !item.fromPredator);

    Object.keys(clanBackup).forEach(disc => {
        disciplineSources[disc] = { ...clanBackup[disc] };
        const total = Object.values(disciplineSources[disc]).reduce((a, b) => a + b, 0);
        const text = Object.keys(disciplineSources[disc]).join(" + ");
        
        console.log(`   ✅ Восстановлено от Клана: ${disc} → ${total} (${text})`);
    });

    resetPredatorSpecialties();

    document.querySelectorAll('#pred-disc-modal, #spec-choice-modal').forEach(m => m.remove());

    updateAllDisciplineRows();
    updateDisciplineTotal();
    renderDisciplines();
    renderSelectedMeritsFlaws();
}

// Сброс специализаций от предыдущего стиля охоты
// ==================== СБРОС ТОЛЬКО СПЕЦИАЛИЗАЦИЙ ОТ ОХОТЫ ====================
// ==================== СБРОС ТОЛЬКО ОТ ОХОТЫ (включая точку) ====================
function resetPredatorSpecialties() {
    console.log("🔄 Сбрасываем специализации + автоматические точки от предыдущей охоты");

    let removedCount = 0;

    document.querySelectorAll('.skill-spec-line').forEach(line => {
        const input = line.querySelector('input[type="text"]');
        if (input && input.value.includes('(от охоты)')) {
            const skillName = line.closest('.skill-specs').id.replace('specs-', '');
            
            // Удаляем строку специализации
            line.remove();
            removedCount++;

            // Сбрасываем точку в навыке (если она была добавлена автоматически)
            const radios = document.querySelectorAll(`input[name="${skillName}"]`);
            const currentDot = document.querySelector(`input[name="${skillName}"]:checked`);
            
            if (currentDot && parseInt(currentDot.value) === 1) {
                // Сбрасываем на 0
                radios.forEach(r => r.checked = false);
                const zeroRadio = document.querySelector(`input[name="${skillName}"][value="0"]`);
                if (zeroRadio) zeroRadio.checked = true;
            }
        }
    });

    // Обновляем всё
    document.querySelectorAll('.spec-checkbox').forEach(checkbox => {
        const skillName = checkbox.id.replace('s-', '');
        const container = document.getElementById('specs-' + skillName);
        
        if (container && container.children.length === 0) {
            checkbox.checked = false;
        }
        updateSBadgeState(skillName);
    });

    updateTrackers();

    console.log(`✅ Удалено ${removedCount} специализаций + автоматические точки от охоты`);
}





function updateAllDisciplineRows() {
    const list = document.getElementById('disciplines-list');
    if (list) list.innerHTML = '';

    pruneSelectedPowersForCurrentDisciplines();
    Object.keys(disciplineSources).forEach(name => {
        if (disciplineSources[name]) {
            const total = Object.values(disciplineSources[name]).reduce((a,b)=>a+b,0);
            const text = Object.keys(disciplineSources[name]).join(" + ");
            addDisciplineRow(name, total, text);
        }
    });
    renderDerivedStatsPanel();
}

function openPowerSelectionModal(discName, maxLevel) {
    const disc = RULES.disciplines?.[discName];
    if (!disc?.powers) {
        alert(tf('Нет способностей для {discName}', { discName }));
        return;
    }

    let selected = [...(selectedPowers[discName] || [])];

    const modalHTML = `
    <div id="power-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.97);z-index:25000;display:flex;align-items:center;justify-content:center;">
        <div style="background:#111;border:3px solid #ff3131;padding:30px;width:1100px;border-radius:12px;max-width:96%;max-height:92vh;display:flex;gap:25px;">
            
            <div style="flex:1;">
                <h2 style="color:#ff3131;text-align:center;margin:0 0 20px;">
                    ${discName} — ${t('Выбор способностей')}
                    <span id="power-count" style="color:#ffae00;">(${selected.length}/${maxLevel})</span>
                </h2>
                <label class="power-search">
                    <span>${t('Поиск способности')}</span>
                    <input id="power-search" type="search" placeholder="${t('Название, эффект, бросок, стоимость...')}">
                    <small id="power-search-count"></small>
                </label>
                <div id="power-list" style="overflow-y:auto;padding:10px;height:65vh;display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:14px;"></div>
            </div>

            <div id="power-hint-panel" style="width:420px; background:#0a0a0a; border:1px solid #333; border-radius:8px; padding:25px; color:#ddd; font-size:14.8px; line-height:1.65; overflow-y:auto; max-height:75vh;">
                <p style="color:#666; text-align:center; font-style:italic;">${t('Выберите способность слева, чтобы увидеть описание')}</p>
            </div>
        </div>

        <div style="position:absolute; bottom:40px; left:50%; transform:translateX(-50%); display:flex; gap:15px;">
            <button id="power-cancel-btn" style="background:#333;color:white;padding:14px 40px;border:none;border-radius:8px;font-size:16px;">${t('Отмена')}</button>
            <button id="power-confirm-btn" style="background:#ff3131;color:black;padding:14px 40px;border:none;border-radius:8px;font-size:16px;">${t('Подтвердить')}</button>
        </div>
    </div>`;

    document.getElementById('power-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const listContainer = document.getElementById('power-list');
    const hintPanel = document.getElementById('power-hint-panel');

    function renderPowerCards() {
        listContainer.innerHTML = '';
        const searchValue = document.getElementById('power-search')?.value || '';
        let visibleCount = 0;
        
        for (let lvl = 1; lvl <= maxLevel; lvl++) {
            if (!disc.powers[lvl]) continue;

            Object.keys(disc.powers[lvl]).forEach(powerName => {
                const power = disc.powers[lvl][powerName];
                if (searchValue && scorePowerSearch(discName, powerName, power, lvl, searchValue) <= 0) return;
                const isSelected = selected.includes(powerName);
                const xpPrice = lvl * 3;
                visibleCount++;

                const card = document.createElement('div');
                card.style.cssText = `
                    background:#1a1a1a; 
                    padding:16px; 
                    border-radius:8px; 
                    border:2px solid ${isSelected ? '#ff3131' : '#444'};
                    cursor: pointer;
                    transition: all 0.2s;
                `;

                card.innerHTML = `
                    <div style="color:#ffae00;font-weight:bold;">${powerName}</div>
                    <div style="color:#666;font-size:13px;">${tf('Уровень {level}', { level: lvl })}</div>
                    <div style="color:#ccc;margin-top:8px;line-height:1.5;">${power.description ? power.description.substring(0, 180) + (power.description.length > 180 ? '...' : '') : t('Нет описания')}</div>
                `;

                card.addEventListener('click', () => {
                    if (isSelected) {
                        selected = selected.filter(p => p !== powerName);
                    } else if (selected.length < maxLevel) {
                        selected.push(powerName);
                    }
                    renderPowerCards();
                    document.getElementById('power-count').textContent = `(${selected.length}/${maxLevel})`;
                });

                card.addEventListener('mouseenter', () => {
                    let html = `
                        <h3 style="color:#ff3131; margin:0 0 12px;">${powerName} <span style="color:#666;font-size:14px;">(${tf('Уровень {level}', { level: lvl })})</span></h3>
                        <div style="line-height:1.65;">${power.description || t('Описание отсутствует')}</div>
                    `;
                    if (power.effect) html += `<p style="margin-top:12px;"><strong>${t('Эффект')}:</strong> ${power.effect}</p>`;
                    const rollSummary = getPowerRollSummary(power);
                    const difficultySummary = getPowerDifficultySummary(power);
                    if (rollSummary) html += `<p style="margin-top:12px;"><strong>${t('Бросок')}:</strong> ${rollSummary}</p>`;
                    if (difficultySummary) html += `<p><strong>${t('Сложность')}:</strong> ${difficultySummary}</p>`;
                    if (power.cost) html += `<p><strong>${t('Стоимость')}:</strong> ${power.cost}</p>`;
                    if (power.duration) html += `<p><strong>${t('Длительность')}:</strong> ${power.duration}</p>`;

                    hintPanel.innerHTML = html;
                });

                listContainer.appendChild(card);
            });
        }

        if (!visibleCount) {
            listContainer.innerHTML = `<p class="large-list-empty" style="grid-column:1/-1;">${t('Ничего не найдено. Попробуй другое ключевое слово.')}</p>`;
        }
        const count = document.getElementById('power-search-count');
        if (count) count.textContent = tf('Найдено: {count}', { count: visibleCount });
    }

    renderPowerCards();

    const powerSearch = document.getElementById('power-search');
    if (powerSearch) powerSearch.addEventListener('input', renderPowerCards);

    // Надёжное назначение кнопок
    const confirmBtn = document.getElementById('power-confirm-btn');
    const cancelBtn = document.getElementById('power-cancel-btn');

    if (confirmBtn) {
        confirmBtn.onclick = () => {
            selectedPowers[discName] = selected;
            closePowerModal();
            renderDisciplines();
            updateVitals();
            if (expShopMode) renderExpShopPanel();
        };
    }

    if (cancelBtn) {
        cancelBtn.onclick = closePowerModal;
    }
}

function closePowerModal() {
    const modal = document.getElementById('power-modal');
    if (modal) modal.remove();
}

window.openPowerSelectionModal = openPowerSelectionModal;

// ==================== МОДАЛЬНЫЙ ВЫБОР СПЕЦИАЛЬНОСТИ ====================
function showSpecialtyChoiceModal(predatorName, options, predData) {
    let html = `
    <div id="spec-choice-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:26000;display:flex;align-items:center;justify-content:center;">
        <div style="background:#111;border:3px solid #ff3131;padding:35px 40px;width:520px;border-radius:12px;">
            <h3 style="color:#ff3131;text-align:center;margin:0 0 25px;">${tf('Выберите специализацию для «{predatorName}»', { predatorName })}</h3>
            
            <div style="display:flex;flex-direction:column;gap:12px;">`;

    options.forEach((opt, i) => {
        html += `
            <button onclick="applyPredatorSpecialty('${predatorName}', '${opt.replace(/'/g, "\\'")}'); closeSpecChoiceModal();" 
                    style="padding:14px 20px;background:#1a1a1a;border:1px solid #444;color:#ddd;font-size:15.5px;border-radius:6px;cursor:pointer;text-align:left;">
                ${opt}
            </button>`;
    });

    html += `</div>
            <button onclick="closeSpecChoiceModal()"
                    style="margin-top:25px;width:100%;padding:12px;background:#333;color:white;border:none;border-radius:6px;cursor:pointer;">
                ${t('Отмена')}
            </button>
        </div>
    </div>`;

    document.getElementById('spec-choice-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
}

function closeSpecChoiceModal() {
    document.getElementById('spec-choice-modal')?.remove();
}

function applyPredatorSpecialty(predatorName, selectedOption) {
    const match = selectedOption.match(/(.+?)\s*\((.+?)\)/);
    let skillName = selectedOption;
    let specText = "";

    if (match) {
        skillName = match[1].trim();
        specText = match[2].trim();
    }

    // Добавляем точку (если ещё нет)
    const firstDot = document.querySelector(`input[name="${skillName}"][value="1"]`);
    if (firstDot) {
        const current = document.querySelector(`input[name="${skillName}"]:checked`);
        if (!current || parseInt(current.value) === 0) {
            firstDot.checked = true;
        }
    }

    // Добавляем/открываем специализацию
    const container = document.getElementById('specs-' + skillName);
    if (container) {
        container.style.display = 'flex';
        
        // Если ещё нет ни одной строки — создаём
        if (container.children.length === 0) {
            addSpecLine(skillName);
        }

        const input = container.querySelector('input[type="text"]');
        if (input && specText) {
            input.value = specText + " (от охоты)";
        }
    }

    // Активируем чекбокс
    const specCheckbox = document.getElementById(`s-${skillName}`);
    if (specCheckbox) specCheckbox.checked = true;

    console.log(`✅ Применена специализация от охоты: ${skillName} (${specText})`);

    closeSpecChoiceModal();
    const predData = RULES.predator_types?.[predatorName];
    const hasDisciplines = predData?.disciplines?.increase?.options && predData.disciplines.increase.options.length > 0;
    if (hasDisciplines) {
        setTimeout(() => openPredatorDisciplineModal(predatorName), 250);
    } else {
        setTimeout(() => applyPredatorChoiceItems(predatorName), 250);
    }

    updateTrackers();
    updateSBadgeState(skillName);
}


// ==================== ИКОНКИ КЛАНОВ ====================




// Временные данные для иконок (можно расширить в rules.json позже)
const CLAN_ICONS = {
    "Бруха": "/vampires/static/emojis/brujah.png",
    "Вентру": "/vampires/static/emojis/ventrue.png",
    "Гангрел": "/vampires/static/emojis/gangrel.png",
    "Малкавиан": "/vampires/static/emojis/malkavian.png",
    "Носферату": "/vampires/static/emojis/nosferatu.png",
    "Тореадор": "/vampires/static/emojis/toreador.png",
    "Тремер": "/vampires/static/emojis/tremere.png",
    "Каитиф": "/vampires/static/emojis/caitiff.png",
    "Слабокровные": "/vampires/static/emojis/thin_blood.png"
};

// Окрашивание иконки в фирменный красный цвет
async function tintImageToRed(imgUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imgUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue; // пропускаем прозрачные пиксели
                data[i] = 255;     // Red
                data[i + 1] = Math.floor(data[i + 1] * 0.1); // Green → почти 0
                data[i + 2] = Math.floor(data[i + 2] * 0.1); // Blue → почти 0
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null);
    });
}

// Кэш окрашенных иконок
const tintedCache = {};

// Получение окрашенной иконки
async function getTintedEmoji(url) {
    if (tintedCache[url]) return tintedCache[url];
    const tinted = await tintImageToRed(url);
    if (tinted) tintedCache[url] = tinted;
    return tinted;
}

// Обновление иконки клана
async function updateClanIcon() {
    const clanName = document.getElementById('clan-input').value;
    const container = document.getElementById('clan-icon-container');
    if (!container) return;

    if (!clanName) {
        container.innerHTML = '';
        return;
    }

    const tintedUrl = await getTintedEmoji(CLAN_ICONS[vtmCanonicalName(clanName)]);
    if (tintedUrl) {
        container.innerHTML = `<img src="${tintedUrl}" class="clan-icon" alt="${clanName}">`;
    } else {
        container.innerHTML = `<span style="font-size:32px; color:#666;">🧛</span>`;
    }
}

// Рендер иконки (вспомогательная)
async function renderClanIcon(clanName) {
    const tintedUrl = await getTintedEmoji(CLAN_ICONS[vtmCanonicalName(clanName)]);
    return tintedUrl 
        ? `<img src="${tintedUrl}" class="clan-icon" alt="${clanName}">` 
        : `<span style="font-size:32px; color:#ff3131;">❌</span>`;
}

// ==================== ГАЛЕРЕЯ КЛАНОВ ====================

const CLAN_GALLERY_IMAGE_OVERRIDES = {
    "Вентру": "/vampires/static/clan_gallery/ventrue_full.png",
    "Каитиф": "/vampires/static/clan_gallery/caitiff_full.png"
};

const CLAN_GALLERY_SECTIONS = [
    {
        title: t("5 версия"),
        names: [
            "Бруха",
            "Вентру",
            "Гангрел",
            "Малкавиан",
            "Носферату",
            "Тореадор",
            "Тремер",
            "Каитиф",
            "Слабокровные"
        ]
    },
    {
        title: t("20 версия"),
        names: [
            "Ассамиты",
            "Джованни",
            "Ласомбра",
            "Последователи Сета",
            "Равнос",
            "Цимисхи"
        ]
    },
    {
        title: t("Линии крови"),
        names: []
    }
];

const CLAN_GALLERY_DESCRIPTIONS = {
    "Бруха": t("Бунтари и идеалисты."),
    "Вентру": t("Аристократы и правители."),
    "Гангрел": t("Дикие дети природы."),
    "Малкавиан": t("Безумные пророки."),
    "Носферату": t("Отверженные хранители тайн."),
    "Тореадор": t("Художники и ценители красоты."),
    "Тремер": t("Маги и учёные крови."),
    "Каитиф": t("Независимые и скрытные."),
    "Слабокровные": t("Самые молодые и слабые вампиры."),
    "Каппадокийцы": t("Некроманты, мистики смерти и хранители забытых тайн."),
    "Киасиды": t("Странные учёные, фейская кровь и холодная одержимость знаниями."),
    "Кровные Братья": t("Синхронная линия крови, созданная как единый боевой организм."),
    "Ламии": t("Воительницы смерти, телохранительницы и служительницы мрачных культов."),
    "Лианнан": t("Древняя кровь дикой земли, искусства и кровавого вдохновения."),
    "Нагараджа": t("Пожиратели плоти, некроманты и изгнанные охотники за тайнами."),
    "Нойады": t("Северная кровь, древние духи и шаманские традиции ночи."),
    "Предвестники Черепов": t("Мстительные некроманты, несущие память о погибшей крови."),
    "Салюбри": t("Исцелители, воины и проклятые носители третьего глаза."),
    "Самеди": t("Разлагающиеся некроманты, духи кладбищ и мастера жуткого выживания.")
};

const CLAN_GALLERY_SUPPLEMENTAL = [
    { name: "Каппадокийцы", image: "/vampires/static/clan_gallery/cappadocians_full.png" },
    { name: "Киасиды", image: "/vampires/static/clan_gallery/kyasid_full.png" },
    { name: "Кровные Братья", image: "/vampires/static/clan_gallery/blood_brothers_full.png" },
    { name: "Ламии", image: "/vampires/static/clan_gallery/lamia_full.png" },
    { name: "Лианнан", image: "/vampires/static/clan_gallery/liannan_full.png" },
    { name: "Нагараджа", image: "/vampires/static/clan_gallery/nagaraja_full.png" },
    { name: "Нойады", image: "/vampires/static/clan_gallery/noiad_full.png" },
    { name: "Предвестники Черепов", image: "/vampires/static/clan_gallery/harbingers_of_skulls_full.png" },
    { name: "Салюбри", image: "/vampires/static/clan_gallery/salubri_full.png" },
    { name: "Самеди", image: "/vampires/static/clan_gallery/samedi_full.png" }
];

const CLAN_SECTION_BY_NAME = CLAN_GALLERY_SECTIONS.reduce((sections, group) => {
    group.names.forEach(name => {
        sections[name] = group.title;
    });
    return sections;
}, {});

const CLAN_SEARCH_SYNONYMS = {
    сила: ['мощь', 'физическая сила', 'физический', 'боевой', 'боец', 'potence', 'strength', 'combat'],
    сильный: ['мощь', 'физическая сила', 'физический', 'боевой', 'potence', 'strength'],
    простой: ['новичкам', 'простой старт', 'понятный отыгрыш', 'beginner', 'easy start', 'clear roleplay'],
    новичок: ['новичкам', 'простой старт', 'понятный отыгрыш', 'beginner friendly', 'easy start'],
    социальный: ['величие', 'харизма', 'политика', 'власть', 'social', 'presence', 'politics'],
    скрытность: ['сокрытие', 'тайны', 'шпионаж', 'stealth', 'obfuscate', 'secrets'],
    магия: ['кровавое чародейство', 'оккультизм', 'blood sorcery', 'occult', 'magic'],
    смерть: ['некромантия', 'мертвые', 'necromancy', 'dead', 'death'],
    выживание: ['стойкость', 'survival', 'fortitude'],
    beginner: ['beginner friendly', 'easy start', 'clear roleplay', 'новичкам', 'простой старт'],
    simple: ['beginner friendly', 'easy start', 'clear roleplay', 'новичкам', 'простой старт'],
    strength: ['physical strength', 'potence', 'combat', 'мощь', 'физическая сила']
};

const SMART_LIST_SEARCH_SYNONYMS = {
    зверь: ['анимализм', 'animalism', 'животные', 'звери'],
    животные: ['анимализм', 'animalism', 'зверь'],
    кровь: ['кровавое чародейство', 'тауматургия', 'blood sorcery', 'thaumaturgy', 'донор', 'vitae'],
    магия: ['кровавое чародейство', 'тауматургия', 'blood sorcery', 'thaumaturgy', 'оккультизм'],
    разум: ['доминирование', 'ясновидение', 'dominate', 'auspex', 'контроль', 'мысли'],
    контроль: ['доминирование', 'dominate', 'приказ', 'разум'],
    скорость: ['стремительность', 'celerity', 'быстрота'],
    быстро: ['стремительность', 'celerity', 'налетчик'],
    сила: ['мощь', 'potence', 'физическая сила'],
    стойкость: ['fortitude', 'выживание', 'защита'],
    защита: ['стойкость', 'fortitude', 'выживание'],
    скрытность: ['сокрытие', 'obfuscate', 'stealth', 'невидимость', 'тайна'],
    тайна: ['сокрытие', 'obfuscate', 'stealth', 'мистификация'],
    облик: ['метаморфозы', 'protean', 'форма', 'тело'],
    форма: ['метаморфозы', 'protean', 'преображение'],
    власть: ['величие', 'presence', 'социальный', 'харизма'],
    социальный: ['величие', 'presence', 'харизма', 'джентльмен', 'идол'],
    смерть: ['некромантия', 'танатозис', 'necromancy', 'death'],
    сон: ['морфей', 'sandman', 'спящий', 'сны'],
    насилие: ['бестия', 'налетчик', 'alleycat', 'blood leech', 'нападение'],
    семья: ['семьянин', 'cleaver', 'близкие'],
    вечеринка: ['тусовщик', 'scene queen', 'клуб', 'тусовка'],
    донор: ['фермер', 'суррогатчик', 'farmer', 'bagger', 'кровь'],
    beginner: ['новичок', 'простой', 'easy', 'simple'],
    stealth: ['сокрытие', 'скрытность', 'obfuscate'],
    social: ['величие', 'presence', 'харизма', 'социальный'],
    magic: ['кровавое чародейство', 'тауматургия', 'blood sorcery'],
    blood: ['кровь', 'blood sorcery', 'фермер', 'суррогатчик'],
    speed: ['стремительность', 'celerity', 'налетчик']
};

function notifySheetChoice(type, value) {
    document.dispatchEvent(new CustomEvent('vtm:sheet-choice', { detail: { type, value } }));
}

function getClanSectionKey(name) {
    const canonical = vtmCanonicalName(name);
    if (CLAN_GALLERY_SECTIONS[0].names.includes(canonical)) return 'v5';
    if (CLAN_GALLERY_SECTIONS[1].names.includes(canonical)) return 'v20';
    return 'legacy';
}

function getClanSectionTitle(name) {
    return CLAN_SECTION_BY_NAME[vtmCanonicalName(name)] || t("Линии крови");
}

function groupClansBySection(clans) {
    return CLAN_GALLERY_SECTIONS
        .map(section => ({
            title: section.title,
            clans: clans.filter(clan => getClanSectionTitle(clan.name) === section.title)
        }))
        .filter(section => section.clans.length);
}

function getClanGalleryDescription(name, data) {
    const canonical = vtmCanonicalName(name);
    if (CLAN_GALLERY_DESCRIPTIONS[canonical]) return CLAN_GALLERY_DESCRIPTIONS[canonical];

    const firstParagraph = (data.description || '').split(/\n+/).find(Boolean) || '';
    const firstSentence = firstParagraph.match(/^.*?[.!?]/u)?.[0] || firstParagraph;

    if (!firstSentence) return t("Описание появится в правилах.");
    return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}...` : firstSentence;
}

function getClanSearchParts(name, data = {}) {
    return [
        name,
        vtmCanonicalName(name),
        data.description,
        data.types,
        data.playstyle,
        data.conflict,
        data.bane,
        ...(data.disciplines || []),
        ...Object.values(data.discipline_description || {}),
        ...(data.archetypes || []),
        ...(data.tags || [])
    ];
}

function buildClanGalleryData() {
    const rulesGalleryData = Object.entries(RULES.clans || {})
        .map(([name, data]) => ({
            name,
            image: CLAN_GALLERY_IMAGE_OVERRIDES[vtmCanonicalName(name)] || data.gallery_image,
            desc: getClanGalleryDescription(name, data),
            tags: Array.isArray(data.tags) ? data.tags : [],
            edition: data.edition || getClanSectionKey(name),
            searchText: normalizeClanSearch(getClanSearchParts(name, data).join(' '))
        }))
        .filter(clan => clan.image);

    const clansWithImages = new Set(rulesGalleryData.map(clan => clan.name));
    const supplementalGalleryData = CLAN_GALLERY_SUPPLEMENTAL
        .filter(clan => !clansWithImages.has(clan.name))
        .map(clan => ({
            ...clan,
            desc: getClanGalleryDescription(clan.name, clan),
            tags: [],
            edition: getClanSectionKey(clan.name),
            searchText: normalizeClanSearch([clan.name, getClanGalleryDescription(clan.name, clan)].join(' '))
        }));

    return [...rulesGalleryData, ...supplementalGalleryData];
}

function buildClanSelectData() {
    const galleryData = buildClanGalleryData();
    const namesWithGalleryData = new Set(galleryData.map(clan => clan.name));
    const rulesOnlyData = Object.keys(RULES.clans || {})
        .filter(name => !namesWithGalleryData.has(name))
        .map(name => ({ name }));

    return [...galleryData, ...rulesOnlyData];
}

function normalizeClanSearch(value) {
    return String(value ?? '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/<[^>]*>/g, ' ')
        .replace(/[^a-zа-я0-9]+/gi, ' ')
        .trim();
}

function stemClanSearchWord(word) {
    if (word.length < 5) return word;
    return word.replace(/(иями|ями|ами|ого|ему|ому|ыми|ими|ая|яя|ое|ее|ые|ие|ий|ый|ой|ам|ям|ах|ях|ом|ем|ов|ев|а|я|ы|и|е|у|ю)$/u, '');
}

function expandClanSearchToken(token) {
    const normalized = normalizeClanSearch(token);
    const synonyms = CLAN_SEARCH_SYNONYMS[normalized] || [];
    return [normalized, ...synonyms.map(normalizeClanSearch)].filter(Boolean);
}

function textHasClanToken(text, token) {
    if (!token) return true;
    if (text.includes(token)) return true;
    const stem = stemClanSearchWord(token);
    if (stem.length < 4) return false;
    return text.split(' ').some(word => stemClanSearchWord(word) === stem);
}

function normalizeSmartSearch(value) {
    return normalizeClanSearch(value);
}

function expandSmartSearchToken(token) {
    const normalized = normalizeSmartSearch(token);
    const synonyms = [
        ...(CLAN_SEARCH_SYNONYMS[normalized] || []),
        ...(SMART_LIST_SEARCH_SYNONYMS[normalized] || [])
    ];
    return [normalized, ...synonyms.map(normalizeSmartSearch)].filter(Boolean);
}

function stringifySearchValue(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(stringifySearchValue).join(' ');
    if (typeof value === 'object') {
        return Object.entries(value)
            .map(([key, item]) => `${key} ${stringifySearchValue(item)}`)
            .join(' ');
    }
    return '';
}

function scoreSmartSearchFields(search, fields) {
    const tokens = normalizeSmartSearch(search).split(' ').filter(Boolean);
    if (!tokens.length) return 1;

    const normalizedFields = fields
        .map(field => {
            if (typeof field === 'string') return { text: normalizeSmartSearch(field), weight: 1 };
            return { text: normalizeSmartSearch(field.text || ''), weight: field.weight || 1 };
        })
        .filter(field => field.text);

    let total = 0;
    for (const token of tokens) {
        const expanded = expandSmartSearchToken(token);
        let tokenScore = 0;
        expanded.forEach(part => {
            normalizedFields.forEach(field => {
                if (textHasClanToken(field.text, part)) tokenScore = Math.max(tokenScore, field.weight);
            });
        });
        if (!tokenScore) return 0;
        total += tokenScore;
    }
    return total;
}

function getDisciplineSearchFields(name) {
    const data = RULES.disciplines?.[name] || {};
    return [
        { text: `${name} ${vtmCanonicalName(name)}`, weight: 24 },
        { text: [data.description, data.system?.type, data.system?.masquerade, data.system?.resonance, data.system?.limitations].filter(Boolean).join(' '), weight: 8 },
        { text: loadDisciplinePowersForFullSheet(name).map(power => [
            power.name,
            power.path,
            power.rule?.description,
            power.rule?.effect,
            power.rule?.cost,
            power.rule?.duration,
            getPowerRollSummary(power.rule || {}),
            getPowerDifficultySummary(power.rule || {})
        ].filter(Boolean).join(' ')).join(' '), weight: 5 },
        { text: stringifySearchValue(data), weight: 2 }
    ];
}

function scoreDisciplineSearch(name, search) {
    return scoreSmartSearchFields(search, getDisciplineSearchFields(name));
}

function getRankedDisciplineNames(names, search) {
    return names
        .map(name => ({ name, score: scoreDisciplineSearch(name, search) }))
        .filter(item => !search || item.score > 0)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ru'))
        .map(item => item.name);
}

function scorePowerSearch(disciplineName, powerName, power, level, search) {
    return scoreSmartSearchFields(search, [
        { text: `${powerName} ${disciplineName}`, weight: 22 },
        { text: tf('Уровень {level}', { level }), weight: 8 },
        { text: [power.description, power.effect, power.cost, power.duration].filter(Boolean).join(' '), weight: 7 },
        { text: [getPowerRollSummary(power), getPowerDifficultySummary(power)].filter(Boolean).join(' '), weight: 5 },
        { text: stringifySearchValue(power), weight: 2 }
    ]);
}

function scoreClanSearch(clan, search) {
    const tokens = normalizeClanSearch(search).split(' ').filter(Boolean);
    if (!tokens.length) return 1;

    const nameText = normalizeClanSearch(`${clan.name} ${vtmCanonicalName(clan.name)}`);
    const tagText = normalizeClanSearch((clan.tags || []).join(' '));
    const disciplineText = normalizeClanSearch((RULES.clans?.[clan.name]?.disciplines || []).join(' '));
    const fullText = clan.searchText || normalizeClanSearch([clan.name, clan.desc, ...(clan.tags || [])].join(' '));

    let total = 0;
    for (const token of tokens) {
        const expanded = expandClanSearchToken(token);
        let tokenScore = 0;
        expanded.forEach(part => {
            if (textHasClanToken(nameText, part)) tokenScore = Math.max(tokenScore, 18);
            if (textHasClanToken(tagText, part)) tokenScore = Math.max(tokenScore, 15);
            if (textHasClanToken(disciplineText, part)) tokenScore = Math.max(tokenScore, 11);
            if (textHasClanToken(fullText, part)) tokenScore = Math.max(tokenScore, 3);
        });
        if (!tokenScore) return 0;
        total += tokenScore;
    }
    return total;
}

function clanAllowedByGalleryOptions(clan, options = currentClanGalleryOptions) {
    const filter = options.editionFilter || 'all';
    if (filter === 'all') return true;
    const key = clan.edition || getClanSectionKey(clan.name);
    if (filter === 'v5_v20') return key === 'v5' || key === 'v20';
    return key === 'v5';
}

function renderClanGalleryList() {
    const gallery = document.getElementById('clan-gallery');
    if (!gallery) return;

    const results = document.getElementById('clan-gallery-results');
    if (!results) return;

    const search = currentClanGallerySearch;
    const ranked = currentClanGalleryBaseData
        .filter(clan => clanAllowedByGalleryOptions(clan))
        .map(clan => ({ clan, score: scoreClanSearch(clan, search) }))
        .filter(item => !search || item.score > 0)
        .sort((a, b) => b.score - a.score || a.clan.name.localeCompare(b.clan.name));

    currentClanData = ranked.map(item => item.clan);
    currentClanIndex = Math.min(currentClanIndex, Math.max(0, currentClanData.length - 1));

    results.innerHTML = '';

    const count = document.getElementById('clan-gallery-count');
    if (count) count.textContent = tf('Найдено: {count}', { count: currentClanData.length });

    if (!currentClanData.length) {
        results.innerHTML = `<p style="grid-column:1/-1;color:#777;text-align:center;padding:60px 20px;">${t('Кланы не найдены. Попробуй другой запрос или фильтр.')}</p>`;
        return;
    }

    groupClansBySection(currentClanData).forEach(group => {
        const heading = document.createElement('div');
        heading.style.gridColumn = '1 / -1';
        heading.innerHTML = `
            <div style="display:flex; align-items:center; gap:18px; margin:22px 0 4px;">
                <div style="height:1px; flex:1; background:linear-gradient(90deg, transparent, #6f1515);"></div>
                <h3 style="margin:0; color:#ff3131; letter-spacing:4px; text-transform:uppercase; font-size:22px; text-align:center;">
                    ${group.title}
                </h3>
                <div style="height:1px; flex:1; background:linear-gradient(90deg, #6f1515, transparent);"></div>
            </div>
        `;
        results.appendChild(heading);

        group.clans.forEach(c => {
            const index = currentClanData.indexOf(c);
            const tags = (c.tags || []).slice(0, 6).map(tag => `
                <span style="display:inline-block;color:#ffcc66;border:1px solid #553500;border-radius:999px;padding:2px 7px;font-size:11px;margin:6px 4px 0 0;">${escapeHTML(tag)}</span>
            `).join('');
            const div = document.createElement('button');
            div.type = 'button';
            div.style.cssText = 'cursor:pointer;text-align:left;background:#0d0d0d;border:1px solid #2a2a2a;border-radius:8px;padding:0;color:inherit;font:inherit;overflow:hidden;';
            div.innerHTML = `
                <img src="${c.image}" alt="${escapeHTML(c.name)}" style="width:100%; max-height:60vh; object-fit:contain; border-bottom:2px solid #550000; background:#050505;">
                <div style="padding:14px 16px 17px;">
                    <h3 style="color:#ff3131; margin:0 0 8px; text-align:center;">${t(c.name)}</h3>
                    <p style="color:#ddd; font-size:14px; margin:0; line-height:1.45;">${escapeHTML(c.desc)}</p>
                    ${tags ? `<div style="margin-top:8px;">${tags}</div>` : ''}
                </div>
            `;
            div.onclick = () => {
                currentClanIndex = index;
                showSingleClan(c);
            };
            results.appendChild(div);
        });
    });
}

function renderClanGalleryShell() {
    const gallery = document.getElementById('clan-gallery');
    if (!gallery) return;

    gallery.innerHTML = `
        <div style="grid-column:1/-1;display:grid;gap:10px;margin-bottom:6px;">
            <label style="display:grid;gap:7px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">
                ${t('Поиск по кланам')}
                <input id="clan-gallery-search" type="search" value="${escapeHTML(currentClanGallerySearch)}"
                    placeholder="${t('Например: сила, простой, магия, скрытность...')}"
                    style="width:100%;box-sizing:border-box;background:#050505;border:1px solid #444;border-radius:6px;color:#eee;padding:11px 13px;font:inherit;font-size:15px;">
            </label>
            <div id="clan-gallery-count" style="color:#777;font-size:13px;"></div>
        </div>
        <div id="clan-gallery-results" style="display:contents;"></div>
    `;

    const search = document.getElementById('clan-gallery-search');
    if (search) {
        search.addEventListener('input', () => {
            currentClanGallerySearch = search.value;
            renderClanGalleryList();
        });
    }

    renderClanGalleryList();
    search?.focus();
}

function returnToClanGalleryList() {
    renderClanGalleryShell();
}

// Открытие галереи кланов
function openClanGallery(options = {}) {
    if (startingSheetFixed && !expShopMode) return;
    const modal = document.getElementById('clan-modal');
    const gallery = document.getElementById('clan-gallery');
    if (!modal || !gallery) return;

    currentClanGalleryOptions = typeof options === 'object' && options ? options : {};
    currentClanGalleryBaseData = buildClanGalleryData();
    currentClanGallerySearch = currentClanGalleryOptions.search || '';
    currentClanIndex = 0;

    renderClanGalleryShell();
    modal.style.display = 'block';
}


// ==================== КНОПКИ ГАЛЕРЕЙ ====================

function resetAndOpenClanGallery() {
    if (startingSheetFixed && !expShopMode) return;
    openClanGallery();
}

function resetAndOpenPredatorGallery() {
    if (startingSheetFixed && !expShopMode) return;
    openPredatorGallery();
}

async function showSingleClan(clan) {
    const gallery = document.getElementById('clan-gallery');
    const data = RULES.clans?.[vtmName(vtmCanonicalName(clan.name))] || {};

    let html = `
        <div style="text-align:center; padding:20px; max-width:1100px; margin:0 auto; position:relative;">
            
            <!-- Блок с изображением и стрелками -->
            <div style="position:relative; display:inline-block;">
                
                <button onclick="prevClan()" 
                        style="position:absolute; left: -50px; top: 50%; transform: translateY(-50%); 
                               background: rgba(0,0,0,0.85); color: #ff3131; border: 2px solid #ff3131; 
                               width: 70px; height: 70px; border-radius: 50%; font-size: 32px; 
                               cursor: pointer; z-index: 25; box-shadow: 0 0 25px rgba(255,49,49,0.6);">
                    ←
                </button>

                <button onclick="nextClan()" 
                        style="position:absolute; right: -50px; top: 50%; transform: translateY(-50%); 
                               background: rgba(0,0,0,0.85); color: #ff3131; border: 2px solid #ff3131; 
                               width: 70px; height: 70px; border-radius: 50%; font-size: 32px; 
                               cursor: pointer; z-index: 25; box-shadow: 0 0 25px rgba(255,49,49,0.6);">
                    →
                </button>

                <img src="${clan.image}" style="max-width:100%; max-height:65vh; border:4px solid #ff3131; border-radius:12px; box-shadow:0 0 40px rgba(255,49,49,0.6);">
            </div>

            <h2 style="color:#ff3131; margin:25px 0 15px;">${t(clan.name)}</h2>

            <div style="background:#1a1a1a; border:1px solid #ff3131; border-radius:8px; padding:25px; text-align:left; font-size:15px; line-height:1.7;">
    `;

    if (data.description) html += `<p style="color:#ddd;">${data.description}</p>`;

    if (data.types) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ffae00;">${t('Типичные представители:')}</strong><br>
                 <span style="color:#ccc;">${data.types}</span>`;
    }

    if (data.disciplines && data.disciplines.length) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ffae00;">${t('Дисциплины:')}</strong><br>`;
        data.disciplines.forEach(d => {
            const desc = data.discipline_description?.[d] || '';
            html += `• <strong>${d}</strong> — ${desc}<br>`;
        });
    }

    if (data.bane) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ff6666;">${t('Проклятие:')}</strong>
                 <span style="color:#ff9999;">${data.bane}</span>`;
    }

    if (data.playstyle) html += `<hr style="border-color:#333;margin:20px 0;"><strong style="color:#ffae00;">${t('Стиль игры:')}</strong><br>${data.playstyle}`;
    if (data.conflict) html += `<hr style="border-color:#333;margin:20px 0;"><strong style="color:#ffae00;">${t('Внутренний конфликт:')}</strong><br>${data.conflict}`;

    if (data.archetypes && data.archetypes.length) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ffae00;">${t('Архетипы:')}</strong><br>`;
        data.archetypes.forEach(a => html += `• ${a}<br>`);
    }

    html += `
            </div>

            <div style="margin-top:25px;">
                <button onclick="selectThisClan('${vtmName(vtmCanonicalName(clan.name))}')"
                        style="background:#ff3131; color:black; border:none; padding:16px 40px; font-size:18px; border-radius:6px; cursor:pointer; margin:0 10px;">
                    ${t('Выбрать этот клан')}
                </button>
                <button onclick="returnToClanGalleryList()"
                        style="background:transparent; color:#ff3131; border:2px solid #ff3131; padding:16px 40px; font-size:18px; border-radius:6px; cursor:pointer;">
                    ← ${t('Назад к списку')}
                </button>
            </div>
        </div>
    `;

    gallery.innerHTML = html;
}




// ==================== ГАЛЕРЕЯ СТИЛЕЙ ОХОТЫ ====================


function getPredatorGallerySeedData() {
    return [
        { name: "Бестия",       desc: t("Насильственный стиль. Быстрое и грубое нападение."), image: "/vampires/static/predator_gallery/Бестия.png" },
        { name: "Джентльмен",   desc: t("Изысканный и расчётливый подход к охоте."), image: "/vampires/static/predator_gallery/Джентльмен.png" },
        { name: "Идол",         desc: t("Питание через поклонение и обожание."), image: "/vampires/static/predator_gallery/Идол.png" },
        { name: "Искуситель",   desc: t("Соблазнение и манипуляция жертвой."), image: "/vampires/static/predator_gallery/Искуситель.png" },
        { name: "Морфей",       desc: t("Охота через сны и воздействие на спящих."), image: "/vampires/static/predator_gallery/Морфей.png" },
        { name: "Налётчик",     desc: t("Стремительные налёты и быстрый отход."), image: "/vampires/static/predator_gallery/Налётчик.png" },
        { name: "Семьянин",     desc: t("Питание от членов семьи или близкого круга."), image: "/vampires/static/predator_gallery/Семьянин.png" },
        { name: "Суррогатчик",  desc: t("Использование посредников и суррогатов."), image: "/vampires/static/predator_gallery/Суррогатчик.png" },
        { name: "Тусовщик",     desc: t("Охота на вечеринках и в тусовках."), image: "/vampires/static/predator_gallery/Тусовщик.png" },
        { name: "Фермер",       desc: t("Содержание «фермы» из смертных доноров."), image: "/vampires/static/predator_gallery/Фермер.png" }
    ];
}

function getPredatorRuleData(name) {
    return RULES.predator_types?.[vtmName(name)] || RULES.predator_types?.[name] || {};
}

function getPredatorGallerySearchParts(predator) {
    const data = getPredatorRuleData(predator.name);
    return [
        predator.name,
        vtmName(predator.name),
        vtmCanonicalName(predator.name),
        predator.desc,
        data.description,
        ...(data.specialty?.options || []),
        ...(data.disciplines?.increase?.options || []),
        ...(data.advantages || []).map(item => formatPredatorTraitLine(item, true)),
        ...(data.disadvantages || []).map(item => formatPredatorTraitLine(item, false)),
        stringifySearchValue(data)
    ];
}

function buildPredatorGalleryData() {
    return getPredatorGallerySeedData().map(predator => ({
        ...predator,
        searchText: normalizeSmartSearch(getPredatorGallerySearchParts(predator).join(' '))
    }));
}

function scorePredatorSearch(predator, search) {
    const data = getPredatorRuleData(predator.name);
    return scoreSmartSearchFields(search, [
        { text: `${predator.name} ${vtmName(predator.name)} ${vtmCanonicalName(predator.name)}`, weight: 24 },
        { text: [predator.desc, data.description].filter(Boolean).join(' '), weight: 8 },
        { text: [...(data.specialty?.options || []), ...(data.disciplines?.increase?.options || [])].join(' '), weight: 7 },
        { text: predator.searchText || getPredatorGallerySearchParts(predator).join(' '), weight: 2 }
    ]);
}

function renderPredatorGalleryList() {
    const results = document.getElementById('predator-gallery-results');
    if (!results) return;

    const search = currentPredatorGallerySearch;
    const ranked = currentPredatorGalleryBaseData
        .map(predator => ({ predator, score: scorePredatorSearch(predator, search) }))
        .filter(item => !search || item.score > 0)
        .sort((a, b) => b.score - a.score || a.predator.name.localeCompare(b.predator.name, 'ru'));

    currentPredatorData = ranked.map(item => item.predator);
    currentPredatorIndex = Math.min(currentPredatorIndex, Math.max(0, currentPredatorData.length - 1));
    results.innerHTML = '';

    const count = document.getElementById('predator-gallery-count');
    if (count) count.textContent = tf('Найдено: {count}', { count: currentPredatorData.length });

    if (!currentPredatorData.length) {
        results.innerHTML = `<p class="large-list-empty">${t('Ничего не найдено. Попробуй другое ключевое слово.')}</p>`;
        return;
    }

    currentPredatorData.forEach((p, index) => {
        const data = getPredatorRuleData(p.name);
        const disciplines = data.disciplines?.increase?.options?.length
            ? `<span>${t('Дисциплины:')} ${escapeHTML(data.disciplines.increase.options.join(' / '))}</span>`
            : '';
        const specialty = data.specialty?.options?.length
            ? `<span>${t('Специализация:')} ${escapeHTML(data.specialty.options.slice(0, 3).join(' / '))}</span>`
            : '';
        const div = document.createElement('button');
        div.type = 'button';
        div.className = 'large-list-card predator-gallery-card';
        div.innerHTML = `
            <img src="${p.image}" alt="${escapeHTML(t(p.name))}">
            <span class="large-list-card-body">
                <strong>${t(p.name)}</strong>
                <small>${escapeHTML(p.desc)}</small>
                ${disciplines || specialty ? `<em>${disciplines}${specialty}</em>` : ''}
            </span>
        `;
        div.onclick = () => {
            currentPredatorIndex = index;
            showSinglePredator(p);
        };
        results.appendChild(div);
    });
}

function renderPredatorGalleryShell() {
    const gallery = document.getElementById('predator-gallery');
    if (!gallery) return;

    gallery.innerHTML = `
        <div class="large-list-search-panel">
            <label>
                <span>${t('Поиск по типам охоты')}</span>
                <input id="predator-gallery-search" type="search" value="${escapeHTML(currentPredatorGallerySearch)}"
                    placeholder="${t('Например: кровь, семья, сон, вечеринка, скрытность...')}">
            </label>
            <div id="predator-gallery-count" class="large-list-count"></div>
        </div>
        <div id="predator-gallery-results" class="large-list-scroll-grid"></div>
    `;

    const search = document.getElementById('predator-gallery-search');
    if (search) {
        search.addEventListener('input', () => {
            currentPredatorGallerySearch = search.value;
            renderPredatorGalleryList();
        });
    }

    renderPredatorGalleryList();
    search?.focus();
}

function returnToPredatorGalleryList() {
    renderPredatorGalleryShell();
}

// Открытие галереи стилей охоты
function openPredatorGallery(options = {}) {
    if (startingSheetFixed && !expShopMode) return;
    const modal = document.getElementById('predator-modal');
    const gallery = document.getElementById('predator-gallery');
    if (!modal || !gallery) return;

    currentPredatorGalleryBaseData = buildPredatorGalleryData();
    currentPredatorGallerySearch = typeof options === 'object' && options ? options.search || '' : '';
    currentPredatorIndex = 0;
    renderPredatorGalleryShell();

    modal.style.display = 'block';
}

// Предыдущий стиль охоты
function prevPredator() {
    currentPredatorIndex = (currentPredatorIndex - 1 + currentPredatorData.length) % currentPredatorData.length;
    showSinglePredator(currentPredatorData[currentPredatorIndex]);
}

// Следующий стиль охоты
function nextPredator() {
    currentPredatorIndex = (currentPredatorIndex + 1) % currentPredatorData.length;
    showSinglePredator(currentPredatorData[currentPredatorIndex]);
}

// Детальный просмотр одного стиля охоты
async function showSinglePredator(pred) {
    const gallery = document.getElementById('predator-gallery');
    const data = RULES.predator_types?.[vtmName(pred.name)] || {};

    let html = `
        <div style="text-align:center; padding:20px; max-width:1100px; margin:0 auto; position:relative;">
            <div style="position:relative; display:inline-block;">
                <button onclick="prevPredator()" style="position:absolute; left: -50px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.85); color: #ff3131; border: 2px solid #ff3131; width: 70px; height: 70px; border-radius: 50%; font-size: 32px; cursor: pointer; z-index: 25;">←</button>
                <button onclick="nextPredator()" style="position:absolute; right: -50px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.85); color: #ff3131; border: 2px solid #ff3131; width: 70px; height: 70px; border-radius: 50%; font-size: 32px; cursor: pointer; z-index: 25;">→</button>
                <img src="${pred.image}" style="max-width:100%; max-height:65vh; border:4px solid #ff3131; border-radius:12px; box-shadow:0 0 40px rgba(255,49,49,0.6);">
            </div>

            <h2 style="color:#ff3131; margin:25px 0 15px;">${t(pred.name)}</h2>

            <div style="background:#1a1a1a; border:1px solid #ff3131; border-radius:8px; padding:25px; text-align:left; font-size:15px; line-height:1.7;">
                <p style="color:#ddd;">${data.description || t('Описание отсутствует')}</p>
    `;

    if (data.specialty?.options) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ffae00;">${t('Специализация:')}</strong><br>
                 ${data.specialty.options.join(', ')}`;
    }

    if (data.advantages && data.advantages.length) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ffcc00;">${t('Преимущества:')}</strong><br>`;
        data.advantages.forEach(a => html += `• ${formatPredatorTraitLine(a, true)}<br>`);
    }

    if (data.disadvantages && data.disadvantages.length) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ff6666;">${t('Недостатки:')}</strong><br>`;
        data.disadvantages.forEach(d => html += `• ${formatPredatorTraitLine(d, false)}<br>`);
    }

    html += `</div>
            <div style="margin-top:25px;">
                <button onclick="selectThisPredator('${vtmName(pred.name)}')"
                        style="background:#ff3131;color:black;border:none;padding:16px 40px;font-size:18px;border-radius:6px;cursor:pointer;">
                    ${t('Выбрать этот стиль охоты')}
                </button>
                <button onclick="returnToPredatorGalleryList()"
                        style="background:transparent;color:#ff3131;border:2px solid #ff3131;padding:16px 40px;font-size:18px;border-radius:6px;cursor:pointer;">
                    ← ${t('Назад к списку')}
                </button>
            </div>
        </div>`;

    gallery.innerHTML = html;
}

// Выбор стиля охоты из галереи
function selectThisPredator(name) {
    if (name && !validatePredatorRestrictions(name)) return;

    const predatorSelect = document.getElementById('predator-input');
    const previous = predatorSelect?.value || '';
    if (previous !== name) resetPredatorDisciplines();
    if (predatorSelect) predatorSelect.value = name;
    closePredatorModal();
    loadPredatorHint();
    notifySheetChoice('predator', name);
    
    setTimeout(() => {
        applyPredatorType(name);   // ← главный вызов
    }, 150);
}

// Закрытие модального окна стилей охоты
function closePredatorModal() {
    document.getElementById('predator-modal').style.display = 'none';
}


// ==================== ВЫБОР И ЗАКРЫТИЕ ====================

// Выбор клана из галереи
function selectThisClan(name) {
    const clanSelect = document.getElementById('clan-input');
    const previous = clanSelect?.value || '';
    if (previous !== name) resetClanDisciplines();
    if (clanSelect) clanSelect.value = name;
    closeClanModal();
    loadClanHint();        // обновляем подсказку
    updateClanIcon();      // обновляем иконку
    enforceClanSpecificRules();
    notifySheetChoice('clan', name);
    if (!isThinBloodClan(name)) {
        setTimeout(() => openClanDisciplineModal(name), 100);
    }
}

// Закрытие модального окна кланов
function closeClanModal() {
    document.getElementById('clan-modal').style.display = 'none';
}



// Закрытие модального окна стилей охоты
function closePredatorModal() {
    document.getElementById('predator-modal').style.display = 'none';
}


// ==================== ГАЛЕРЕЯ ПОКОЛЕНИЙ ====================

const GENERATION_GROUPS = [
    {
        key: 'ancilla',
        title: t('АНЦИЛЛЫ'),
        subtitle: t('Старшая Кровь'),
        motto: t('Они пережили тех, кто считал себя бессмертными'),
        accent: '#c9a84c',
        image: '/vampires/static/generation_gallery/ancilla.png',
        icon: '♛',
        age: t('1780–1940 гг.'),
        potency: tf('Сила Крови {n}', { n: 2 }),
        gens: tf('{range} поколение', { range: '10–11' }),
        traits: [t('Опытные манипуляторы'), t('Политическое влияние'), t('Контроль Голода'), t('Посредники между старейшинами и молодыми')],
        philosophy: [t('власть требует терпения'), t('контроль важнее эмоций'), t('влияние сильнее силы')],
        archetypes: [t('Княжеский советник'), t('Древний манипулятор'), t('Хозяин домена'), t('Хранитель традиций')],
        options: [
            { value: '11', label: t('11 — Анцилла (Сила Крови 2)') },
            { value: '10', label: t('10 — Анцилла (Сила Крови 2)') },
            { value: '9',  label: t('9 — Анцилла (Сила Крови 2)') },
            { value: '8',  label: t('8 — Анцилла (Сила Крови 2)') },
        ]
    },
    {
        key: 'childe',
        title: t('ПТЕНЦЫ'),
        subtitle: t('Первые Ночи'),
        motto: t('Они ещё помнят, как были людьми'),
        accent: '#7a7aaa',
        image: '/vampires/static/generation_gallery/childe.png',
        icon: '◈',
        age: t('менее 15 лет назад'),
        potency: t('Сила Крови 0–1'),
        gens: tf('{range} поколение', { range: '12–16' }),
        traits: [t('Мало опыта'), t('Слабый контроль Голода'), t('Современные взгляды'), t('Высокая адаптивность')],
        philosophy: [t('страх неизвестного'), t('поиск себя'), t('борьба с голодом'), t('сохранить человечность')],
        archetypes: [t('Случайная жертва'), t('Потерянный студент'), t('Молодой анарх'), t('Новообращённый хищник')],
        options: [
            { value: '12', label: t('12 — Птенец / Неонат (Сила Крови 1)') },
            { value: '13', label: t('13 — Птенец / Неонат (Сила Крови 1)') },
            { value: '14', label: t('14 — Птенец Слабокровный (Сила Крови 0)') },
            { value: '15', label: t('15 — Птенец Слабокровный (Сила Крови 0)') },
            { value: '16', label: t('16 — Птенец Слабокровный (Сила Крови 0)') },
        ]
    },
    {
        key: 'neonate',
        title: t('НЕОНАТЫ'),
        subtitle: t('Молодая Кровь'),
        motto: t('Они уже поняли, что мир принадлежит хищникам'),
        accent: '#cc3333',
        image: '/vampires/static/generation_gallery/neonate.png',
        icon: '✦',
        age: t('после 1940 года'),
        potency: tf('Сила Крови {n}', { n: 1 }),
        gens: tf('{range} поколение', { range: '12–13' }),
        traits: [t('Понимают современный мир'), t('Умеют скрываться среди людей'), t('Практический опыт'), t('Ещё не настоящая элита')],
        philosophy: [t('свобода'), t('адаптация'), t('амбиции'), t('выживание')],
        archetypes: [t('Городской хищник'), t('Молодой манипулятор'), t('Неоновый анарх'), t('Восходящий каннит')],
        options: [
            { value: '12', label: t('12 — Неонат (Сила Крови 1)') },
            { value: '13', label: t('13 — Неонат (Сила Крови 1)') },
        ]
    }
];

function openGenerationGallery() {
    if (startingSheetFixed && !expShopMode) return;
    const modal = document.getElementById('generation-modal');
    const gallery = document.getElementById('generation-gallery');
    if (!modal || !gallery) return;

    gallery.innerHTML = '';
    currentGenerationData = GENERATION_GROUPS;
    currentGenerationIndex = 0;

    currentGenerationData.forEach((g, index) => {
        const div = document.createElement('div');
        div.style.cursor = 'pointer';
        div.innerHTML = buildGenerationCard(g);
        div.onclick = () => {
            currentGenerationIndex = index;
            showSingleGeneration(g.key);
        };
        gallery.appendChild(div);
    });

    modal.style.display = 'block';
}

function buildGenerationCard(g) {
    return `
    <div style="
        border: 2px solid #550000;
        border-radius: 8px;
        padding: 0 0 16px;
        background: #0d0d0d;
        overflow: hidden;
        transition: border-color 0.2s, box-shadow 0.2s;
    "
    onmouseover="this.style.borderColor='${g.accent}'; this.style.boxShadow='0 0 30px ${g.accent}44';"
    onmouseout="this.style.borderColor='#550000'; this.style.boxShadow='none';">
        <img src="${g.image}" style="width:100%; max-height:60vh; object-fit:contain; background:#050505;">
        <h3 style="color:${g.accent}; margin:12px 0 6px; text-align:center; font-family:'Courier New', monospace; letter-spacing:3px;">${g.title}</h3>
        <p style="color:#ddd; font-size:14px; padding:0 10px; text-align:center; margin:0 0 8px;">${g.subtitle}</p>
        <p style="color:#aaa; font-size:13px; padding:0 14px; text-align:center; margin:0;">${g.gens} · ${g.potency}</p>
    </div>`;
}

function prevGeneration() {
    if (!currentGenerationData || currentGenerationData.length === 0) return;
    currentGenerationIndex = (currentGenerationIndex - 1 + currentGenerationData.length) % currentGenerationData.length;
    showSingleGeneration(currentGenerationData[currentGenerationIndex].key);
}

function nextGeneration() {
    if (!currentGenerationData || currentGenerationData.length === 0) return;
    currentGenerationIndex = (currentGenerationIndex + 1) % currentGenerationData.length;
    showSingleGeneration(currentGenerationData[currentGenerationIndex].key);
}

function showSingleGeneration(key) {
    const g = GENERATION_GROUPS.find(x => x.key === key);
    if (!g) return;
    const gallery = document.getElementById('generation-gallery');
    const nextIndex = GENERATION_GROUPS.findIndex(x => x.key === key);
    if (nextIndex !== -1) currentGenerationIndex = nextIndex;

    const optionButtons = g.options.map(o => `
        <button onclick="selectThisGeneration('${o.value}', '${g.key}')" style="
            display: block; width: 100%;
            background: #141414; border: 1px solid ${g.accent}55;
            color: #eee; padding: 14px 20px; border-radius: 6px;
            font-family: 'Courier New', monospace; font-size: 15px;
            cursor: pointer; text-align: left; margin-bottom: 10px;
            transition: all 0.15s;
        "
        onmouseover="this.style.background='#2a1a1a'; this.style.borderColor='${g.accent}';"
        onmouseout="this.style.background='#141414'; this.style.borderColor='${g.accent}55';">
            ${o.label}
        </button>
    `).join('');

    const traits = g.traits.map(t => `<li style="color:#ccc; margin-bottom:6px;">${t}</li>`).join('');
    const philosophy = g.philosophy.map(p => `
        <div style="background:#111; border:1px solid #222; border-radius:6px; padding:8px 12px; font-size:13px; color:#aaa; text-align:center;">${p}</div>
    `).join('');
    const archetypes = g.archetypes.map(a => `<li style="color:#aaa; margin-bottom:4px;">${a}</li>`).join('');

    gallery.innerHTML = `
    <div style="max-width: 1100px; margin: 0 auto; text-align: center; padding: 10px 0 30px;">

        <div style="position:relative; display:inline-block;">
            <button onclick="prevGeneration()" style="position:absolute; left:-50px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.85); color:${g.accent}; border:2px solid ${g.accent}; width:70px; height:70px; border-radius:50%; font-size:32px; cursor:pointer; z-index:25; box-shadow:0 0 25px ${g.accent}66;">←</button>
            <button onclick="nextGeneration()" style="position:absolute; right:-50px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.85); color:${g.accent}; border:2px solid ${g.accent}; width:70px; height:70px; border-radius:50%; font-size:32px; cursor:pointer; z-index:25; box-shadow:0 0 25px ${g.accent}66;">→</button>
            <img src="${g.image}" style="max-width:100%; max-height:65vh; border:4px solid ${g.accent}; border-radius:12px; box-shadow:0 0 40px ${g.accent}66;">
        </div>

        <h2 style="color: ${g.accent}; font-family: 'Courier New', monospace; letter-spacing: 5px; font-size: 28px; margin: 25px 0 4px;">${g.title}</h2>
        <div style="color: #888; font-size: 12px; letter-spacing: 4px; margin-bottom: 24px;">${g.subtitle.toUpperCase()}</div>

        <div style="display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; margin-bottom: 28px;">
            <div style="background:#0d0d0d; border:1px solid ${g.accent}33; border-radius:8px; padding:12px 20px;">
                <div style="color:#555; font-size:10px; letter-spacing:2px; margin-bottom:4px;">${t('ПОКОЛЕНИЕ')}</div>
                <div style="color:#ddd; font-size:15px;">${g.gens}</div>
            </div>
            <div style="background:#0d0d0d; border:1px solid ${g.accent}33; border-radius:8px; padding:12px 20px;">
                <div style="color:#555; font-size:10px; letter-spacing:2px; margin-bottom:4px;">${t('СТАНОВЛЕНИЕ')}</div>
                <div style="color:#ddd; font-size:15px;">${g.age}</div>
            </div>
            <div style="background:#0d0d0d; border:1px solid ${g.accent}55; border-radius:8px; padding:12px 20px;">
                <div style="color:#555; font-size:10px; letter-spacing:2px; margin-bottom:4px;">${t('СИЛА КРОВИ')}</div>
                <div style="color:${g.accent}; font-size:15px; font-weight:bold;">${g.potency}</div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; text-align: left;">
            <div style="background:#0d0d0d; border:1px solid #1e1e1e; border-radius:8px; padding:18px 20px;">
                <div style="color:${g.accent}; font-size:11px; letter-spacing:2px; margin-bottom:12px;">${t('ОСОБЕННОСТИ')}</div>
                <ul style="list-style:disc; padding-left:18px; margin:0;">${traits}</ul>
            </div>
            <div style="background:#0d0d0d; border:1px solid #1e1e1e; border-radius:8px; padding:18px 20px;">
                <div style="color:${g.accent}; font-size:11px; letter-spacing:2px; margin-bottom:12px;">${t('ТИПАЖИ')}</div>
                <ul style="list-style:disc; padding-left:18px; margin:0;">${archetypes}</ul>
            </div>
        </div>

        <div style="background:#0d0d0d; border:1px solid #1e1e1e; border-radius:8px; padding:18px 20px; margin-bottom:28px; text-align:left;">
            <div style="color:${g.accent}; font-size:11px; letter-spacing:2px; margin-bottom:12px;">${t('ФИЛОСОФИЯ')}</div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">${philosophy}</div>
        </div>

        <div style="background:#0d0d0d; border:1px solid ${g.accent}33; border-radius:8px; padding:20px 24px; margin-bottom:28px; text-align:left;">
            <div style="color:${g.accent}; font-size:11px; letter-spacing:2px; margin-bottom:16px;">${t('ВЫБЕРИТЕ ПОКОЛЕНИЕ')}</div>
            ${optionButtons}
        </div>

        <div style="color:#555; font-size:13px; font-style:italic; margin-bottom:24px; border-top:1px solid #1e1e1e; padding-top:20px;">
            «${g.motto}»
        </div>

        <button onclick="openGenerationGallery()" style="
            background: transparent; color: ${g.accent}; border: 2px solid ${g.accent};
            padding: 14px 36px; font-size: 16px; border-radius: 6px;
            cursor: pointer; font-family: 'Courier New', monospace; letter-spacing: 2px;
        ">← ${t('Назад к списку')}</button>
    </div>`;
}

function selectThisGeneration(value, typeKey) {
    // Выставляем поколение
    const genSel = document.getElementById('generation-input');
    if (genSel) {
        genSel.value = value;
        genSel.dispatchEvent(new Event('change'));
    }

    // Выставляем тип — ключ группы совпадает с value в type-input
    if (typeKey) {
        const typeSel = document.getElementById('type-input');
        if (typeSel) {
            typeSel.value = typeKey;
            typeSel.dispatchEvent(new Event('change'));
        }
    }

    closeGenerationModal();
    notifySheetChoice('generation', value);
}

function closeGenerationModal() {
    const modal = document.getElementById('generation-modal');
    if (modal) modal.style.display = 'none';
}

window.openClanGallery = openClanGallery;
window.openPredatorGallery = openPredatorGallery;
window.openGenerationGallery = openGenerationGallery;
window.selectThisClan = selectThisClan;
window.selectThisPredator = selectThisPredator;
window.selectThisGeneration = selectThisGeneration;
window.openClanDisciplineModal = openClanDisciplineModal;

// ==================== ТИП ПЕРСОНАЖА ====================

const MORTAL_TEMPLATES = [
    {
        id: 'weak',
        name: t('Слабый смертный'),
        short: t('Рядовой обыватель без особых способностей'),
        detail: t(
`Характеристики: две по 2 пункта, остальные по 1 пункту.
Навыки: три по 2 пункта, пять по 1 пункту.
Преимущества: нет.`),
        attrs: { total: 11, budget: [{v:2,n:2},{v:1,n:t('все остальные')}] },
        skills: { total: 11, budget: [{v:2,n:3},{v:1,n:5}] },
        merits: 0, maxFlaws: 0, specs: 0,
        attrLimits:  { 5:0, 4:0, 3:0, 2:2, 1:7 },
        skillLimits: { 5:0, 4:0, 3:0, 2:3, 1:5 },
    },
    {
        id: 'average',
        name: t('Обычный смертный'),
        short: t('Среднестатистический человек'),
        detail: t(
`Характеристики: две по 3 пункта, три по 2 пункта, остальные по 1 пункту.
Навыки: три по 3 пункта, четыре по 2 пункта, пять по 1 пункту.
Преимущества: до 3 пунктов (недостатков не больше чем на 2 пункта).`),
        attrs: { total: 18, budget: [{v:3,n:2},{v:2,n:3},{v:1,n:t('остальные')}] },
        skills: { total: 21, budget: [{v:3,n:3},{v:2,n:4},{v:1,n:5}] },
        merits: 3, maxFlaws: 2, specs: 0,
        attrLimits:  { 5:0, 4:0, 3:2, 2:3, 1:4 },
        skillLimits: { 5:0, 4:0, 3:3, 2:4, 1:5 },
    },
    {
        id: 'gifted',
        name: t('Одарённый смертный'),
        short: t('Человек с выдающимися талантами'),
        detail: t(
`Характеристики: одна — 4 пункта, две по 3 пункта, две по 2 пункта, остальные по 1 пункту.
Навыки: два по 4 пункта (одна специализация на любой из них), четыре по 3 пункта, четыре по 2 пункта, четыре по 1 пункту.
Преимущества: до 10 пунктов (недостатков не больше чем на 4 пункта).`),
        attrs: { total: 23, budget: [{v:4,n:1},{v:3,n:2},{v:2,n:2},{v:1,n:t('остальные')}] },
        skills: { total: 30, budget: [{v:4,n:2},{v:3,n:4},{v:2,n:4},{v:1,n:4}] },
        merits: 10, maxFlaws: 4, specs: 1,
        attrLimits:  { 5:0, 4:1, 3:2, 2:2, 1:4 },
        skillLimits: { 5:0, 4:2, 3:4, 2:4, 1:4 },
    },
    {
        id: 'formidable',
        name: t('Отчаянный смертный'),
        short: t('Исключительный человек, опасный противник'),
        detail: t(
`Характеристики: две по 5 пунктов, две по 4 пункта, две по 3 пункта, остальные по 2 пункта.
Навыки: один — 5 пунктов, три по 4 пункта, пять по 3 пункта, шесть по 2 пункта; три специализации.
Преимущества: до 15 пунктов (нет недостатков).`),
        attrs: { total: 39, budget: [{v:5,n:2},{v:4,n:2},{v:3,n:2},{v:2,n:t('остальные')}] },
        skills: { total: 44, budget: [{v:5,n:1},{v:4,n:3},{v:3,n:5},{v:2,n:6}] },
        merits: 15, maxFlaws: 0, specs: 3,
        attrLimits:  { 5:2, 4:2, 3:2, 2:3, 1:0 },
        skillLimits: { 5:1, 4:3, 3:5, 2:6, 1:0 },
    },
];

function setCharacterType(type, { persist = true, syncDamageProfile = true } = {}) {
    const supportedModes = ['vampire', 'mortal', 'ghoul', 'thinblood', 'npc-vampire', 'npc-ghost', 'npc-mortal'];
    currentCharType = supportedModes.includes(type) ? type : normalizeCharacterType(type);
    if (persist) localStorage.setItem('vtm-char-type', currentCharType);

    // Сбрасываем все классы char-type-*
    document.body.classList.forEach(cls => {
        if (cls.startsWith('char-type-')) document.body.classList.remove(cls);
    });
    document.body.classList.add('char-type-' + currentCharType);

    // Синхронизируем select переключателя
    const charTypeSelect = document.getElementById('char-type-select');
    if (charTypeSelect && Array.from(charTypeSelect.options).some(option => option.value === currentCharType)) {
        charTypeSelect.value = currentCharType;
    }

    // Рендерим нужный трекер
    if (currentCharType === 'mortal' || currentCharType === 'npc-mortal') {
        renderMortalTemplates();
    }

    // Обновляем label у поля Сира для смертных
    updateSireLabel(currentCharType);
    if (syncDamageProfile) syncDamageProfileFromCharacterType();
    updateCreationRuleControls();
    updateTrackers();
}

function setCharacterSavedState(saved) {
    characterHasBeenSaved = Boolean(saved);
    document.body.classList.toggle('character-saved', characterHasBeenSaved);
}

function updateSireLabel(type) {
    const label = document.querySelector('[for="sire-input"], label[data-for="sire-input"]');
    // Ищем span с "Сир" в header-label
    document.querySelectorAll('.header-label').forEach(el => {
        if (el.textContent.includes(t('Сир'))) {
            // Меняем placeholder инпута
            const input = document.getElementById('sire-input');
            if (!input) return;
            if (type === 'mortal' || type === 'npc-mortal' || type === 'npc-ghost') {
                input.placeholder = t('Связи / Наставник');
            } else {
                input.placeholder = t('Сир');
            }
        }
    });
}

function renderMortalTemplates() {
    const sel = document.getElementById('mortal-template-select');
    if (sel) sel.value = currentMortalTemplate || '';
    renderMortalTemplateDetail();
    renderMortalAttrTracker();
}

function selectMortalTemplate(id) {
    currentMortalTemplate = id || null;
    localStorage.setItem('vtm-mortal-template', id || '');
    const sel = document.getElementById('mortal-template-select');
    if (sel) sel.value = id || '';
    renderMortalTemplateDetail();
    renderMortalAttrTracker();
    updateTrackers();
}

function renderMortalTemplateDetail() {
    const detail = document.getElementById('mortal-template-detail');
    if (!detail) return;
    if (!currentMortalTemplate) { detail.style.display = 'none'; return; }
    const tpl = MORTAL_TEMPLATES.find(t => t.id === currentMortalTemplate);
    if (!tpl) { detail.style.display = 'none'; return; }
    detail.style.display = 'block';
    detail.textContent = tpl.detail;
}

function renderMortalAttrTracker() {
    const container = document.getElementById('mortal-attr-tracker');
    if (!container) return;
    if (!currentMortalTemplate) { container.innerHTML = ''; return; }
    const tpl = MORTAL_TEMPLATES.find(t => t.id === currentMortalTemplate);
    if (!tpl) { container.innerHTML = ''; return; }

    // Считаем потраченные атрибуты и навыки
    let attrSpent = 0;
    document.querySelectorAll('#attributes-grid input[type="radio"]:checked').forEach(r => {
        attrSpent += parseInt(r.value) || 0;
    });
    let skillSpent = 0;
    document.querySelectorAll('#skills-grid input[type="radio"]:checked').forEach(r => {
        skillSpent += parseInt(r.value) || 0;
    });

    const attrOk = attrSpent <= tpl.attrs.total;
    const skillOk = skillSpent <= tpl.skills.total;

    const meritsEl = tpl.merits > 0
        ? `<div class="mortal-tracker-row"><span>${t('Преимущества')}</span><span>${tf('до {merits} пт{flawsNote}', { merits: tpl.merits, flawsNote: tpl.maxFlaws ? tf(' (недост. ≤ {maxFlaws})', { maxFlaws: tpl.maxFlaws }) : '' })}</span></div>`
        : '';
    const specsEl = tpl.specs > 0
        ? `<div class="mortal-tracker-row"><span>${t('Специализации')}</span><span>${tpl.specs}</span></div>`
        : '';

    container.innerHTML = `
        <div class="mortal-tracker-row">
            <span>${t('Характеристики')}</span>
            <span class="${attrOk ? 'ok' : 'bad'}">${attrSpent} / ${tpl.attrs.total}</span>
        </div>
        <div class="mortal-tracker-row">
            <span>${t('Навыки')}</span>
            <span class="${skillOk ? 'ok' : 'bad'}">${skillSpent} / ${tpl.skills.total}</span>
        </div>
        ${meritsEl}
        ${specsEl}
    `;
}

window.setCharacterType = setCharacterType;
window.selectMortalTemplate = selectMortalTemplate;
window.setCharacterSavedState = setCharacterSavedState;

// ==================== МОДАЛЬНОЕ ОКНО АРХЕТИПОВ ====================
let _archetypeTargetFieldId = null;
let _archetypeCurrentName = null;

function openArchetypeModal(fieldId) {
    _archetypeTargetFieldId = fieldId;
    _archetypeCurrentName = null;
    closeArchetypeDetail();

    const modal = document.getElementById('archetype-modal');
    if (!modal) return;

    // Subtitle — показываем для какого поля
    const fieldLabel = fieldId === 'nature-input' ? t('натуры') : t('маски');
    const subtitle = document.getElementById('archetype-modal-subtitle');
    if (subtitle) subtitle.textContent = tf('Выберите архетип {fieldLabel} — нажмите на карточку, чтобы прочитать описание', { fieldLabel });

    // Сбросить поиск
    const searchEl = document.getElementById('archetype-search');
    if (searchEl) searchEl.value = '';

    renderArchetypeList('');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeArchetypeModal() {
    const modal = document.getElementById('archetype-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    closeArchetypeDetail();
}

function renderArchetypeList(filter) {
    const list = document.getElementById('archetype-list');
    if (!list) return;

    const archetypes = RULES?.archetypes || {};
    const needle = filter.trim().toLowerCase();
    const entries = Object.entries(archetypes).filter(([name, data]) => {
        if (!needle) return true;
        return name.toLowerCase().includes(needle) || (data.short || '').toLowerCase().includes(needle);
    });

    list.innerHTML = entries.map(([name, data]) => `
        <button
            class="archetype-card"
            onclick="showArchetypeDetail('${name.replace(/'/g, "\\'")}')"
            style="text-align:left;background:#1a1a1a;border:1px solid #333;border-radius:7px;padding:11px 14px;cursor:pointer;font-family:'Courier New',Courier,monospace;color:#eee;transition:border-color 0.15s,background 0.15s;"
            onmouseover="this.style.borderColor='#ff3131';this.style.background='#221111'"
            onmouseout="this.style.borderColor='#333';this.style.background='#1a1a1a'"
        >
            <div style="font-size:14px;font-weight:bold;color:#fff7ed;margin-bottom:4px;">${name}</div>
            <div style="font-size:12px;color:#b0a090;line-height:1.4;">${data.short || ''}</div>
        </button>
    `).join('');

    if (entries.length === 0) {
        list.innerHTML = '<p style="color:#666;font-size:14px;grid-column:1/-1;">' + t('Архетипы не найдены') + '</p>';
    }
}

window.filterArchetypes = function(value) {
    renderArchetypeList(value);
    closeArchetypeDetail();
};

function showArchetypeDetail(name) {
    const data = RULES?.archetypes?.[name];
    if (!data) return;

    _archetypeCurrentName = name;

    const detail = document.getElementById('archetype-detail');
    const nameEl = document.getElementById('archetype-detail-name');
    const textEl = document.getElementById('archetype-detail-text');
    if (!detail || !nameEl || !textEl) return;

    nameEl.textContent = name;
    textEl.textContent = data.long || data.short || '';
    detail.style.display = 'block';

    // Прокрутить к деталям
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeArchetypeDetail() {
    const detail = document.getElementById('archetype-detail');
    if (detail) detail.style.display = 'none';
    _archetypeCurrentName = null;
}

window.closeArchetypeModal = closeArchetypeModal;
window.closeArchetypeDetail = closeArchetypeDetail;
window.openArchetypeModal = openArchetypeModal;

window.selectArchetype = function() {
    if (!_archetypeCurrentName || !_archetypeTargetFieldId) return;
    const input = document.getElementById(_archetypeTargetFieldId);
    if (input) {
        input.value = _archetypeCurrentName;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closeArchetypeModal();
};

// Закрывать по клику на фон
document.addEventListener('click', function(e) {
    const modal = document.getElementById('archetype-modal');
    if (modal && modal.style.display !== 'none' && e.target === modal) {
        closeArchetypeModal();
    }
});

// Закрывать по Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('archetype-modal');
        if (modal && modal.style.display !== 'none') closeArchetypeModal();
    }
});


// ==================== ПОДТВЕРЖДЕНИЕ И ДОБАВЛЕНИЕ ====================
// ==================== ПОДТВЕРЖДЕНИЕ КЛАНА ====================
function confirmClanDisciplines(clanName) {
    const disc2 = document.getElementById('clan-disc-2').value;
    const disc1 = document.getElementById('clan-disc-1').value;
    if (disc1 && disc2 && disc1 === disc2) {
        return alert(t("Выберите две разные дисциплины."));
    }

    const clanSource = `${t("Клан")} ${clanName}`;
    removeDisciplineSource(clanSource);
    clanProvidedDisciplines = {};

    if (disc2) {
        setDisciplineSource(disc2, 2, clanSource);
        clanProvidedDisciplines[disc2] = 2;
    }
    if (disc1) {
        setDisciplineSource(disc1, 1, clanSource);
        clanProvidedDisciplines[disc1] = 1;
    }

    closeClanDiscModal();
    updateAllDisciplineRows();
    updateDisciplineTotal();
    notifySheetChoice('clanDisciplines', clanName);
}

// ==================== ПОДТВЕРЖДЕНИЕ ОХОТЫ ====================
function confirmPredatorDiscipline(predatorName) {
    const disc = document.getElementById('pred-disc-select').value;
    if (!disc) return alert(t("Выберите дисциплину!"));

    const predatorSource = `${t("Охота")}: ${predatorName}`;
    removeDisciplineSource(predatorSource);
    predatorProvidedDisciplines = {};
    setDisciplineSource(disc, 1, predatorSource);
    predatorProvidedDisciplines[disc] = 1;

    closePredDiscModal();
    updateAllDisciplineRows();
    updateDisciplineTotal();
    notifySheetChoice('predatorDiscipline', predatorName);
}

function closeClanDiscModal() {
    document.getElementById('clan-disc-modal')?.remove();
}


// Пересчёт суммы точек дисциплин
function updateDisciplineTotal() {
    // Счётчик отключён
}


// ==================== ПОДСКАЗКИ (ХИНТЫ) ====================


// Универсальная функция сворачивания
function toggleHint(boxId) {
    const box = document.getElementById(boxId);
    if (!box) return;
    box.classList.toggle('collapsed');
}

// ==================== КЛАН ====================
function loadClanHint() {
    const clanName = document.getElementById('clan-input').value.trim();
    const box = document.getElementById('clan-hint-box');
    const content = document.getElementById('clan-hint-content');
    updateClanBaneField();
    
    if (!clanName || !box || !content) {
        if (box) box.style.display = 'none';
        return;
    }

    const clan = RULES.clans?.[clanName];
    if (!clan) {
        box.style.display = 'none';
        return;
    }

    // Короткая строка при свёрнутом состоянии
    box.dataset.short = `Клан: ${clanName}`;

    let html = `
        <div style="color:#ddd; line-height:1.65; font-size:14.8px;">
            ${clan.description || t('Описание отсутствует')}
        </div>
    `;

    if (clan.types) html += `<hr style="border-color:#333;margin:15px 0;"><strong style="color:#ffae00;">${t('Типичные представители:')}</strong><br><span style="color:#ccc;">${clan.types}</span>`;
    if (clan.disciplines?.length) {
        html += `<hr style="border-color:#333;margin:15px 0;"><strong style="color:#ffae00;">${t('Дисциплины:')}</strong><br>`;
        clan.disciplines.forEach(d => html += `• ${d}<br>`);
    }
    if (clan.bane) html += `<hr style="border-color:#333;margin:15px 0;"><strong style="color:#ff6666;">${t('Проклятие:')}</strong> ${clan.bane}`;

    content.innerHTML = html;
    box.style.display = 'block';
}

// ==================== СТИЛЬ ОХОТЫ ====================
// ==================== СТИЛЬ ОХОТЫ ====================
function loadPredatorHint() {
    const name = document.getElementById('predator-input').value;
    const box = document.getElementById('predator-hint-box');
    const content = document.getElementById('predator-hint-content');
    
    if (!name || !box || !content) {
        if (box) box.style.display = 'none';
        return;
    }

    box.dataset.short = `Стиль Охоты: ${name}`;

    const pred = RULES.predator_types?.[name];
    if (!pred) {
        box.style.display = 'none';
        return;
    }

    let html = `<div style="color:#ddd; line-height:1.6;">${pred.description || t('Описание отсутствует')}</div>`;

    // Специализация
    if (pred.specialty?.options && pred.specialty.options.length) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ffae00;">${t('Специализация:')}</strong><br>
                 ${pred.specialty.options.join(', ')}`;
    }

    // Дисциплина
    if (pred.disciplines?.increase?.options && pred.disciplines.increase.options.length) {
        const value = pred.disciplines.increase.value || 1;
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ffae00;">${tf('Дисциплина (+{value}):', { value })}</strong><br>
                 ${pred.disciplines.increase.options.join(', ')}`;
    }

    // Преимущества
    if (pred.advantages && pred.advantages.length) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ffcc00;">${t('Преимущества:')}</strong><br>`;
        pred.advantages.forEach(a => {
            html += `• ${formatPredatorTraitLine(a, true)}<br>`;
        });
    }

    // Недостатки
    if (pred.disadvantages && pred.disadvantages.length) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ff6666;">${t('Недостатки:')}</strong><br>`;
        pred.disadvantages.forEach(d => {
            html += `• ${formatPredatorTraitLine(d, false)}<br>`;
        });
    }

    // Человечность
    if (pred.humanity !== undefined) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ffae00;">${t('Человечность:')}</strong>
                 <span style="color:#ffd700;">${pred.humanity > 0 ? '+' : ''}${pred.humanity}</span>`;
    }

    if (pred.blood_potency) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ffae00;">${t('Сила Крови:')}</strong>
                 <span style="color:#ffd700;">+${pred.blood_potency}</span>`;
    }

    if (pred.restriction) {
        const restrictions = Array.isArray(pred.restriction) ? pred.restriction : [pred.restriction];
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ff6666;">${t('Ограничения:')}</strong><br>
                 ${restrictions.map(r => `• ${r}`).join('<br>')}`;
    }

    if (pred.notes?.length) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#aaa;">${t('Заметки:')}</strong><br>
                 ${pred.notes.map(n => `• ${n}`).join('<br>')}`;
    }

    content.innerHTML = html;
    box.style.display = 'block';
}

// ==================== ПОКОЛЕНИЕ + ТИП ====================
function updateBloodPotencyAndBonuses() {
    const type = document.getElementById('type-input').value;
    const genValue = document.getElementById('generation-input').value;
    const generation = parseInt(genValue) || 13;
    
    const box = document.getElementById('generation-hint-box');
    const content = document.getElementById('generation-hint-content');
    
    if (!box || !content) return;

    let shortText = `Поколение: ${genValue || '?'}`;
    if (type) shortText += ` — ${type === 'childe' ? 'Птенец' : type === 'neonate' ? 'Неонат' : type === 'ancilla' ? 'Анцилла' : type === 'elder' ? 'Старейшина' : type}`;

    box.dataset.short = shortText;

    let hintHTML = '';

    if (type === 'childe') {
        hintHTML = t('<strong>Птенец (Childe)</strong><br>• Становление ≤ 15 лет назад<br>• <strong>Сила Крови: 0</strong><br>• +0 опыта');
    } else if (type === 'neonate') {
        const potency = (generation <= 13) ? 1 : 0;
        hintHTML = tf('<strong>Неонат (Neonate)</strong><br>• Становление после 1940 г.<br>• <strong>Сила Крови: {potency}</strong><br>• +15 опыта', { potency });
    } else if (type === 'ancilla') {
        const potency = (generation <= 11) ? 2 : 1;
        hintHTML = tf('<strong>Анцилла (Ancilla)</strong><br>• Становление 1780–1940 гг.<br>• <strong>Сила Крови: {potency}</strong><br>• +2 Преимущества к лимиту • +2 Недостатка к лимиту<br>• −1 Человечность<br>• +35 опыта', { potency });
    } else if (type === 'elder' || type === 'methuselah' || type === 'antediluvian') {
        hintHTML = t('<strong>Старейшина / Матузалем</strong><br>• Очень старый вампир<br>• <strong>Сила Крови: 3+</strong>');
    }

    content.innerHTML = hintHTML || t('Выберите Поколение и Тип');
    box.style.display = 'block';

    // Обновить показатель Силы крови в виталах
    updateBloodPotencyVital();
}

// ==================== ТРЕКЕРЫ И ВАЛИДАЦИЯ ====================

const ATTR_LIMITS = { 4: 1, 3: 3, 2: 4, 1: 1 };
const VAMPIRE_SPECIALTY_LIMIT = 5;
const SKILL_PACKAGES = {
    specialist: { 4: 1, 3: 3, 2: 3, 1: 3 },
    balanced:   { 4: 0, 3: 3, 2: 5, 1: 7 },
    versatile:  { 4: 0, 3: 1, 2: 8, 1: 10 }
};

let counts = { attr: {4:0, 3:0, 2:0, 1:0}, skill: {4:0, 3:0, 2:0, 1:0} };

function getSpecialtyCount() {
    return document.querySelectorAll('.skill-spec-line').length;
}

// Основная функция обновления трекеров
// Основная функция обновления трекеров
function updateTrackers() {
    const isMortal = (currentCharType === 'mortal' || currentCharType === 'npc-mortal');
    const packageSelect = document.getElementById('skill-package');

    counts = {
        attr: {5:0, 4:0, 3:0, 2:0, 1:0},
        skill: {5:0, 4:0, 3:0, 2:0, 1:0}
    };

    document.querySelectorAll('.dot-input:checked').forEach(input => {
        const val = parseInt(input.value);
        if (val >= 1 && val <= 5) {
            counts[input.dataset.type][val]++;
        }
    });

    const derived = getFullSheetDerivedStats();
    document.getElementById('val-hp').textContent = derived.health.totalMax;
    document.getElementById('val-wp').textContent = derived.willpower.totalMax;
    renderDerivedStatsPanel(derived);
    renderVitalTracker('health');
    renderVitalTracker('willpower');

    if (isMortal) {
        // Режим смертного: используем лимиты шаблона
        const tpl = currentMortalTemplate ? MORTAL_TEMPLATES.find(t => t.id === currentMortalTemplate) : null;
        if (tpl) {
            renderTracker('attr', tpl.attrLimits, 'attr-tracker');
            renderTracker('skill', tpl.skillLimits, 'skill-tracker');
            const specCount = getSpecialtyCount();
            document.getElementById('spec-tracker').textContent = tf('Специализации (S): {current} / {max}', { current: specCount, max: tpl.specs });
        } else {
            document.getElementById('attr-tracker').innerHTML =
                `<span style="color:#888; font-style:italic;">${t('Выберите шаблон смертного')}</span>`;
            document.getElementById('skill-tracker').innerHTML = '';
            document.getElementById('spec-tracker').textContent = t('Специализации (S): 0 / 0');
        }
        renderMortalAttrTracker();
    } else {
        // Режим вампира
        if (!packageSelect.value) {
            document.getElementById('skill-tracker').innerHTML =
                `<span style="color:#888; font-style:italic;">${t('Выберите способ развития выше')}</span>`;
            document.getElementById('spec-tracker').textContent = tf('Специализации (S): {current} / {max}', { current: getSpecialtyCount(), max: VAMPIRE_SPECIALTY_LIMIT });
        } else {
            renderTracker('attr', ATTR_LIMITS, 'attr-tracker');
            renderTracker('skill', SKILL_PACKAGES[packageSelect.value], 'skill-tracker');
            const specCount = getSpecialtyCount();
            document.getElementById('spec-tracker').textContent = tf('Специализации (S): {current} / {max}', { current: specCount, max: VAMPIRE_SPECIALTY_LIMIT });
        }
    }

    checkLimits();
    updateVitals();
}

function renderTracker(type, limits, trackerId) {
    let html = `<b>${type === 'attr' ? t('Атрибуты') : t('Навыки')}:</b><br>`;

    for (let v of [1,2,3,4,5]) {   // ← Изменили порядок: от 1 до 5
        const limit = limits[v] !== undefined ? limits[v] : 0;
        const count = counts[type][v] || 0;

        let color = '';
        if (count > limit) color = 'color:#ff3131;';      // превышение (в т.ч. 5-й при лимите 0)
        else if (count < limit) color = 'color:#ffae00;'; // недобор
        // иначе — белый (ровно в лимит)

        html += `<span style="${color}">${tf('На {v}: {count} / {limit}', { v, count, limit })}</span><br>`;
    }
    document.getElementById(trackerId).innerHTML = html;
}

function checkLimits() {
    const guide = document.querySelector('.guide');
    const warning = document.getElementById('global-warning');

    if (startingSheetFixed || isNpcCharacterType()) {
        guide?.classList.remove('error');
        if (warning) warning.style.display = 'none';
        return;
    }
    
    let hasOver = false;
    const isMortal = (currentCharType === 'mortal' || currentCharType === 'npc-mortal');

    if (isMortal) {
        // Проверка лимитов по шаблону смертного
        if (currentMortalTemplate) {
            const tpl = MORTAL_TEMPLATES.find(t => t.id === currentMortalTemplate);
            if (tpl) {
                Object.keys(counts.attr).forEach(v => {
                    if (counts.attr[v] > (tpl.attrLimits[v] || 0)) hasOver = true;
                });
                Object.keys(counts.skill).forEach(v => {
                    if (counts.skill[v] > (tpl.skillLimits[v] || 0)) hasOver = true;
                });
            }
        }
    } else {
        // Проверка обычных лимитов вампира (5-й уровень запрещён: ATTR_LIMITS[5] = undefined → 0)
        Object.keys(counts.attr).forEach(v => {
            if (counts.attr[v] > (ATTR_LIMITS[v] ?? 0)) hasOver = true;
        });
        Object.keys(counts.skill).forEach(v => {
            if (counts.skill[v] > (SKILL_PACKAGES[currentPackage]?.[v] ?? 0)) hasOver = true;
        });
        if (getSpecialtyCount() > VAMPIRE_SPECIALTY_LIMIT) hasOver = true;
    }

    if (hasOver) {
        guide.classList.add('error');
        warning.style.display = 'block';
    } else {
        guide.classList.remove('error');
        warning.style.display = 'none';
    }
}
// ==================== СПЕЦИАЛЬНОСТИ ====================

// Клик по S-бейджу
document.addEventListener('click', function(e) {
    if (!e.target.classList.contains('s-badge')) return;

    const checkbox = e.target.previousElementSibling;
    if (!checkbox || checkbox.disabled) return;

    const skillName = checkbox.id.replace('s-', '');
    const container = document.getElementById('specs-' + skillName);

    if (container.style.display === 'flex') {
        // Закрываем и гасим
        container.innerHTML = '';
        container.style.display = 'none';
        checkbox.checked = false;
    } else {
        // Открываем
        container.style.display = 'flex';
        if (container.children.length === 0) {
            addSpecLine(skillName);
        }
        checkbox.checked = true;
    }

    updateSBadgeState(skillName);
    if (expShopMode) renderExpShopPanel();
});

function addSpecLine(skillName, value = '') {
    const container = document.getElementById('specs-' + skillName);
    if (!container) return;

    const currentDots = parseInt(document.querySelector(`input[name="${skillName}"]:checked`)?.value || 0);
    const currentSpecs = container.children.length;

    if (isStrictPlayerCreation() && getSpecialtyCount() >= VAMPIRE_SPECIALTY_LIMIT) {
        alert(tf('В стартовом листе можно взять не больше {limit} специализаций.', { limit: VAMPIRE_SPECIALTY_LIMIT }));
        return;
    }

    if (currentSpecs >= currentDots) {
        alert(window.VTM_LANG === 'en'
            ? tf('The "{skillName}" Skill only has {dots} dot{plural}.', { skillName, dots: currentDots, plural: currentDots === 1 ? '' : 's' })
            : tf('У навыка "{skillName}" только {dots} точ{suffix}.', { skillName, dots: currentDots, suffix: currentDots === 1 ? 'ка' : 'ки' }));
        return;
    }

    const line = document.createElement('div');
    line.className = 'skill-spec-line';
    line.innerHTML = `
        <input type="text" class="dice-roll-specialty-input" data-skill="${skillName}" placeholder="${t('Название специальности')}" style="flex:1;">
        ${expShopMode ? '<span style="color:#ff9500;font-weight:bold;align-self:center;white-space:nowrap;">3 XP</span>' : ''}
        <button title="${t('Добавить ещё')}" style="background:#222;color:#ffae00;">+</button>
        <button title="${t('Удалить')}" style="background:#222;color:#ff6666;">×</button>
    `;

    const input = line.querySelector('input[type="text"]');
    if (input) {
        input.value = value;
        input.addEventListener('input', () => {
            if (expShopMode) renderExpShopPanel();
        });
    }

    // Кнопка "+"
    line.querySelectorAll('button')[0].addEventListener('click', () => addSpecLine(skillName));

    // Кнопка "×" — исправленный обработчик
    line.querySelectorAll('button')[1].addEventListener('click', () => {
        line.remove();
        setTimeout(() => {
            updateSBadgeState(skillName);
            if (expShopMode) renderExpShopPanel();
        }, 10);
    });

    container.appendChild(line);
    updateSBadgeState(skillName);
    if (expShopMode) renderExpShopPanel();
}

function restoreSpecializations(skillName, specs = []) {
    const container = document.getElementById('specs-' + skillName);
    const checkbox = document.getElementById('s-' + skillName);
    if (!container || !checkbox) return;

    container.innerHTML = '';

    const cleanSpecs = specs
        .map(spec => String(spec || '').trim())
        .filter(Boolean);

    if (cleanSpecs.length === 0) {
        container.style.display = 'none';
        checkbox.checked = false;
        updateSBadgeState(skillName);
        return;
    }

    container.style.display = 'flex';
    checkbox.checked = true;

    cleanSpecs.forEach(text => addSpecLine(skillName, text));
    updateSBadgeState(skillName);
    updateSpecUI(skillName);
}

// ==================== БРОСКИ КУБИКОВ СО СТАРТОВОГО ЛИСТА ====================

const DICE_TABLE_ROOM = 'campaign-666';
const DICE_TABLE_CHANNEL = 'vtm-table-rolls';
const DICE_TABLE_STORAGE_PREFIX = 'vtm-table-rolls:';
const DICE_SUPABASE_URL = 'https://klhxbaagarqxaqnrvurr.supabase.co';
const DICE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaHhiYWFnYXJxeGFxbnJ2dXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzkwNjAsImV4cCI6MjA5MzY1NTA2MH0.Cy2496DJgJhqZkERL9h19FkiiTfkcW2pauPaJU5r5oY';
const DICE_ATTRIBUTES = ["Сила", "Ловкость", "Выносливость", "Обаяние", "Манипуляция", "Самообладание", "Интеллект", "Смекалка", "Упорство"];
const DICE_SKILLS = ["Атлетика", "Вождение", "Воровство", "Выживание", "Драка", "Ремесло", "Скрытность", "Стрельба", "Фехтование", "Запугивание", "Исполнение", "Лидерство", "Обращение с животными", "Проницательность", "Убеждение", "Уличное чутьё", "Хитрость", "Этикет", "Гуманитарные науки", "Естественные науки", "Медицина", "Наблюдательность", "Оккультизм", "Политика", "Расследование", "Техника", "Финансы"];
const DICE_ROLL_IMAGES = {
    fail: { src: '/vampires/static/dice/fail.png', label: 'провал' },
    success: { src: '/vampires/static/dice/success.png', label: 'успех' },
    critical: { src: '/vampires/static/dice/critical-success.png', label: 'критический успех' },
    botch: { src: '/vampires/static/dice/fail.png', label: 'провал' },
    'hunger-fail': { src: '/vampires/static/dice/hunger-fail.png', label: 'провал Голода' },
    'hunger-success': { src: '/vampires/static/dice/hunger-success.png', label: 'успех Голода' },
    'hunger-critical-success': { src: '/vampires/static/dice/hunger-critical-success.png', label: 'критический успех Голода' },
    'hunger-critical-fail': { src: '/vampires/static/dice/hunger-critical-fail.png', label: 'критический провал Голода' }
};
let pendingDicePool = null;
let diceRollChannel = null;
let diceSupabaseClient = null;
let diceRealtimeChannel = null;
let diceRollStorageWarningShown = false;

function setupDiceRollsFromLockedSheet() {
    if (window.__diceRollsReady) return;
    window.__diceRollsReady = true;

    if ('BroadcastChannel' in window) {
        diceRollChannel = new BroadcastChannel(DICE_TABLE_CHANNEL);
    }

    document.addEventListener('click', (e) => {
        const target = e.target;
        const attrNameEl = target.closest?.('.attr-name');
        const skillNameEl = target.closest?.('.skill-name');
        const specLine = target.closest?.('.skill-spec-line');
        const disciplineItem = target.closest?.('.discipline-item:not(.xp-shop-discipline-option)');
        const dotLabel = target.closest?.('.dot-label');
        const dotRow = dotLabel?.closest?.('.row');
        const attrDot = dotLabel && dotRow?.querySelector('.attr-name') ? dotLabel : null;
        const skillDot = dotLabel && dotRow?.querySelector('.skill-name') ? dotLabel : null;
        const disciplineDot = target.closest?.('.discipline-item:not(.xp-shop-discipline-option) .disc-dot');
        const editableInsideDiscipline = disciplineItem && target.closest?.('button, input, select, textarea');

        if (!attrNameEl && !skillNameEl && !specLine && !disciplineItem && !attrDot && !skillDot && !disciplineDot) return;
        if (editableInsideDiscipline) return;
        if (startingSheetFixed && !expShopMode) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const attrRow = attrDot?.closest('.row');
            const skillRow = skillDot?.closest('.row');
            if (attrNameEl || attrDot) {
                const attrEl = attrNameEl || attrRow?.querySelector('.attr-name');
                const attrName = attrEl?.getAttribute('data-attr') || attrEl?.textContent.trim();
                openDiceRollModal({ first: makeDicePart('attr', attrName) });
                return;
            }
            if (skillNameEl || skillDot) {
                const skillEl = skillNameEl || skillRow?.querySelector('.skill-name');
                const skillName = skillEl?.getAttribute('data-skill') || skillEl?.textContent.trim();
                openDiceRollModal({ second: makeDicePart('skill', skillName) });
                return;
            }
            if (specLine) {
                const input = specLine.querySelector('input[type="text"]');
                const skillName = input?.dataset.skill || findSkillNameForSpecLine(specLine);
                const specName = input?.value.trim() || t('Специальность');
                openDiceRollModal({
                    second: makeDicePart('skill', skillName),
                    modifier: 1,
                    modifierLabel: specName
                });
                return;
            }
            const disciplineName = disciplineItem?.dataset.disciplineName || disciplineDot?.closest('.discipline-item')?.dataset.disciplineName || disciplineItem?.querySelector('.discipline-title')?.textContent.trim();
            if (disciplineName) openDiceRollModal({ first: makeDicePart('discipline', disciplineName) });
            return;
        }
        return;
    }, true);
}

function getSheetRoom() {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || localStorage.getItem('vtm-table-room') || 'campaign-666';
}

function getSheetUser() {
    try {
        return JSON.parse(localStorage.getItem('vtm-chat-user') || localStorage.getItem('vtm-sheet-user') || 'null');
    } catch {
        return null;
    }
}

function getSheetRealtimeChannel() {
    if (window.__sheetRealtimeChannel) return window.__sheetRealtimeChannel;
    if (!window.supabase) return null;
    const client = window.supabase.createClient(DICE_SUPABASE_URL, DICE_SUPABASE_ANON_KEY);
    const channel = client.channel(`table-room:${getSheetRoom()}`);
    channel.subscribe();
    window.__sheetRealtimeChannel = channel;
    return channel;
}

function showMasterItem(kind, title, body = '', meta = '') {
    const channel = getSheetRealtimeChannel();
    if (!channel) return alert(t('Realtime ещё не готов. Открой игровой стол и попробуй снова.'));
    const user = getSheetUser();
    const character = getFullCharacterData();
    channel.send({
        type: 'broadcast',
        event: 'master-reveal',
        payload: {
            room: getSheetRoom(),
            kind,
            title,
            body,
            meta,
            characterName: character.name || t('Безымянный'),
            userId: user?.id || '',
            username: user?.username || 'Игрок',
            createdAt: new Date().toISOString()
        }
    });
    alert(t('Показано мастеру.'));
}

window.showMasterItem = showMasterItem;

function findSkillNameForSpecLine(line) {
    const container = line.closest?.('.skill-specs');
    return container?.id?.replace('specs-', '') || '';
}

function getSkillDots(skillName) {
    const checked = document.querySelector(`input[name="${CSS.escape(skillName)}"]:checked`);
    return Math.max(0, parseInt(checked?.value || '0', 10) || 0);
}

function getAttributeDots(attrName) {
    const checked = document.querySelector(`input[name="${CSS.escape(attrName)}"]:checked`);
    return Math.max(0, parseInt(checked?.value || '0', 10) || 0);
}

function getDisciplineDots(disciplineName) {
    return Object.values(disciplineSources?.[disciplineName] || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function makeDicePart(type, name) {
    return `${type}:${name}`;
}

function escapeDiceHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseDicePart(value) {
    const [type, ...rest] = String(value || '').split(':');
    return { type, name: rest.join(':') };
}

function getDicePartLabel(type) {
    if (type === 'attr') return t('Характеристика');
    if (type === 'skill') return t('Навык');
    if (type === 'discipline') return t('Дисциплина');
    return t('Параметр');
}

function getDicePartDots(partValue) {
    const { type, name } = parseDicePart(partValue);
    if (!name) return 0;
    if (type === 'attr') return getAttributeDots(name);
    if (type === 'skill') return getSkillDots(name);
    if (type === 'discipline') return getDisciplineDots(name);
    return 0;
}

function getDicePartName(partValue) {
    return parseDicePart(partValue).name || '';
}

function getDicePoolOptions(selectedValue = '') {
    const sections = [
        {
            label: t('Характеристики'),
            items: DICE_ATTRIBUTES.map(name => ({ value: makeDicePart('attr', name), label: `${t(name)} (${getAttributeDots(name)})` }))
        },
        {
            label: t('Навыки'),
            items: DICE_SKILLS.map(name => ({ value: makeDicePart('skill', name), label: `${t(name)} (${getSkillDots(name)})` }))
        },
        {
            label: t('Дисциплины'),
            items: Object.keys(disciplineSources || {})
                .sort()
                .map(name => ({ value: makeDicePart('discipline', name), label: `${name} (${getDisciplineDots(name)})` }))
        }
    ];

    return `
        <option value="">${t('— не выбрано —')}</option>
        ${sections
            .filter(section => section.items.length > 0)
            .map(section => `
                <optgroup label="${section.label}">
                    ${section.items.map(item => `<option value="${escapeDiceHtml(item.value)}" ${item.value === selectedValue ? 'selected' : ''}>${escapeDiceHtml(item.label)}</option>`).join('')}
                </optgroup>
            `).join('')}
    `;
}

function getDiceRoom() {
    try {
        return new URLSearchParams(window.location.search).get('room') || DICE_TABLE_ROOM;
    } catch {
        return DICE_TABLE_ROOM;
    }
}

function getWillpowerImpairmentPenaltyForDiceParts(parts = []) {
    const state = getWillpowerState();
    if (!state.impaired) return 0;
    const names = parts.filter(Boolean).map(getDicePartName);
    return names.some(name => WILLPOWER_IMPAIRED_ATTRIBUTES.includes(name)) ? -2 : 0;
}

function getHealthImpairmentPenaltyForDiceParts(parts = []) {
    const state = getHealthTracker();
    if (!state.impaired) return 0;
    const names = parts.filter(Boolean).map(getDicePartName);
    return names.some(name => HEALTH_IMPAIRED_ATTRIBUTES.includes(name)) ? -2 : 0;
}

function openDiceRollModal(pool = {}) {
    pendingDicePool = {
        first: pool.first || '',
        second: pool.second || '',
        modifier: Number(pool.modifier || 0),
        modifierLabel: pool.modifierLabel || ''
    };

    const modal = getDiceRollModal();
    modal.querySelector('#dice-roll-title').textContent = t('Собрать пул');
    modal.querySelector('#dice-roll-subtitle').textContent = t('Выбери два параметра и добавь модификатор, если он нужен.');
    modal.querySelector('#dice-roll-part-1').innerHTML = getDicePoolOptions(pendingDicePool.first);
    modal.querySelector('#dice-roll-part-2').innerHTML = getDicePoolOptions(pendingDicePool.second);
    modal.querySelector('#dice-roll-modifier').value = String(pendingDicePool.modifier);
    modal.querySelector('#dice-roll-modifier-label').value = pendingDicePool.modifierLabel;
    const bloodSurge = modal.querySelector('#dice-roll-blood-surge');
    if (bloodSurge) bloodSurge.checked = Boolean(pool.useBloodSurge);
    modal.querySelector('#dice-roll-result').innerHTML = '';
    updateDiceRollPoolPreview();
    modal.style.display = 'flex';
}

function getDiceRollModal() {
    let modal = document.getElementById('dice-roll-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'dice-roll-modal';
    modal.innerHTML = `
        <div class="dice-roll-dialog">
            <button type="button" class="dice-roll-close" onclick="closeDiceRollModal()" title="${t('Закрыть')}">×</button>
            <div class="dice-roll-label">${t('Бросок кубиков')}</div>
            <h2 id="dice-roll-title">${t('Собрать пул')}</h2>
            <p id="dice-roll-subtitle">${t('Выбери два параметра и добавь модификатор, если он нужен.')}</p>
            <div class="dice-roll-builder">
                <label>
                    <span>${t('Первый параметр')}</span>
                    <select id="dice-roll-part-1" onchange="updateDiceRollPoolPreview()"></select>
                </label>
                <label>
                    <span>${t('Второй параметр')}</span>
                    <select id="dice-roll-part-2" onchange="updateDiceRollPoolPreview()"></select>
                </label>
                <label>
                    <span>${t('Доп. кубики')}</span>
                    <input id="dice-roll-modifier" type="number" min="-20" max="20" value="0" oninput="updateDiceRollPoolPreview()">
                </label>
                <label>
                    <span>${t('Источник модификатора')}</span>
                    <input id="dice-roll-modifier-label" type="text" placeholder="${t('специальность, кровь, сложность...')}" oninput="updateDiceRollPoolPreview()">
                </label>
                <label class="dice-roll-toggle">
                    <span id="dice-roll-blood-surge-label">${t('Прилив Крови')}</span>
                    <input id="dice-roll-blood-surge" type="checkbox" onchange="updateDiceRollPoolPreview()">
                </label>
            </div>
            <div id="dice-roll-pool-preview"></div>
            <div id="dice-roll-result"></div>
            <div class="dice-roll-actions">
                <button type="button" onclick="closeDiceRollModal()">${t('Отмена')}</button>
                <button type="button" class="dice-roll-primary" onclick="confirmDiceRoll()">${t('Бросить')}</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    return modal;
}

function readDiceRollPool() {
    const first = document.getElementById('dice-roll-part-1')?.value || '';
    const second = document.getElementById('dice-roll-part-2')?.value || '';
    const modifier = parseInt(document.getElementById('dice-roll-modifier')?.value || '0', 10) || 0;
    const modifierLabel = document.getElementById('dice-roll-modifier-label')?.value?.trim() || '';
    const useBloodSurge = Boolean(document.getElementById('dice-roll-blood-surge')?.checked);
    const bloodPotency = getCurrentBloodPotencyValue();
    const bloodSurgeBonus = useBloodSurge ? getBloodSurgeBonus(bloodPotency) : 0;
    const firstDots = getDicePartDots(first);
    const secondDots = getDicePartDots(second);
    const willpowerPenalty = getWillpowerImpairmentPenaltyForDiceParts([first, second]);
    const healthPenalty = getHealthImpairmentPenaltyForDiceParts([first, second]);
    const baseDiceCount = Math.max(0, firstDots + secondDots + modifier + willpowerPenalty + healthPenalty);
    const diceCount = Math.max(0, Math.min(20, baseDiceCount + bloodSurgeBonus));
    const parts = [first, second]
        .filter(Boolean)
        .map(part => getDicePartDots(part));
    const modifierName = modifierLabel || (modifier > 0 ? 'модификатор' : 'штраф');
    const poolName = [
        ...[first, second].filter(Boolean).map(getDicePartName),
        modifier ? modifierName : ''
    ].filter(Boolean).join(' + ');

    return {
        first,
        second,
        modifier,
        modifierLabel,
        useBloodSurge,
        bloodPotency,
        bloodSurgeBonus,
        willpowerPenalty,
        healthPenalty,
        firstDots,
        secondDots,
        baseDiceCount,
        diceCount,
        poolName: poolName || 'Свободный бросок',
        poolType: parts.join(' + ') || 'Свободный пул'
    };
}

function updateDiceRollPoolPreview() {
    const preview = document.getElementById('dice-roll-pool-preview');
    if (!preview) return;

    const pool = readDiceRollPool();
    const hungerDiceCount = getCurrentHungerDiceCount(pool.diceCount);
    const bloodSurgeLabel = document.getElementById('dice-roll-blood-surge-label');
    if (bloodSurgeLabel) {
        bloodSurgeLabel.textContent = tf('Прилив Крови +{bonus}к10', { bonus: getBloodSurgeBonus() });
    }
    const modifierText = pool.modifier
        ? ` ${pool.modifier > 0 ? '+' : '-'} ${Math.abs(pool.modifier)}${pool.modifierLabel ? ` (${pool.modifierLabel})` : ''}`
        : '';
    const surgeText = pool.useBloodSurge ? tf(' + Прилив Крови {bonus}', { bonus: pool.bloodSurgeBonus }) : '';
    const willpowerText = pool.willpowerPenalty ? tf(' · Воля: {n}к10', { n: pool.willpowerPenalty }) : '';
    const healthText = pool.healthPenalty ? tf(' · Здоровье: {n}к10', { n: pool.healthPenalty }) : '';

    preview.innerHTML = `
        <strong>${pool.diceCount}${window.VTM_LANG === 'en' ? 'd10' : 'к10'}</strong>
        <span>${escapeDiceHtml(`${pool.firstDots} + ${pool.secondDots}${modifierText}${surgeText}`)}${willpowerText}${healthText}${hungerDiceCount ? tf(' · Голод: {n}', { n: hungerDiceCount }) : ''}</span>
    `;
}

function closeDiceRollModal() {
    const modal = document.getElementById('dice-roll-modal');
    if (modal) modal.style.display = 'none';
    pendingDicePool = null;
}

function getCurrentHungerDiceCount(diceCount = Infinity) {
    const hunger = Math.max(0, Math.min(5, parseInt(vitalTrackers.hunger || 0, 10) || 0));
    return Math.max(0, Math.min(hunger, Math.max(0, parseInt(diceCount, 10) || 0)));
}

function getDiceKind(value, isHunger) {
    if (isHunger) {
        if (value === 1) return 'hunger-critical-fail';
        if (value === 10) return 'hunger-critical-success';
        return value >= 6 ? 'hunger-success' : 'hunger-fail';
    }
    if (value === 10) return 'critical';
    return value >= 6 ? 'success' : 'fail';
}

function rollD10Pool(count, hungerDiceCount = 0) {
    const safeCount = Math.max(0, Math.min(20, parseInt(count, 10) || 0));
    const safeHungerDiceCount = Math.max(0, Math.min(5, safeCount, parseInt(hungerDiceCount, 10) || 0));
    return Array.from({ length: safeCount }, (_, index) => {
        const value = Math.floor(Math.random() * 10) + 1;
        const kind = getDiceKind(value, index < safeHungerDiceCount);
        return { value, kind };
    });
}

function countV5Successes(dice) {
    const criticals = dice.filter(die => die.value === 10).length;
    const regularSuccesses = dice.filter(die => die.value >= 6 && die.value < 10).length;
    return regularSuccesses + Math.floor(criticals / 2) * 4 + (criticals % 2);
}

function getRollOutcomeMeta(dice, successes) {
    const totalCriticals = dice.filter(die => die.value === 10).length;
    const hungerCriticals = dice.filter(die => die.value === 10 && String(die.kind).startsWith('hunger')).length;
    const hungerOnes = dice.filter(die => die.value === 1 && String(die.kind).startsWith('hunger')).length;
    return {
        messyCritical: successes > 0 && totalCriticals >= 2 && hungerCriticals > 0,
        bestialFailure: successes <= 0 && hungerOnes > 0
    };
}

function getRouseWarning(result) {
    if (!result?.maxHungerWarning) return '';
    return 'Голод уже 5. Неудачное Испытание Крови на максимальном Голоде: нужна реакция Рассказчика / риск голодной ярости.';
}

async function performRouseCheck(reason = 'Испытание Крови / Проверка Голода', options = {}) {
    const hungerBefore = clampHunger(vitalTrackers.hunger);
    const value = Math.floor(Math.random() * 10) + 1;
    const success = value >= 6;
    const hungerAfter = success ? hungerBefore : clampHunger(hungerBefore + 1);
    const result = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        reason,
        value,
        success,
        hungerBefore,
        hungerAfter,
        maxHungerWarning: !success && hungerBefore >= 5
    };

    if (hungerAfter !== hungerBefore) {
        vitalTrackers.hunger = hungerAfter;
        renderVitalTracker('hunger');
    }
    await autoSaveVitalState({ immediate: true });

    if (options.publish !== false) {
        const die = { value, kind: getDiceKind(value, false) };
        const warning = getRouseWarning(result);
        const roll = {
            id: result.id,
            room: getDiceRoom(),
            characterName: document.getElementById('char-name')?.value?.trim() || t('Безымянный'),
            poolName: reason,
            poolType: 'rouse-check',
            diceCount: 1,
            dice: [die],
            successes: success ? 1 : 0,
            createdAt: new Date().toISOString(),
            meta: {
                source: 'rouse_check',
                hungerBefore,
                hungerAfter,
                bloodPotency: getCurrentBloodPotencyValue(),
                rouseChecks: [result],
                warnings: warning ? [warning] : []
            }
        };
        publishDiceRoll(roll);
        const container = document.getElementById('dice-roll-result');
        if (container) container.innerHTML = renderDicePreview([die], roll.successes, roll.meta);
    }

    return result;
}

function renderDicePreview(dice, successes, meta = {}) {
    const callouts = [];
    if (meta.bloodSurge?.enabled) {
        const rouseSummary = (meta.rouseChecks || []).map(result => result.success ? t('успех') : t('провал')).join(', ') || t('проведено');
        callouts.push({
            kind: 'warning',
            text: tf('Прилив Крови: +{bonus}к10. Испытание Крови: {summary}.', { bonus: meta.bloodSurge.bonusDice, summary: rouseSummary })
        });
    }
    (meta.rouseChecks || []).forEach(result => {
        if (!meta.bloodSurge?.enabled) {
            callouts.push({
                kind: result.success ? 'warning' : 'warning',
                text: tf('{reason}: {value} — {outcome}', {
                    reason: t(result.reason),
                    value: result.value,
                    outcome: result.success ? t('успех, Голод не меняется') : t('провал, Голод растёт')
                })
            });
        }
    });
    if (typeof meta.hungerBefore === 'number' && typeof meta.hungerAfter === 'number' && meta.hungerBefore !== meta.hungerAfter) {
        callouts.push({ kind: 'warning', text: tf('Голод: {before} → {after}', { before: meta.hungerBefore, after: meta.hungerAfter }) });
    }
    if (typeof meta.spentWillpower === 'number' && meta.spentWillpower > 0) {
        callouts.push({ kind: 'warning', text: tf('Воля потрачена: {n}', { n: meta.spentWillpower }) });
    }
    if (typeof meta.recoveredWillpower === 'number' && meta.recoveredWillpower > 0) {
        callouts.push({ kind: 'warning', text: tf('Воля восстановлена: {n}', { n: meta.recoveredWillpower }) });
    }
    if (meta.willpowerBefore && meta.willpowerAfter) {
        callouts.push({
            kind: meta.willpowerAfter.current <= 0 ? 'danger' : 'warning',
            text: tf('Воля: {before} → {after} / {max}', { before: meta.willpowerBefore.current, after: meta.willpowerAfter.current, max: meta.willpowerAfter.max })
        });
    }
    if (meta.impairmentPenaltyApplied) {
        callouts.push({ kind: 'warning', text: tf('Истощение Воли: {n}к10 к ментальной/социальной проверке.', { n: meta.impairmentPenaltyApplied }) });
    }
    if (meta.healthImpairmentPenaltyApplied) {
        callouts.push({ kind: 'warning', text: tf('Изнурение по здоровью: {n}к10 к физической проверке.', { n: meta.healthImpairmentPenaltyApplied }) });
    }
    if (meta.damage) {
        const severity = meta.damage.severity === 'aggravated' ? t('тяжёлых') : t('лёгких');
        const halvedNote = meta.damage.halved ? tf(' → после деления {final}', { final: meta.damage.finalAmount }) : '';
        callouts.push({
            kind: 'warning',
            text: tf('Урон: {amount} {severity}{halvedNote}.', { amount: meta.damage.originalAmount, severity, halvedNote })
        });
    }
    if (meta.healthBefore && meta.healthAfter) {
        callouts.push({
            kind: meta.healthAfter.current <= 0 ? 'danger' : 'warning',
            text: tf('Здоровье: {before} → {after} / {max} · / {superficial} · X {aggravated}', {
                before: meta.healthBefore.current, after: meta.healthAfter.current, max: meta.healthAfter.max,
                superficial: meta.healthAfter.superficial, aggravated: meta.healthAfter.aggravated
            })
        });
    }
    if (meta.healing) {
        const healed = (meta.healing.amountSuperficial || 0) + (meta.healing.amountAggravated || 0);
        callouts.push({ kind: 'warning', text: tf('Лечение здоровья: снято {healed} поврежд.', { healed }) });
    }
    if (meta.rollKind === 'remorse_check') {
        callouts.push({
            kind: meta.humanityLost ? 'danger' : 'warning',
            text: meta.automaticFailure
                ? t('Свободных ячеек нет: автоматический провал проверки мук совести.')
                : tf('Проверка мук совести: {dice}к10, обычные кубики без Голода.', { dice: meta.remorseDice || 0 })
        });
    }
    if (typeof meta.humanityBefore === 'number' && typeof meta.humanityAfter === 'number') {
        callouts.push({
            kind: meta.humanityAfter < meta.humanityBefore ? 'danger' : 'warning',
            text: tf('Человечность: {before} → {after}.', { before: meta.humanityBefore, after: meta.humanityAfter })
        });
    }
    if (typeof meta.stainsBefore === 'number' && typeof meta.stainsAfter === 'number' && meta.stainsBefore !== meta.stainsAfter) {
        callouts.push({ kind: 'warning', text: tf('Сомнения: {before} → {after}.', { before: meta.stainsBefore, after: meta.stainsAfter }) });
    }
    if (meta.messyCritical) {
        callouts.push({ kind: 'danger', text: t('Кровавый триумф: успех достигнут через Зверя. Рассказчик должен добавить зверское/опасное осложнение.') });
    }
    if (meta.bestialFailure) {
        callouts.push({ kind: 'danger', text: t('Кровавый провал: Зверь вмешивается. Рассказчик должен добавить осложнение.') });
    }
    (meta.warnings || []).forEach(text => callouts.push({ kind: 'warning', text: t(text) }));

    return `
        <div class="dice-roll-dice">
            ${dice.map(die => {
                const image = DICE_ROLL_IMAGES[die.kind] || DICE_ROLL_IMAGES.fail;
                const label = t(image.label);
                return `<span class="dice-roll-die dice-roll-${die.kind}" aria-label="${escapeDiceHtml(`${label}: ${die.value}`)}" title="${escapeDiceHtml(`${die.value} - ${label}`)}"><img src="${image.src}" alt="" draggable="false"></span>`;
            }).join('')}
        </div>
        <div class="dice-roll-successes">${tf('Успехов: {successes}', { successes })}</div>
        ${callouts.length ? `<div class="dice-roll-callouts">${callouts.map(callout => `<div class="dice-roll-callout ${callout.kind === 'danger' ? '' : 'warning'}">${escapeDiceHtml(callout.text)}</div>`).join('')}</div>` : ''}
    `;
}

async function confirmDiceRoll() {
    if (!pendingDicePool) return;

    const pool = readDiceRollPool();
    if (!pool.first && !pool.second) {
        alert(t('Выбери хотя бы один параметр для броска.'));
        return;
    }
    if (pool.diceCount < 1) {
        alert(t('В пуле нет кубиков. Выбери параметры с точками или добавь модификатор.'));
        return;
    }

    const hungerBefore = clampHunger(vitalTrackers.hunger);
    const willpowerBefore = getWillpowerState();
    const rouseChecks = [];
    if (pool.useBloodSurge) {
        const result = await performRouseCheck('Прилив Крови', { publish: false });
        rouseChecks.push(result);
    }

    const hungerAfterRouse = clampHunger(vitalTrackers.hunger);
    const willpowerAfter = getWillpowerState();
    const hungerDice = getCurrentHungerDiceCount(pool.diceCount);
    const dice = rollD10Pool(pool.diceCount, hungerDice);
    const successes = countV5Successes(dice);
    const outcomeMeta = getRollOutcomeMeta(dice, successes);
    const warnings = [
        ...rouseChecks.map(getRouseWarning).filter(Boolean),
        ...(pool.willpowerPenalty ? ['Трек Воли заполнен: ментальная или социальная проверка получает -2к10.'] : []),
        ...(pool.healthPenalty ? ['Шкала здоровья заполнена: физическая проверка получает -2к10.'] : [])
    ];
    const meta = {
        source: pool.useBloodSurge ? 'blood_surge' : 'character_sheet',
        hungerBefore,
        hungerAfter: hungerAfterRouse,
        hungerDice,
        bloodPotency: pool.bloodPotency,
        willpowerBefore: getWillpowerMetaState(willpowerBefore),
        willpowerAfter: getWillpowerMetaState(willpowerAfter),
        willpowerImpaired: willpowerAfter.impaired,
        impairmentPenaltyApplied: pool.willpowerPenalty || undefined,
        healthImpairmentPenaltyApplied: pool.healthPenalty || undefined,
        healthImpaired: getHealthTracker().impaired,
        physicalState: getHealthTracker().physicalState,
        rouseChecks,
        bloodSurge: pool.useBloodSurge ? {
            enabled: true,
            bonusDice: pool.bloodSurgeBonus
        } : undefined,
        ...outcomeMeta,
        warnings
    };
    const roll = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        room: getDiceRoom(),
        characterName: document.getElementById('char-name')?.value?.trim() || t('Безымянный'),
        poolName: pool.poolName,
        poolType: pool.poolType,
        diceCount: pool.diceCount,
        dice,
        successes,
        createdAt: new Date().toISOString(),
        meta
    };

    publishDiceRoll(roll);
    document.getElementById('dice-roll-result').innerHTML = renderDicePreview(dice, successes, meta);
}

function getDiceSupabaseClient() {
    if (diceSupabaseClient) return diceSupabaseClient;
    if (!window.supabase?.createClient) return null;
    diceSupabaseClient = window.supabase.createClient(DICE_SUPABASE_URL, DICE_SUPABASE_ANON_KEY);
    return diceSupabaseClient;
}

function getDiceRealtimeChannel(room) {
    const client = getDiceSupabaseClient();
    if (!client) return null;
    if (diceRealtimeChannel) return diceRealtimeChannel;

    diceRealtimeChannel = client.channel(`table-rolls:${room}`);
    diceRealtimeChannel.subscribe();
    return diceRealtimeChannel;
}

function broadcastDiceRoll(roll) {
    const channel = getDiceRealtimeChannel(roll.room);
    channel?.send({
        type: 'broadcast',
        event: 'roll',
        payload: roll
    });
}

function cacheDiceRollLocally(roll) {
    const storageKey = `${DICE_TABLE_STORAGE_PREFIX}${roll.room}`;
    let history = [];

    try {
        history = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!Array.isArray(history)) history = [];
    } catch {
        history = [];
    }

    history = [roll, ...history.filter(item => item.id !== roll.id)].slice(0, 80);
    localStorage.setItem(storageKey, JSON.stringify(history));
    localStorage.setItem('vtm-table-last-roll', JSON.stringify(roll));
    diceRollChannel?.postMessage(roll);
}

async function publishDiceRoll(roll) {
    const client = getDiceSupabaseClient();

    if (!client) {
        console.error('Supabase client is unavailable for table rolls.');
        broadcastDiceRoll(roll);
        cacheDiceRollLocally(roll);
        return;
    }

    const payload = {
        id: roll.id,
        room: roll.room,
        character_name: roll.characterName,
        pool_name: roll.poolName,
        pool_type: roll.poolType,
        dice_count: roll.diceCount,
        dice: roll.dice,
        successes: roll.successes,
        meta: roll.meta || {},
        created_at: roll.createdAt
    };

    let { error } = await client
        .from('table_rolls')
        .insert(payload);

    if (error && /meta/i.test(error.message || '')) {
        const { meta, ...legacyPayload } = payload;
        const fallback = await client.from('table_rolls').insert(legacyPayload);
        error = fallback.error;
    }

    if (error) {
        console.error('Не удалось отправить бросок на общий стол:', error);
        if (!diceRollStorageWarningShown) {
            diceRollStorageWarningShown = true;
            alert(t('Бросок отправлен онлайн, но не сохранился в общую историю. Нужно создать таблицу table_rolls в Supabase.'));
        }
        broadcastDiceRoll(roll);
        cacheDiceRollLocally(roll);
        return;
    }

    broadcastDiceRoll(roll);
}

async function performSheetWillpowerCheck() {
    if (!isCharacterSheetFixed()) return;
    const state = getWillpowerState();
    if (state.current < 1) {
        alert(t('Доступной Воли нет: проверку Воли бросить нельзя.'));
        return;
    }

    const dice = rollD10Pool(state.current, 0);
    const successes = countV5Successes(dice);
    const meta = {
        source: 'willpower',
        hungerDice: 0,
        willpowerBefore: getWillpowerMetaState(state),
        willpowerAfter: getWillpowerMetaState(state),
        willpowerImpaired: state.impaired,
        warnings: ['Проверка Воли бросает текущую доступную Волю и не использует кубики Голода.']
    };
    const roll = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        room: getDiceRoom(),
        characterName: document.getElementById('char-name')?.value?.trim() || t('Безымянный'),
        poolName: 'Проверка Воли',
        poolType: 'willpower-check',
        diceCount: dice.length,
        dice,
        successes,
        createdAt: new Date().toISOString(),
        meta
    };
    const modal = getDiceRollModal();
    modal.querySelector('#dice-roll-title').textContent = t('Проверка Воли');
    modal.querySelector('#dice-roll-subtitle').textContent = t('Бросается текущая доступная Воля. Кубики Голода не добавляются.');
    modal.querySelector('#dice-roll-result').innerHTML = renderDicePreview(dice, successes, meta);
    modal.style.display = 'flex';
    await publishDiceRoll(roll);
}

window.openDiceRollModal = openDiceRollModal;
window.closeDiceRollModal = closeDiceRollModal;
window.confirmDiceRoll = confirmDiceRoll;
window.updateDiceRollPoolPreview = updateDiceRollPoolPreview;
window.spendSheetWillpower = spendSheetWillpower;
window.recoverSheetWillpowerSessionStart = recoverSheetWillpowerSessionStart;
window.recoverSheetWillpowerDesire = recoverSheetWillpowerDesire;
window.recoverSheetWillpowerAggravated = recoverSheetWillpowerAggravated;
window.adjustSheetWillpowerStress = adjustSheetWillpowerStress;
window.performSheetWillpowerCheck = performSheetWillpowerCheck;
window.adjustSheetHealthDamage = adjustSheetHealthDamage;
window.openSheetHealthDamagePrompt = openSheetHealthDamagePrompt;
window.mendSheetVampireSuperficial = mendSheetVampireSuperficial;
window.mendSheetVampireAggravated = mendSheetVampireAggravated;
window.recoverSheetMortalHealth = recoverSheetMortalHealth;
window.treatSheetMortalHealth = treatSheetMortalHealth;
window.clearSheetHealth = clearSheetHealth;
window.markSheetHealthDefeated = markSheetHealthDefeated;
window.setInitialHunger = setInitialHunger;
window.getHumanityState = getHumanityState;
window.addHumanityStains = addHumanityStains;
window.removeHumanityStains = removeHumanityStains;
window.clearHumanityStains = clearHumanityStains;
window.performRemorseCheck = performRemorseCheck;
window.submitHumanityEvent = submitHumanityEvent;
window.updateHumanityEventAmountControl = updateHumanityEventAmountControl;
window.syncMoralityEditor = syncMoralityEditor;
window.performSheetRouseCheck = async () => {
    if (!isCharacterSheetFixed()) return;
    const modal = getDiceRollModal();
    modal.querySelector('#dice-roll-title').textContent = t('Проверка Голода');
    modal.querySelector('#dice-roll-subtitle').textContent = t('Испытание Крови бросает один обычный d10. На 1–5 Голод растёт на 1.');
    modal.querySelector('#dice-roll-result').innerHTML = '';
    modal.style.display = 'flex';
    await performRouseCheck('Испытание Крови / Проверка Голода');
};

function updateSpecUI(skillName = null) {
    if (skillName) {
        const container = document.getElementById('specs-' + skillName);
        const checkbox = document.getElementById('s-' + skillName);
        
        if (container && checkbox) {
            const hasLines = container.children.length > 0;
            checkbox.checked = hasLines;   // ← главное
            
            if (!hasLines) {
                container.style.display = 'none';
            }
        }
    }

    // Общий счётчик
    const total = getSpecialtyCount();
    const isMortal = (currentCharType === 'mortal' || currentCharType === 'npc-mortal');
    const mortalTemplate = isMortal && currentMortalTemplate
        ? MORTAL_TEMPLATES.find(template => template.id === currentMortalTemplate)
        : null;
    const limit = mortalTemplate?.specs ?? (isMortal ? 0 : VAMPIRE_SPECIALTY_LIMIT);
    document.getElementById('spec-tracker').textContent = tf('Специализации (S): {current} / {max}', { current: total, max: limit });
    
    checkLimits();
}

// ==================== СПЕЦИАЛИЗАЦИИ (S-БЕЙДЖ) ====================

function updateSBadgeState(skillName) {
    const badge = document.querySelector(`label[for="s-${skillName}"]`);
    const checkbox = document.getElementById(`s-${skillName}`);
    const container = document.getElementById('specs-' + skillName);
    
    if (!badge || !checkbox) return;

    const dots = parseInt(document.querySelector(`input[name="${skillName}"]:checked`)?.value || 0);
    const hasActiveSpecs = container && container.children.length > 0;

    if (dots === 0) {
        // Нет точек — полностью выключаем
        badge.style.color = '#444';
        badge.style.borderColor = '#444';
        checkbox.checked = false;
        if (container) container.style.display = 'none';
    } else {
        // Есть точки
        if (hasActiveSpecs) {
            // Зажжён
            badge.style.color = '#ff3131';
            badge.style.borderColor = '#ff3131';
            checkbox.checked = true;
        } else {
            // Должен быть серым
            badge.style.color = '#444';
            badge.style.borderColor = '#444';
            checkbox.checked = false;
        }
    }
}

window.updateTrackers = updateTrackers;
window.addSpecLine = addSpecLine;
window.updateSpecUI = updateSpecUI;
window.updateSBadgeState = updateSBadgeState;





// ==================== ПОДСКАЗКИ ДЛЯ НАВЫКОВ ====================
async function preloadAllSkills() {
    const skills = Object.keys(RULES.skills || {});
    console.log(`Загружаем подсказки для ${skills.length} навыков`);

    for (let skill of skills) {
        const data = RULES.skills[skill];
        if (!data) continue;
        const canonicalSkill = vtmCanonicalName(skill);

        let fullText = `${skill}\n\n${data.description || t('Описание отсутствует')}`;
        if (data.specialties && data.specialties.length) {
            fullText += tf('\n\n{label}: {specs}', { label: t('Специализации'), specs: data.specialties.join(', ') });
        }

        // Название навыка
        document.querySelectorAll(`[data-skill="${canonicalSkill}"]`).forEach(el => {
            el.setAttribute('data-tooltip', fullText);
        });

        // Точки
        for (let level = 1; level <= 5; level++) {
            const dotDesc = data[`dot${level}`];
            if (dotDesc) {
                const text = `${skill} ● ${level}\n${dotDesc}`;
                document.querySelectorAll(`label[data-name="${canonicalSkill}"][data-level="${level}"]`)
                    .forEach(label => label.setAttribute('data-tooltip', text));
            }
        }
    }
}

async function preloadAllAttributes() {
    const attributes = ["Сила", "Ловкость", "Выносливость", "Обаяние", "Манипуляция", "Самообладание", "Интеллект", "Смекалка", "Упорство"];

    for (let attr of attributes) {
        const data = RULES.attributes?.[vtmName(attr)] || { description: t("Характеристика персонажа.") };

        let fullText = `${attr}\n\n${data.description || t('Нет описания.')}`;

        document.querySelectorAll(`[data-attr="${attr}"]`).forEach(el => {
            el.setAttribute('data-tooltip', fullText);
        });

        for (let level = 1; level <= 5; level++) {
            const dotDesc = data[`dot${level}`] || tf('Уровень {level}', { level });
            document.querySelectorAll(`label[data-name="${attr}"][data-level="${level}"]`)
                .forEach(label => {
                    label.setAttribute('data-tooltip', `${attr} ● ${level}\n${dotDesc}`);
                });
        }
    }
}








// ==================== СПЕЦИАЛИЗАЦИИ ОТ ОХОТЫ ====================
let currentPredatorSpecialty = null;

function getTraitPoints(item) {
    return item?.points ?? item?.dots ?? item?.точки ?? 0;
}

function getTraitCategoryDefinition(item, isMerit = true) {
    const source = isMerit
        ? (RULES.advantages?.merits || {})
        : (RULES.advantages?.flaws || RULES.flaws || {});
    const categoryName = String(item?.category || item?.категория || '').toLowerCase();
    return Object.values(source).find(category => String(category?.название || '').toLowerCase() === categoryName) || null;
}

function getPredatorBasePoints(item) {
    if (!item?.fromPredator) return 0;
    const stored = parseInt(item.predatorBasePoints, 10);
    if (stored > 0) return stored;

    const predatorData = RULES.predator_types?.[item.predatorType];
    const rawItem = (predatorData?.advantages || []).find(raw => {
        const sameCategory = String(raw?.category || '').toLowerCase() === String(item.category || '').toLowerCase();
        const rawName = String(raw?.name || raw?.название_пункта || '').toLowerCase();
        const baseName = String(item.predatorBaseName || item.name || '').toLowerCase();
        return sameCategory && rawName === baseName;
    });
    return getTraitPoints(rawItem) || getTraitPoints(item);
}

function getPaidMeritPoints(item) {
    const points = getTraitPoints(item);
    return item?.fromPredator ? Math.max(0, points - getPredatorBasePoints(item)) : points;
}

function getTraitVariantAtPoints(item, points, isMerit = true) {
    const category = getTraitCategoryDefinition(item, isMerit);
    const variant = (category?.варианты || []).find(option => parseInt(option.точки, 10) === points);
    return variant ? { category, variant } : null;
}

function applyTraitVariant(item, points, isMerit = true) {
    const resolved = getTraitVariantAtPoints(item, points, isMerit);
    if (!resolved) return null;
    const predatorDetails = item.predatorDetails || '';
    const descParts = [resolved.variant.полное_описание || ''];
    if (predatorDetails) descParts.push(tf('<em>{label}</em> {details}', { label: t('Уточнение от типа охоты:'), details: predatorDetails }));

    return {
        ...item,
        category: resolved.category.название || item.category,
        categoryDesc: resolved.category.описание || item.categoryDesc || '',
        name: resolved.variant.название_пункта || item.name,
        points,
        dots: points,
        desc: descParts.filter(Boolean).join('<br><br>'),
        mechanic: resolved.variant.механика || item.mechanic || '',
        roll: resolved.variant.roll || item.roll || '',
        difficulty: resolved.variant.difficulty || item.difficulty || '',
        bonus: resolved.variant.bonus || item.bonus || ''
    };
}

function findTraitDefinition(rawItem, isMerit) {
    const source = isMerit
        ? (RULES.advantages?.merits || {})
        : (RULES.advantages?.flaws || RULES.flaws || {});
    const rawCategory = rawItem?.category || rawItem?.категория || '';
    const rawName = rawItem?.name || rawItem?.название_пункта || rawItem || '';
    const rawVariant = rawItem?.variant || rawItem?.вариант || '';
    const requestedPoints = getTraitPoints(rawItem);

    const categories = Object.values(source);
    const category = categories.find(cat => (cat.название || '').toLowerCase() === String(rawCategory).toLowerCase())
        || categories.find(cat => (cat.варианты || []).some(v => (v.название_пункта || '').toLowerCase() === String(rawName).toLowerCase()));

    if (!category) return null;

    const variants = category.варианты || [];
    const wantedName = rawVariant || rawName;
    let variant = variants.find(v => (v.название_пункта || '').toLowerCase() === String(wantedName).toLowerCase());

    if (!variant && requestedPoints > 0) {
        variant = variants.find(v => (v.точки || 0) === requestedPoints);
    }

    if (!variant && rawCategory && String(rawName).toLowerCase() === String(rawCategory).toLowerCase()) {
        variant = variants[0];
    }

    return variant ? { category, variant } : null;
}

function buildPredatorTrait(rawItem, isMerit, predName) {
    const resolved = findTraitDefinition(rawItem, isMerit);
    const category = resolved?.category;
    const variant = resolved?.variant;
    const details = rawItem?.details || rawItem?.уточнение || '';
    const name = rawItem?.name || variant?.название_пункта || rawItem;
    const points = getTraitPoints(rawItem) || variant?.точки || 0;

    const descParts = [];
    const baseDesc = rawItem?.desc || rawItem?.полное_описание || variant?.полное_описание || '';
    if (baseDesc) descParts.push(baseDesc);
    if (details) descParts.push(tf('<em>{label}</em> {details}', { label: t('Уточнение от типа охоты:'), details }));

    return {
        category: rawItem?.category || category?.название || t('Стиль охоты'),
        categoryDesc: rawItem?.categoryDesc || category?.описание || '',
        name,
        points,
        dots: points,
        desc: descParts.join('<br><br>'),
        mechanic: rawItem?.mechanic || rawItem?.механика || variant?.механика || '',
        roll: rawItem?.roll || variant?.roll || '',
        difficulty: rawItem?.difficulty || variant?.difficulty || '',
        bonus: rawItem?.bonus || variant?.bonus || '',
        fromPredator: true,
        predatorType: predName,
        predatorBaseName: name,
        predatorBasePoints: points,
        predatorDetails: details
    };
}

function formatPredatorTraitLine(rawItem, isMerit) {
    const resolved = findTraitDefinition(rawItem, isMerit);
    const name = rawItem?.name || resolved?.variant?.название_пункта || rawItem;
    const points = getTraitPoints(rawItem) || resolved?.variant?.точки || 0;
    const details = rawItem?.details || rawItem?.уточнение || '';
    return `${name}${points ? ` (${points})` : ''}${details ? ` — ${details}` : ''}`;
}

function isPredatorChoiceItem(item) {
    return Boolean(item?.choice_group || item?.allocation_group);
}

function addPredatorItemToSheet(rawItem, isMerit, predName) {
    const item = buildPredatorTrait(rawItem, isMerit, predName);
    const target = isMerit ? selectedMerits : selectedFlaws;
    const exists = target.some(existing =>
        existing.fromPredator &&
        existing.predatorType === predName &&
        existing.category === item.category &&
        existing.name === item.name &&
        getTraitPoints(existing) === getTraitPoints(item)
    );
    if (!exists) target.push(item);
}

function getPredatorChoiceGroups(predData) {
    const groups = {};
    [
        ...(predData.advantages || []).map(item => ({ item, isMerit: true })),
        ...(predData.disadvantages || []).map(item => ({ item, isMerit: false }))
    ].forEach(entry => {
        const groupName = entry.item?.choice_group;
        if (!groupName) return;
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(entry);
    });
    return groups;
}

function getPredatorAllocationGroups(predData) {
    const groups = {};
    [
        ...(predData.advantages || []).map(item => ({ item, isMerit: true })),
        ...(predData.disadvantages || []).map(item => ({ item, isMerit: false }))
    ].forEach(entry => {
        const groupName = entry.item?.allocation_group;
        if (!groupName) return;
        if (!groups[groupName]) {
            groups[groupName] = {
                total: parseInt(entry.item.allocation_total || 0, 10) || 0,
                entries: []
            };
        }
        groups[groupName].entries.push(entry);
    });
    return groups;
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function getInputValue(id) {
    return document.getElementById(id)?.value?.trim() || '';
}

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

function updateClanBaneField() {
    const clanName = document.getElementById('clan-input')?.value?.trim() || '';
    const bane = clanName ? (RULES.clans?.[clanName]?.bane || '') : '';
    setInputValue('clan-bane-input', bane);
}

function renderCharacterImage() {
    const image = document.getElementById('character-image-preview');
    const placeholder = document.getElementById('character-image-placeholder');
    if (!image || !placeholder) return;

    if (characterImageData) {
        image.src = characterImageData;
        image.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        image.removeAttribute('src');
        image.style.display = 'none';
        placeholder.style.display = 'flex';
    }
}

function readImageAsCompressedDataURL(file, maxSize = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error(t('Выберите файл изображения.')));
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error(t('Не удалось прочитать изображение.')));
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error(t('Не удалось обработать изображение.')));
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

async function uploadCharacterImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const dataUrl = await readImageAsCompressedDataURL(file);
        characterImageData = dataUrl;
        renderCharacterImage();
        // Переносим портрет в Storage: в данных листа остаётся только URL.
        const storageUrl = await window.uploadPortraitDataUrl?.(dataUrl, 'portrait');
        if (storageUrl) {
            characterImageData = storageUrl;
            renderCharacterImage();
        }
    } catch (err) {
        alert(err.message || t('Ошибка загрузки изображения.'));
    } finally {
        event.target.value = '';
    }
}

function deleteCharacterImage() {
    characterImageData = '';
    renderCharacterImage();
}

function normalizeTouchstoneItem(item, index = 0) {
    const normalized = item && typeof item === 'object'
        ? item
        : { text: String(item || '') };
    const legacyText = String(normalized.text || '').trim();
    normalized.id = normalized.id || `touchstone-${Date.now()}-${index}`;
    normalized.name = String(normalized.name || '').trim();
    normalized.principle = String(normalized.principle || normalized.conviction || '').trim();
    normalized.description = String(normalized.description || '').trim();
    normalized.image = normalized.image || '';
    normalized.status = ['safe', 'threatened', 'harmed', 'lost'].includes(normalized.status)
        ? normalized.status
        : 'safe';

    if (!normalized.principle && legacyText) normalized.principle = legacyText;
    normalized.text = formatTouchstoneText(normalized);
    return normalized;
}

function ensureTouchstone(index) {
    if (!touchstones[index]) return null;
    touchstones[index] = normalizeTouchstoneItem(touchstones[index], index);
    return touchstones[index];
}

function formatTouchstoneText(item = {}) {
    const name = String(item.name || '').trim();
    const principle = String(item.principle || '').trim();
    const description = String(item.description || '').trim();
    return [
        name,
        principle ? `${t('Принцип')}: ${principle}` : '',
        description
    ].filter(Boolean).join('\n');
}

function getTouchstoneLabel(item, index) {
    return String(item?.name || item?.principle || item?.text || '').trim()
        || tf('Опора {n}', { n: index + 1 });
}

function getTouchstoneDescription(item = {}) {
    return [
        item.principle ? `${t('Принцип')}: ${item.principle}` : '',
        item.description || ''
    ].filter(Boolean).join('\n');
}

function getTouchstonesSnapshot() {
    return (touchstones || []).map((item, index) => {
        const copy = item && typeof item === 'object'
            ? JSON.parse(JSON.stringify(item))
            : { text: String(item || '') };
        return normalizeTouchstoneItem(copy, index);
    });
}

function updateTouchstoneField(index, field, value, options = {}) {
    const item = ensureTouchstone(index);
    if (!item || !['name', 'principle', 'description'].includes(field)) return null;
    item[field] = String(value || '');
    item.text = formatTouchstoneText(item);
    getMoralityData();
    updateHumanityFormOptions();
    autoSaveVitalState({ immediate: Boolean(options.immediate) });
    if (options.render) renderTouchstones();
    return JSON.parse(JSON.stringify(item));
}

function updateTouchstoneStatus(index, status, options = {}) {
    const item = ensureTouchstone(index);
    if (!item) return null;
    item.status = ['safe', 'threatened', 'harmed', 'lost'].includes(status) ? status : 'safe';
    getMoralityData();
    updateHumanityFormOptions();
    autoSaveVitalState({ immediate: options.immediate !== false });
    if (options.render) renderTouchstones();
    return JSON.parse(JSON.stringify(item));
}

function removeTouchstone(index) {
    if (!touchstones[index]) return;
    touchstones.splice(index, 1);
    getMoralityData();
    updateHumanityFormOptions();
    renderTouchstones();
    autoSaveVitalState({ immediate: true });
}

async function setTouchstoneImageFromFile(index, file) {
    const item = ensureTouchstone(index);
    if (!file || !item) return;
    const dataUrl = await readImageAsCompressedDataURL(file, 700, 0.8);
    // Изображение опоры тоже уходит в Storage; base64 — только запасной вариант.
    const storageUrl = await window.uploadPortraitDataUrl?.(dataUrl, 'touchstone');
    item.image = storageUrl || dataUrl;
    renderTouchstones();
    autoSaveVitalState();
}

function removeTouchstoneImage(index) {
    const item = ensureTouchstone(index);
    if (!item) return;
    item.image = '';
    renderTouchstones();
    autoSaveVitalState();
}

function renderTouchstones() {
    const list = document.getElementById('touchstones-list');
    if (!list) return;

    list.innerHTML = '';
    touchstones.forEach((item, index) => {
        item = ensureTouchstone(index);
        if (!item) return;
        const row = document.createElement('div');
        row.className = 'touchstone-item';
        row.innerHTML = `
            <div>
                ${item.image ? `<img class="touchstone-image" src="${item.image}" alt="${t('Изображение опоры')}">` : `<div class="touchstone-placeholder">${t('Изображение опоры')}</div>`}
                <input type="file" accept="image/*" style="display:none;" data-touchstone-file="${index}">
            </div>
            <div class="touchstone-fields">
                <label>
                    ${t('Имя опоры')}
                    <input type="text" data-touchstone-index="${index}" data-touchstone-field="name" value="${escapeHTML(item.name || '')}" placeholder="${t('Имя смертного или символа')}">
                </label>
                <label>
                    ${t('Принцип')}
                    <textarea data-touchstone-index="${index}" data-touchstone-field="principle" placeholder="${t('Во что эта опора помогает верить')}">${escapeHTML(item.principle || '')}</textarea>
                </label>
                <label>
                    ${t('Описание')}
                    <textarea data-touchstone-index="${index}" data-touchstone-field="description" placeholder="${t('Кто это, как связан с персонажем, почему важен')}">${escapeHTML(item.description || '')}</textarea>
                </label>
            </div>
            <div class="touchstone-actions">
                <select data-touchstone-status="${index}" aria-label="${t('Статус Опоры')}">
                    <option value="safe"${item.status === 'safe' ? ' selected' : ''}>${t('В безопасности')}</option>
                    <option value="threatened"${item.status === 'threatened' ? ' selected' : ''}>${t('Под угрозой')}</option>
                    <option value="harmed"${item.status === 'harmed' ? ' selected' : ''}>${t('Пострадала')}</option>
                    <option value="lost"${item.status === 'lost' ? ' selected' : ''}>${t('Утрачена')}</option>
                </select>
                <button type="button" data-touchstone-upload="${index}">${t('Загрузить')}</button>
                <button type="button" data-touchstone-remove-image="${index}">${t('Удалить фото')}</button>
                <button type="button" data-touchstone-delete="${index}">${t('Удалить')}</button>
            </div>
        `;
        list.appendChild(row);
    });

    list.querySelectorAll('[data-touchstone-field]').forEach(field => {
        field.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.touchstoneIndex, 10);
            updateTouchstoneField(index, e.target.dataset.touchstoneField, e.target.value);
        });
    });

    list.querySelectorAll('[data-touchstone-status]').forEach(select => {
        select.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.touchstoneStatus, 10);
            if (!touchstones[index]) return;
            updateTouchstoneStatus(index, e.target.value, { immediate: true });
            if (e.target.value === 'harmed' || e.target.value === 'lost') {
                const type = document.getElementById('humanity-event-type');
                const related = document.getElementById('humanity-event-touchstone');
                if (type) type.value = 'touchstone_harmed';
                if (related) related.value = touchstones[index].id;
                setHumanityNotice(t('Опора пострадала. Рассказчик может добавить Сомнения через форму морального события.'), 'warning');
            }
        });
    });

    list.querySelectorAll('[data-touchstone-upload]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.touchstoneUpload, 10);
            list.querySelector(`[data-touchstone-file="${index}"]`)?.click();
        });
    });

    list.querySelectorAll('[data-touchstone-file]').forEach(input => {
        input.addEventListener('change', async (e) => {
            const index = parseInt(e.target.dataset.touchstoneFile, 10);
            const file = e.target.files?.[0];
            if (!file || !touchstones[index]) return;
            try {
                await setTouchstoneImageFromFile(index, file);
            } catch (err) {
                alert(err.message || t('Ошибка загрузки изображения.'));
            } finally {
                e.target.value = '';
            }
        });
    });

    list.querySelectorAll('[data-touchstone-remove-image]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.touchstoneRemoveImage, 10);
            removeTouchstoneImage(index);
        });
    });

    list.querySelectorAll('[data-touchstone-delete]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.touchstoneDelete, 10);
            removeTouchstone(index);
        });
    });

    applySheetLockState();
}

function switchSheetSection(sectionName) {
    document.querySelectorAll('[data-sheet-section]').forEach(section => {
        section.classList.toggle('active', section.dataset.sheetSection === sectionName);
    });
    document.querySelectorAll('[data-sheet-tab]').forEach(button => {
        button.classList.toggle('active', button.dataset.sheetTab === sectionName);
    });
    localStorage.setItem('vtm-sheet-section', sectionName);
}

function setupSheetTabs() {
    const saved = localStorage.getItem('vtm-sheet-section');
    switchSheetSection(['social', 'mechanics', 'inventory'].includes(saved) ? saved : 'social');
}

window.switchSheetSection = switchSheetSection;

function createInventoryItem(seed = {}) {
    const now = new Date().toISOString();
    return {
        id: seed.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: seed.name || '',
        description: seed.description || '',
        quantity: Math.max(0, parseInt(seed.quantity ?? 1, 10) || 0),
        category: INVENTORY_CATEGORIES.includes(seed.category) ? seed.category : 'Другое',
        note: seed.note || '',
        createdAt: seed.createdAt || seed.created_at || now,
        updatedAt: seed.updatedAt || seed.updated_at || now,
        order: Number.isFinite(Number(seed.order)) ? Number(seed.order) : 0,
        collapsed: Boolean(seed.collapsed)
    };
}

function normalizeInventory(items) {
    return Array.isArray(items)
        ? items.map((item, index) => createInventoryItem({ ...item, order: item?.order ?? index })).sort((a, b) => a.order - b.order)
        : [];
}

function updateInventoryCardSummary(id) {
    const item = inventory.find(entry => entry.id === id);
    const card = document.querySelector(`[data-inventory-id="${CSS.escape(id)}"]`);
    if (!item || !card) return;
    const title = card.querySelector('[data-inventory-title]');
    const summary = card.querySelector('[data-inventory-summary]');
    if (title) title.textContent = item.name || t('Без названия');
    if (summary) summary.textContent = tf('{category} · {quantity} шт.', { category: t(item.category), quantity: item.quantity });
}

function updateInventoryItem(id, patch, shouldRender = false) {
    inventory = inventory.map(item => item.id === id
        ? { ...item, ...patch, updatedAt: new Date().toISOString() }
        : item
    );
    if (shouldRender) renderInventory();
    else updateInventoryCardSummary(id);
}

function addInventoryItem() {
    inventory = [createInventoryItem({ name: t('Новый предмет') }), ...inventory];
    renderInventory();
}

function deleteInventoryItem(id) {
    const item = inventory.find(entry => entry.id === id);
    if (!confirm(tf('Удалить «{name}»?', { name: item?.name || t('предмет') }))) return;
    inventory = inventory.filter(entry => entry.id !== id);
    renderInventory();
}

function changeInventoryQuantity(id, delta) {
    const item = inventory.find(entry => entry.id === id);
    if (!item) return;
    updateInventoryItem(id, { quantity: Math.max(0, (parseInt(item.quantity, 10) || 0) + delta) });
    const input = document.querySelector(`[data-inventory-id="${CSS.escape(id)}"] [data-inventory-field="quantity"]`);
    if (input) input.value = String(inventory.find(entry => entry.id === id)?.quantity ?? 0);
}

function moveInventoryItem(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const sourceIndex = inventory.findIndex(item => item.id === sourceId);
    const targetIndex = inventory.findIndex(item => item.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const next = [...inventory];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    inventory = next.map((item, index) => ({ ...item, order: index, updatedAt: new Date().toISOString() }));
    renderInventory();
}

function setupInventoryEditor() {
    const list = document.getElementById('inventory-list');
    if (!list || list.dataset.inventoryEditorReady === 'true') return;
    list.dataset.inventoryEditorReady = 'true';
    list.addEventListener('input', event => {
        const target = event.target;
        const field = target?.dataset?.inventoryField;
        const card = target?.closest?.('[data-inventory-id]');
        if (!field || !card) return;
        const id = card.dataset.inventoryId;
        if (field === 'quantity') {
            updateInventoryItem(id, { quantity: Math.max(0, parseInt(target.value || '0', 10) || 0) });
            return;
        }
        updateInventoryItem(id, { [field]: target.value });
    });
    list.addEventListener('change', event => {
        const target = event.target;
        const field = target?.dataset?.inventoryField;
        const card = target?.closest?.('[data-inventory-id]');
        if (!field || !card) return;
        updateInventoryItem(card.dataset.inventoryId, { [field]: target.value }, field === 'category');
    });
    list.addEventListener('click', event => {
        const target = event.target;
        const toggle = target?.closest?.('[data-inventory-toggle]');
        const showMaster = target?.closest?.('[data-inventory-show-master]');
        if (showMaster) {
            const id = showMaster.dataset.inventoryShowMaster;
            const item = inventory.find(entry => entry.id === id);
            if (!item) return;
            showMasterItem(t('Инвентарь'), item.name || t('Без названия'), item.description || item.note || t('Описание не указано'), tf('{category} · {quantity} шт.', { category: t(item.category), quantity: item.quantity }));
            return;
        }
        if (toggle && !target.closest('button, input, select, textarea')) {
            updateInventoryItem(toggle.dataset.inventoryToggle, { collapsed: !inventory.find(entry => entry.id === toggle.dataset.inventoryToggle)?.collapsed }, true);
        }
    });
    list.addEventListener('dragstart', event => {
        const handle = event.target?.closest?.('[data-inventory-drag-handle]');
        const card = event.target?.closest?.('[data-inventory-id]');
        if (!handle || !card) {
            event.preventDefault();
            return;
        }
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', card.dataset.inventoryId);
        card.classList.add('dragging');
    });
    list.addEventListener('dragend', event => {
        event.target?.closest?.('[data-inventory-id]')?.classList.remove('dragging');
        list.querySelectorAll('.drag-over').forEach(item => item.classList.remove('drag-over'));
    });
    list.addEventListener('dragover', event => {
        const card = event.target?.closest?.('[data-inventory-id]');
        if (!card) return;
        event.preventDefault();
        list.querySelectorAll('.drag-over').forEach(item => {
            if (item !== card) item.classList.remove('drag-over');
        });
        card.classList.add('drag-over');
        event.dataTransfer.dropEffect = 'move';
    });
    list.addEventListener('drop', event => {
        const card = event.target?.closest?.('[data-inventory-id]');
        if (!card) return;
        event.preventDefault();
        const sourceId = event.dataTransfer.getData('text/plain');
        card.classList.remove('drag-over');
        moveInventoryItem(sourceId, card.dataset.inventoryId);
    });
}

function renderInventory() {
    const list = document.getElementById('inventory-list');
    const count = document.getElementById('inventory-count');
    if (!list) return;
    const filter = document.getElementById('inventory-filter')?.value || 'Все';
    const visible = filter === 'Все' ? inventory : inventory.filter(item => item.category === filter);
    if (count) count.textContent = tf('{visible} из {total} предметов', { visible: visible.length, total: inventory.length });
    if (!visible.length) {
        list.innerHTML = `<p class="inventory-empty">${t('Инвентарь пуст. Добавь первый предмет кнопкой выше.')}</p>`;
        return;
    }
    list.innerHTML = visible.map(item => {
        const categoryOptions = INVENTORY_CATEGORIES.map(category => (
            `<option value="${category}" ${item.category === category ? 'selected' : ''}>${t(category)}</option>`
        )).join('');
        return `
            <article class="inventory-card" data-inventory-id="${item.id}" draggable="true">
                <div class="inventory-card-head" data-inventory-toggle="${item.id}">
                    <button type="button" class="inventory-drag-handle" data-inventory-drag-handle title="${t('Перетащить предмет')}">☰</button>
                    <div class="inventory-card-title">
                        <strong data-inventory-title>${escapeHTML(item.name || t('Без названия'))}</strong>
                        <span data-inventory-summary>${escapeHTML(t(item.category))} · ${item.quantity} ${t('шт.')}</span>
                    </div>
                </div>
                <div class="inventory-card-fields">
                    <label>${t('Название')}
                        <input value="${escapeHTML(item.name)}" data-inventory-field="name">
                    </label>
                    <label>${t('Категория')}
                        <select data-inventory-field="category">${categoryOptions}</select>
                    </label>
                    <label>${t('Количество')}
                        <div class="inventory-quantity">
                            <button type="button" onclick="changeInventoryQuantity('${item.id}', -1)">−</button>
                            <input type="number" min="0" value="${item.quantity}" data-inventory-field="quantity">
                            <button type="button" onclick="changeInventoryQuantity('${item.id}', 1)">+</button>
                        </div>
                    </label>
                </div>
                <div class="inventory-description ${item.collapsed ? 'collapsed' : ''}">
                    <label>${t('Описание')}
                        <textarea data-inventory-field="description">${escapeHTML(item.description)}</textarea>
                    </label>
                </div>
                <div class="inventory-note ${item.collapsed ? 'collapsed' : ''}">
                    <label>${t('Заметка')}
                        <textarea data-inventory-field="note">${escapeHTML(item.note)}</textarea>
                    </label>
                </div>
                <div class="inventory-card-actions">
                    <button type="button" onclick="updateInventoryItem('${item.id}', { collapsed: ${!item.collapsed} }, true)">${item.collapsed ? t('Раскрыть описание') : t('Свернуть описание')}</button>
                    <button type="button" data-inventory-show-master="${item.id}">${t('Показать мастеру')}</button>
                    <button type="button" class="danger" onclick="deleteInventoryItem('${item.id}')">${t('Удалить')}</button>
                </div>
            </article>
        `;
    }).join('');
}

window.addInventoryItem = addInventoryItem;
window.updateInventoryItem = updateInventoryItem;
window.deleteInventoryItem = deleteInventoryItem;
window.changeInventoryQuantity = changeInventoryQuantity;
window.renderInventory = renderInventory;

function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function setupAutoResizeTextareas() {
    ['backstory-input', 'appearance-input', 'notes-input'].forEach(id => {
        const textarea = document.getElementById(id);
        if (!textarea || textarea.dataset.autoResizeReady === 'true') return;
        textarea.dataset.autoResizeReady = 'true';
        textarea.style.overflow = 'hidden';
        textarea.addEventListener('input', () => autoResizeTextarea(textarea));
        autoResizeTextarea(textarea);
    });
}

function expandTextareasForCapture(area) {
    const replacements = [];
    area.querySelectorAll('textarea').forEach(textarea => {
        autoResizeTextarea(textarea);

        const replacement = document.createElement('div');
        const computed = window.getComputedStyle(textarea);
        replacement.className = 'capture-textarea-replacement';
        replacement.textContent = textarea.value || textarea.placeholder || '';
        replacement.style.cssText = `
            width: ${textarea.offsetWidth}px;
            min-height: ${Math.max(textarea.scrollHeight, textarea.offsetHeight)}px;
            box-sizing: border-box;
            padding: ${computed.padding};
            border: ${computed.border};
            border-radius: ${computed.borderRadius};
            background: ${computed.backgroundColor};
            color: ${computed.color};
            font: ${computed.font};
            line-height: ${computed.lineHeight};
            text-align: ${computed.textAlign};
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            word-break: break-word;
        `;
        textarea.style.display = 'none';
        textarea.parentNode.insertBefore(replacement, textarea.nextSibling);
        replacements.push({ textarea, replacement });
    });
    return () => {
        replacements.forEach(({ textarea, replacement }) => {
            textarea.style.display = '';
            replacement.remove();
        });
        autoResizeTextarea(document.getElementById('backstory-input'));
    };
}

function stabilizeImagesForCapture(area) {
    const states = [];
    area.querySelectorAll('.touchstone-image, .character-portrait-preview').forEach(img => {
        const rect = img.getBoundingClientRect();
        states.push({
            img,
            width: img.style.width,
            height: img.style.height,
            minWidth: img.style.minWidth,
            minHeight: img.style.minHeight,
            maxWidth: img.style.maxWidth,
            maxHeight: img.style.maxHeight,
            objectFit: img.style.objectFit,
            aspectRatio: img.style.aspectRatio
        });

        img.style.width = `${Math.round(rect.width)}px`;
        img.style.height = `${Math.round(rect.height)}px`;
        img.style.minWidth = `${Math.round(rect.width)}px`;
        img.style.minHeight = `${Math.round(rect.height)}px`;
        img.style.maxWidth = `${Math.round(rect.width)}px`;
        img.style.maxHeight = `${Math.round(rect.height)}px`;
        img.style.objectFit = 'cover';
        img.style.aspectRatio = 'auto';
    });

    return () => {
        states.forEach(({ img, width, height, minWidth, minHeight, maxWidth, maxHeight, objectFit, aspectRatio }) => {
            img.style.width = width;
            img.style.height = height;
            img.style.minWidth = minWidth;
            img.style.minHeight = minHeight;
            img.style.maxWidth = maxWidth;
            img.style.maxHeight = maxHeight;
            img.style.objectFit = objectFit;
            img.style.aspectRatio = aspectRatio;
        });
    };
}

function addTouchstone() {
    touchstones.push({
        id: `touchstone-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: '',
        principle: '',
        description: '',
        text: '',
        image: '',
        status: 'safe'
    });
    renderTouchstones();
    autoSaveVitalState();
    return touchstones.length - 1;
}

function setupCharacterDetails() {
    updateClanBaneField();
    renderCharacterImage();
    renderTouchstones();
    setupAutoResizeTextareas();
}

window.uploadCharacterImage = uploadCharacterImage;
window.deleteCharacterImage = deleteCharacterImage;
window.addTouchstone = addTouchstone;
window.renderTouchstones = renderTouchstones;
window.getTouchstones = getTouchstonesSnapshot;
window.updateTouchstoneField = updateTouchstoneField;
window.updateTouchstoneStatus = updateTouchstoneStatus;
window.removeTouchstone = removeTouchstone;
window.removeTouchstoneImage = removeTouchstoneImage;
window.setTouchstoneImageFromFile = setTouchstoneImageFromFile;

function showPredatorChoiceModal(predName, entries) {
    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.id = 'predator-choice-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:27000;display:flex;align-items:center;justify-content:center;padding:18px;';

        modal.innerHTML = `
            <div style="width:min(620px,100%);background:#111;border:2px solid #ff3131;border-radius:10px;padding:24px;color:#eee;box-shadow:0 0 36px rgba(255,49,49,0.35);">
                <h2 style="margin:0 0 8px;text-align:center;color:#ff3131;">${escapeHTML(predName)}</h2>
                <p style="margin:0 0 18px;text-align:center;color:#aaa;line-height:1.45;">${t('Выберите один вариант от стиля охоты')}</p>
                <div id="pred-choice-list" style="display:grid;gap:10px;"></div>
                <button id="pred-choice-cancel" style="margin-top:16px;width:100%;padding:11px;background:#333;color:#eee;border:none;border-radius:6px;cursor:pointer;">${t('Отмена')}</button>
            </div>
        `;

        document.getElementById('predator-choice-modal')?.remove();
        document.body.appendChild(modal);

        const list = modal.querySelector('#pred-choice-list');
        entries.forEach((entry, index) => {
            const btn = document.createElement('button');
            btn.style.cssText = 'padding:14px 16px;background:#1a1a1a;color:#eee;border:1px solid #444;border-left:4px solid #ff9500;border-radius:6px;cursor:pointer;text-align:left;line-height:1.45;';
            btn.innerHTML = `
                <strong style="color:${entry.isMerit ? '#ffcc00' : '#ff6666'};">${entry.isMerit ? t('Преимущество') : t('Недостаток')}</strong><br>
                ${escapeHTML(formatPredatorTraitLine(entry.item, entry.isMerit))}
            `;
            btn.onclick = () => {
                modal.remove();
                resolve(entry);
            };
            list.appendChild(btn);
        });

        modal.querySelector('#pred-choice-cancel').onclick = () => {
            modal.remove();
            resolve(entries[0]);
        };
    });
}

function showPredatorAllocationModal(predName, group) {
    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.id = 'predator-allocation-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:27000;display:flex;align-items:center;justify-content:center;padding:18px;';

        const rows = group.entries.map((entry, index) => `
            <label style="display:grid;grid-template-columns:1fr 76px;gap:12px;align-items:center;background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:12px;">
                <span>
                    <strong style="color:${entry.isMerit ? '#ffcc00' : '#ff6666'};">${entry.isMerit ? t('Преимущество') : t('Недостаток')}</strong><br>
                    ${escapeHTML(entry.item.category || entry.item.name)}
                </span>
                <input class="pred-allocation-input" data-index="${index}" type="number" min="0" max="${group.total}" value="0" style="width:100%;background:#000;color:#ffcc66;border:1px solid #555;border-radius:4px;padding:8px;text-align:center;font-size:18px;">
            </label>
        `).join('');

        modal.innerHTML = `
            <div style="width:min(660px,100%);background:#111;border:2px solid #ff3131;border-radius:10px;padding:24px;color:#eee;box-shadow:0 0 36px rgba(255,49,49,0.35);">
                <h2 style="margin:0 0 8px;text-align:center;color:#ff3131;">${escapeHTML(predName)}</h2>
                <p style="margin:0 0 10px;text-align:center;color:#aaa;line-height:1.45;">${tf('Распределите <strong style="color:#ffcc66;">{total}</strong> пункт(а/ов)', { total: group.total })}</p>
                <div id="pred-allocation-left" style="text-align:center;color:#ffcc66;margin-bottom:14px;">${tf('Осталось: {left}', { left: group.total })}</div>
                <div style="display:grid;gap:10px;">${rows}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;">
                    <button id="pred-allocation-cancel" style="padding:12px;background:#333;color:#eee;border:none;border-radius:6px;cursor:pointer;">${t('Отмена')}</button>
                    <button id="pred-allocation-confirm" style="padding:12px;background:#ff9500;color:#111;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">${t('Применить')}</button>
                </div>
            </div>
        `;

        document.getElementById('predator-allocation-modal')?.remove();
        document.body.appendChild(modal);

        const inputs = [...modal.querySelectorAll('.pred-allocation-input')];
        const leftEl = modal.querySelector('#pred-allocation-left');

        function getValues() {
            return inputs.map(input => Math.max(0, parseInt(input.value || '0', 10) || 0));
        }

        function updateLeft() {
            const used = getValues().reduce((sum, value) => sum + value, 0);
            const left = group.total - used;
            leftEl.textContent = tf('Осталось: {left}', { left });
            leftEl.style.color = left < 0 ? '#ff6666' : '#ffcc66';
            return left;
        }

        inputs.forEach(input => input.addEventListener('input', updateLeft));
        updateLeft();

        modal.querySelector('#pred-allocation-confirm').onclick = () => {
            const left = updateLeft();
            if (left !== 0) {
                alert(left > 0 ? tf('Осталось распределить {left} пункт(а/ов).', { left }) : tf('Распределено на {over} пункт(а/ов) больше.', { over: Math.abs(left) }));
                return;
            }
            const values = getValues();
            modal.remove();
            resolve(values);
        };

        modal.querySelector('#pred-allocation-cancel').onclick = () => {
            const values = group.entries.map((_, index) => index === group.entries.length - 1 ? group.total : 0);
            modal.remove();
            resolve(values);
        };
    });
}

function getFixedPredatorTraitRows(predData) {
    return [
        ...(predData.advantages || [])
            .filter(item => !isPredatorChoiceItem(item))
            .map(item => ({ item, isMerit: true })),
        ...(predData.disadvantages || [])
            .filter(item => !isPredatorChoiceItem(item))
            .map(item => ({ item, isMerit: false }))
    ];
}

function showPredatorAutoTraitsModal(predName, predData) {
    const rows = getFixedPredatorTraitRows(predData);
    if (!rows.length) {
        notifySheetChoice('predatorTraits', predName);
        return Promise.resolve();
    }

    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.id = 'predator-auto-traits-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:27000;display:flex;align-items:center;justify-content:center;padding:18px;';
        modal.innerHTML = `
            <div style="width:min(760px,100%);max-height:88vh;overflow:auto;background:#111;border:2px solid #ff3131;border-radius:10px;padding:24px;color:#eee;box-shadow:0 0 36px rgba(255,49,49,0.35);">
                <h2 style="margin:0 0 8px;text-align:center;color:#ff3131;">${escapeHTML(predName)}</h2>
                <p style="margin:0 0 18px;text-align:center;color:#aaa;line-height:1.45;">${t('Стиль охоты сразу добавил эти преимущества и недостатки.')}</p>
                <div style="display:grid;gap:10px;">
                    ${rows.map(row => `
                        <div style="background:#1a1a1a;border:1px solid #333;border-left:4px solid ${row.isMerit ? '#ffcc00' : '#ff6666'};border-radius:6px;padding:12px 14px;line-height:1.45;">
                            <strong style="color:${row.isMerit ? '#ffcc00' : '#ff6666'};">${row.isMerit ? t('Преимущество') : t('Недостаток')}</strong><br>
                            ${escapeHTML(formatPredatorTraitLine(row.item, row.isMerit))}
                        </div>
                    `).join('')}
                </div>
                <button id="pred-auto-traits-ok" style="margin-top:18px;width:100%;padding:12px;background:#ff3131;color:#111;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">${t('Понятно')}</button>
            </div>
        `;

        document.getElementById('predator-auto-traits-modal')?.remove();
        document.body.appendChild(modal);
        modal.querySelector('#pred-auto-traits-ok').onclick = () => {
            modal.remove();
            notifySheetChoice('predatorTraits', predName);
            resolve();
        };
    });
}

async function applyPredatorChoiceItems(predName) {
    const predData = RULES.predator_types?.[predName];
    if (!predData) return;

    const choiceGroups = getPredatorChoiceGroups(predData);
    for (const groupName of Object.keys(choiceGroups)) {
        const entries = choiceGroups[groupName];
        if (!entries.length) continue;
        const selected = await showPredatorChoiceModal(predName, entries);
        addPredatorItemToSheet(selected.item, selected.isMerit, predName);
    }

    const allocationGroups = getPredatorAllocationGroups(predData);
    for (const groupName of Object.keys(allocationGroups)) {
        const group = allocationGroups[groupName];
        const values = await showPredatorAllocationModal(predName, group);

        group.entries.forEach((entry, index) => {
            const points = values[index] || 0;
            if (points > 0) {
                addPredatorItemToSheet({ ...entry.item, dots: points }, entry.isMerit, predName);
            }
        });
    }

    renderSelectedMeritsFlaws();
    await showPredatorAutoTraitsModal(predName, predData);
}

function hasPredatorChoiceItems(predData) {
    return [
        ...(predData.advantages || []),
        ...(predData.disadvantages || [])
    ].some(isPredatorChoiceItem);
}

function getCurrentBloodPotencyEstimate() {
    const type = document.getElementById('type-input')?.value;
    const generation = parseInt(document.getElementById('generation-input')?.value || '13', 10);

    if (type === 'childe') return 0;
    if (type === 'neonate') return generation <= 13 ? 1 : 0;
    if (type === 'ancilla') return generation <= 11 ? 2 : 1;
    if (type === 'elder' || type === 'methuselah' || type === 'antediluvian') return 3;
    return 0;
}

function validatePredatorRestrictions(predName) {
    const clan = document.getElementById('clan-input')?.value || '';
    const bloodPotency = getCurrentBloodPotencyEstimate();

    if ((predName === vtmName('Суррогатчик') || predName === vtmName('Фермер')) && clan === vtmName('Вентру')) {
        alert(tf('{pred} недоступен для клана Вентру.', { pred: predName }));
        return false;
    }

    if (predName === vtmName('Фермер') && bloodPotency >= 3) {
        alert(t('Фермер недоступен при Силе Крови 3 и выше.'));
        return false;
    }

    return true;
}

function addPredatorTraits(predName, predData) {
    selectedMerits = selectedMerits.filter(item => !item.fromPredator);
    selectedFlaws = selectedFlaws.filter(item => !item.fromPredator);

    (predData.advantages || []).forEach(adv => {
        if (!isPredatorChoiceItem(adv)) addPredatorItemToSheet(adv, true, predName);
    });

    (predData.disadvantages || []).forEach(dis => {
        if (!isPredatorChoiceItem(dis)) addPredatorItemToSheet(dis, false, predName);
    });
}

function applyPredatorType(predName) {
    console.log("🎯 Применяем стиль охоты:", predName);

    // Очистка всех модалок
    document.querySelectorAll('#pred-disc-modal, #spec-choice-modal, #predator-selection-modal, #power-modal').forEach(m => m.remove());

    if (!predName) return;

    const predData = RULES.predator_types?.[predName];
    if (!predData) {
        console.warn("Нет данных для стиля:", predName);
        return;
    }

    // Сброс старого
    resetPredatorDisciplines();
    resetPredatorSpecialties();

    addPredatorTraits(predName, predData);

    loadPredatorHint();
    renderSelectedMeritsFlaws();
    updateTrackers();

    // === НАДЁЖНАЯ ЛОГИКА ОТКРЫТИЯ ===
    const hasSpecialty = predData?.specialty?.options && predData.specialty.options.length > 0;
    const hasDisciplines = predData?.disciplines?.increase?.options && predData.disciplines.increase.options.length > 0;
    const hasPredItems = (predData.advantages?.length || 0) + (predData.disadvantages?.length || 0) > 0;
    const hasChoiceItems = hasPredatorChoiceItems(predData);

    setTimeout(() => {
        console.log(`Для ${predName} → specialty: ${hasSpecialty} (${predData.specialty?.options?.length || 0} вариантов), disciplines: ${hasDisciplines}, predItems: ${hasPredItems}`);

        if (hasSpecialty) {
            const options = predData.specialty.options;
            if (options.length > 1) {
                console.log("✅ Открываем выбор специализации");
                showSpecialtyChoiceModal(predName, options, predData);
                return;
            } else if (options.length === 1) {
                applyPredatorSpecialty(predName, options[0]);
                return;
            }
        }

        if (hasDisciplines) {
            console.log("✅ Открываем дисциплины");
            openPredatorDisciplineModal(predName);
            return;
        }

        if (hasChoiceItems) {
            console.log("✅ Открываем выбор преимуществ/недостатков");
            applyPredatorChoiceItems(predName);
            return;
        }

        if (hasPredItems) {
            console.log("✅ Преимущества/недостатки от охоты добавлены автоматически");
            showPredatorAutoTraitsModal(predName, predData);
            return;
        }

        if (!hasSpecialty && !hasDisciplines && !hasPredItems) {
            console.warn(`Стиль охоты ${predName} не имеет дополнительных механик`);
            notifySheetChoice('predatorTraits', predName);
        }
    }, 250);
}

// ==================== ОБРАБОТЧИКИ ====================
function setupEventListeners() {
    // Пакет навыков
    const skillPackage = document.getElementById('skill-package');
    if (skillPackage) {
        skillPackage.addEventListener('change', (e) => {
            currentPackage = e.target.value;
            updateTrackers();
        });
    }

    // === КЛАН ===
    const clanSelect = document.getElementById('clan-input');
    if (clanSelect) {
        clanSelect.addEventListener('change', function() {
            const newClan = this.value.trim();

            console.log(`🔄 Смена клана на: ${newClan}`);

            resetClanDisciplines();           // ←←← ВАЖНО!

            if (newClan) {
                loadClanHint();
                updateClanIcon();
                enforceClanSpecificRules();
                if (!isThinBloodClan(newClan)) {
                    setTimeout(() => openClanDisciplineModal(newClan), 100);
                }
            } else {
                loadClanHint();
                updateClanIcon();
                enforceClanSpecificRules();
            }

            updateDisciplineTotal();
            renderDisciplines();
            syncDamageProfileFromCharacterType();
        });
    }

    // === СТИЛЬ ОХОТЫ ===
    const predatorSelect = document.getElementById('predator-input');
    if (predatorSelect) {
        predatorSelect.addEventListener('change', function() {
            const newPredator = this.value.trim();
            console.log(`🔄 Смена стиля охоты на: ${newPredator}`);

            if (newPredator && !validatePredatorRestrictions(newPredator)) {
                resetPredatorDisciplines();
                this.value = '';
                loadPredatorHint();
                updateTrackers();
                return;
            }

            resetPredatorDisciplines();       // ←←← ВАЖНО!

            loadPredatorHint();

            if (newPredator) {
                setTimeout(() => applyPredatorType(newPredator), 50);
            } else {
                updateTrackers();
            }
        });
    }
}



// ==================== ГЛОБАЛЬНЫЕ ПОДСКАЗКИ (исправленная версия) ====================
let tooltip = null;

function createTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement('div');
    tooltip.style.cssText = `
        position: fixed;
        background: #111111;
        color: #e0e0e0;
        padding: 14px 18px;
        border: 2px solid #ff3131;
        border-radius: 8px;
        font-size: 14px;
        line-height: 1.55;
        max-width: 420px;
        max-height: min(70vh, 520px);
        overflow-y: auto;
        z-index: 30000;
        pointer-events: none;
        box-shadow: 0 0 30px rgba(255,49,49,0.7);
        display: none;
        white-space: pre-line;
        word-wrap: break-word;
        overflow-wrap: anywhere;
    `;
    document.body.appendChild(tooltip);
    return tooltip;
}

function getTooltipTarget(start) {
    let target = start;
    while (target && target !== document && !target.hasAttribute('data-tooltip')) {
        target = target.parentElement;
    }
    return target && target.hasAttribute('data-tooltip') ? target : null;
}

function positionTooltip(target, tt) {
    const gap = 12;
    const edgePadding = 12;
    const rect = target.getBoundingClientRect();
    const ttRect = tt.getBoundingClientRect();
    const spaceAbove = rect.top - edgePadding;
    const spaceBelow = window.innerHeight - rect.bottom - edgePadding;

    const preferTop = spaceAbove >= ttRect.height + gap;
    const canFitBelow = spaceBelow >= ttRect.height + gap;
    const placeAbove = preferTop || (!canFitBelow && spaceAbove >= spaceBelow);

    const centeredLeft = rect.left + (rect.width / 2) - (ttRect.width / 2);
    const maxLeft = window.innerWidth - ttRect.width - edgePadding;
    const left = Math.min(Math.max(edgePadding, centeredLeft), Math.max(edgePadding, maxLeft));

    let top = placeAbove
        ? rect.top - ttRect.height - gap
        : rect.bottom + gap;

    const maxTop = window.innerHeight - ttRect.height - edgePadding;
    top = Math.min(Math.max(edgePadding, top), Math.max(edgePadding, maxTop));

    tt.style.left = `${left}px`;
    tt.style.top = `${top}px`;
}

function showTooltipFor(target) {
    const text = target.getAttribute('data-tooltip')?.trim();
    if (!text) return;

    const tt = createTooltip();
    tt.textContent = text;
    tt.style.left = '-9999px';
    tt.style.top = '-9999px';
    tt.style.display = 'block';
    positionTooltip(target, tt);
}

document.addEventListener('mouseover', function(e) {
    const target = getTooltipTarget(e.target);
    if (target) showTooltipFor(target);
});

document.addEventListener('focusin', function(e) {
    const target = getTooltipTarget(e.target);
    if (target) showTooltipFor(target);
});

document.addEventListener('mouseout', function(e) {
    const target = getTooltipTarget(e.target);
    if (!target || target.contains(e.relatedTarget)) return;
    if (tooltip) tooltip.style.display = 'none';
});

document.addEventListener('focusout', function() {
    if (tooltip) tooltip.style.display = 'none';
});

window.addEventListener('scroll', function() {
    if (tooltip) tooltip.style.display = 'none';
}, true);

window.addEventListener('resize', function() {
    if (tooltip) tooltip.style.display = 'none';
});

// ==================== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ СТРЕЛОК ====================
window.prevClan = function() {
    if (!currentClanData || currentClanData.length === 0) return;
    currentClanIndex = (currentClanIndex - 1 + currentClanData.length) % currentClanData.length;
    showSingleClan(currentClanData[currentClanIndex]);
};

window.nextClan = function() {
    if (!currentClanData || currentClanData.length === 0) return;
    currentClanIndex = (currentClanIndex + 1) % currentClanData.length;
    showSingleClan(currentClanData[currentClanIndex]);
};

         // Синхронизация специализаций при изменении точек
    document.querySelectorAll('.dot-input[data-type="skill"]').forEach(dot => {
        dot.addEventListener('change', () => {
            const skillName = dot.getAttribute('name');
            if (skillName) {
                updateSBadgeState(skillName);
                updateSpecUI(skillName);
            }
        });
    });

    // Инициализация S-бейджей после полной загрузки
    setTimeout(() => {
        document.querySelectorAll('.skill-name').forEach(el => {
            const skillName = el.getAttribute('data-skill') || el.textContent.trim();
            if (skillName) updateSBadgeState(skillName);
        });
    }, 300);

//<!-- ==================== ОБРАБОТЧИКИ ТОЧЕК ==================== -->

// ==================== ОБРАБОТЧИКИ ТОЧЕК (атрибуты + навыки) ====================

// Главный обработчик кликов по точкам + сброс в 0
document.addEventListener('click', function(e) {
    const label = e.target.closest('label.dot-label');
    if (!label) return;

    const inputId = label.getAttribute('for');
    const input = document.getElementById(inputId);
    if (!input) return;

    const name = input.name;
    const clickedValue = parseInt(input.value);
    const currentChecked = document.querySelector(`input[name="${name}"]:checked`);
    const currentValue = currentChecked ? parseInt(currentChecked.value) : 0;

    // === СБРОС В 0 ===
    if (clickedValue === currentValue && currentValue > 0) {
        document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
            radio.checked = false;
        });

        // Активируем 0
        const zeroRadio = document.querySelector(`input[name="${name}"][value="0"]`);
        if (zeroRadio) zeroRadio.checked = true;

        e.preventDefault();

        // Для навыков — удаляем специальности
        if (input.dataset.type === 'skill') {
            const specContainer = document.getElementById('specs-' + name);
            if (specContainer) {
                specContainer.innerHTML = '';
                specContainer.style.display = 'none';
            }

            const checkbox = document.getElementById('s-' + name);
            if (checkbox) checkbox.checked = false;

            updateSBadgeState(name);
            updateSpecUI(name);
        }

        updateTrackers();
        return;
    }
});

// Дополнительный обработчик change
document.addEventListener('change', function(e) {
    if (e.target.classList.contains('dot-input')) {
        const name = e.target.name;
        updateTrackers();

        if (e.target.dataset.type === 'skill') {
            const level = parseInt(e.target.value || 0);
            if (level === 0) {
                const specContainer = document.getElementById('specs-' + name);
                if (specContainer) {
                    specContainer.innerHTML = '';
                    specContainer.style.display = 'none';
                }
                const cb = document.getElementById('s-' + name);
                if (cb) cb.checked = false;
            }
            updateSBadgeState(name);
            updateSpecUI(name);
        }
    }
});


// ==================== ПРЕИМУЩЕСТВА И НЕДОСТАТКИ ====================

let meritsModalCategory = null;
let meritsModalTab = 0;
const meritsModalScrollByTab = { 0: 0, 1: 0 };

function openMeritsFlawsModal() {
    if (startingSheetFixed && !expShopMode) return alert(t("Лист зафиксирован. Преимущества и недостатки меняются только через расфиксацию или магазин опыта."));
    document.getElementById('merits-flaws-modal').style.display = 'block';
    switchMeritsTab(0); // по умолчанию открываем Преимущества
}

function closeMeritsFlawsModal() {
    document.getElementById('merits-flaws-modal').style.display = 'none';
}

function switchMeritsTab(tab) {
    document.getElementById('tab-merits').style.background = tab === 0 ? '#222' : '#111';
    document.getElementById('tab-flaws').style.background = tab === 1 ? '#222' : '#111';
    document.getElementById('merits-flaws-modal').dataset.activeTab = String(tab);
    meritsModalTab = tab;
    meritsModalCategory = null;
    renderCategories(tab, meritsModalScrollByTab[tab] || 0);
}

function normalizeTraitSearch(value) {
    return String(value ?? '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/<[^>]*>/g, ' ')
        .replace(/[^a-zа-я0-9]+/gi, ' ')
        .trim();
}

function getPointSearchText(points) {
    const words = ['', 'один одна первое', 'два две второе', 'три третье', 'четыре четвертое', 'пять пятое'];
    return `${points} ${points} точка ${points} точки ${points} точек ${words[points] || ''}`;
}

function getTraitPointFilter(search) {
    const normalized = normalizeTraitSearch(search);
    const numeric = normalized.match(/(?:^| )(1|2|3|4|5)(?: |$)/);
    if (numeric) return parseInt(numeric[1], 10);

    const pointWords = {
        один: 1, одна: 1, первое: 1,
        два: 2, две: 2, второе: 2,
        три: 3, третье: 3,
        четыре: 4, четвертое: 4,
        пять: 5, пятое: 5
    };
    const word = normalized.split(' ').find(token => pointWords[token]);
    return word ? pointWords[word] : null;
}

function stemTraitSearchWord(word) {
    if (word.length < 5) return word;
    return word.replace(/(иями|ями|ами|ого|ему|ому|ыми|ими|ая|яя|ое|ее|ые|ие|ий|ый|ой|ам|ям|ах|ях|ом|ем|ов|ев|а|я|ы|и|е|у|ю)$/u, '');
}

function traitMatchesSearch(category, variant, search) {
    const tokens = normalizeTraitSearch(search).split(' ').filter(Boolean);
    if (tokens.length === 0) return true;

    const pointFilter = getTraitPointFilter(search);
    if (pointFilter !== null && (parseInt(variant.точки, 10) || 0) !== pointFilter) return false;

    const haystack = normalizeTraitSearch([
        category.название,
        category.описание,
        variant.название_пункта,
        variant.полное_описание,
        variant.механика,
        variant.roll,
        variant.difficulty,
        variant.bonus,
        getPointSearchText(parseInt(variant.точки, 10) || 0)
    ].join(' '));
    const haystackWords = haystack.split(' ');

    return tokens.every(token => {
        if (haystack.includes(token)) return true;
        const stem = stemTraitSearchWord(token);
        return stem.length >= 4 && haystackWords.some(word => stemTraitSearchWord(word) === stem);
    });
}

function formatTraitRollLine(item) {
    return [
        item?.roll || '',
        item?.difficulty ? tf('сложность: {value}', { value: item.difficulty }) : '',
        item?.bonus ? tf('бонус: {value}', { value: item.bonus }) : ''
    ].filter(Boolean).join(' · ');
}

function createTraitVariantCard(category, variant, tab, { showCategory = false } = {}) {
    const name = variant.название_пункта;
    const points = variant.точки || 0;
    const rollLine = formatTraitRollLine(variant);
    const alreadyTaken = tab === 0
        ? selectedMerits.some(item => item.name === name && item.category === category.название)
        : selectedFlaws.some(item => item.name === name && item.category === category.название);

    const div = document.createElement('div');
    div.style.cssText = `
        background:#222;
        padding:14px;
        border-radius:6px;
        margin-bottom:10px;
        border:2px solid ${alreadyTaken ? '#555' : '#ff3131'};
        cursor:${alreadyTaken ? 'default' : 'pointer'};
        opacity:${alreadyTaken ? '0.6' : '1'};
    `;
    div.innerHTML = `
        ${showCategory ? `<small style="display:block;color:#888;margin-bottom:5px;">${category.название}</small>` : ''}
        <strong>${tf('{name} — {points} точек', { name, points })}</strong>
        ${alreadyTaken ? `<span style="color:#888;margin-left:8px;">${t('уже добавлено')}</span>` : ''}
        ${expShopMode ? `<span style="color:#ffcc00;font-weight:bold;margin-left:8px;">${tab === 0 ? points * 3 : 0} XP</span>` : ''}<br>
        <small style="display:block;color:#aaa;margin-top:7px;line-height:1.45;">${variant.полное_описание || ''}</small>
        ${rollLine ? `<small style="display:block;color:#ffd166;margin-top:7px;line-height:1.45;"><strong>${t('Бросок:')}</strong> ${rollLine}</small>` : ''}
        ${variant.механика ? `<small style="display:block;color:#ffae00;margin-top:7px;line-height:1.45;">${variant.механика}</small>` : ''}
    `;

    if (!alreadyTaken) {
        div.addEventListener('click', () => {
            const canAdd = tab === 0 ? canAddMerit(points) : canAddFlaw(points);
            if (!canAdd) {
                showLimitWarning(tab === 0);
                return;
            }

            const item = {
                category: category.название,
                categoryDesc: category.описание || '',
                name,
                points,
                desc: variant.полное_описание || '',
                mechanic: variant.механика || '',
                roll: variant.roll || '',
                difficulty: variant.difficulty || '',
                bonus: variant.bonus || ''
            };
            if (tab === 0) selectedMerits.push(item);
            else selectedFlaws.push(item);
            const container = document.getElementById('merits-list');
            const scrollTop = container?.scrollTop || 0;
            renderSelectedMeritsFlaws();
            if (expShopMode) renderExpShopPanel();
            if (meritsModalCategory) renderVariantsInCategory(meritsModalCategory, tab, scrollTop);
            else renderCategories(tab, scrollTop);
        });
    }

    return div;
}

function restoreMeritsListScroll(scrollTop = 0) {
    const container = document.getElementById('merits-list');
    if (!container) return;
    requestAnimationFrame(() => {
        container.scrollTop = scrollTop || 0;
    });
}

function returnToMeritsCategories(tab) {
    renderCategories(tab, meritsModalScrollByTab[tab] || 0);
}

function renderCategories(tab, restoreScroll = 0) {
    const container = document.getElementById('merits-list');
    container.innerHTML = '';
    const search = document.getElementById('merits-search').value.trim();
    meritsModalTab = tab;
    meritsModalCategory = null;

    let source = tab === 0 
        ? (RULES.advantages?.merits || {}) 
        : (RULES.advantages?.flaws || RULES.flaws || {});

    if (Object.keys(source).length === 0) {
        container.innerHTML = `<p style="color:#ff6666; text-align:center; padding:60px 20px;">
            ${t('Данные не загружены')}
        </p>`;
        return;
    }

    if (search) {
        const matches = [];
        Object.keys(source).forEach(catKey => {
            if (catKey === vtmName('СЛАБОКРОВНЫЕ')) return;
            const category = source[catKey];
            (category.варианты || []).forEach(variant => {
                if (traitMatchesSearch(category, variant, search)) matches.push({ category, variant });
            });
        });

        container.innerHTML = `<p style="color:#888;margin:0 0 12px;">${tf('Найдено: {count}', { count: matches.length })}</p>`;
        matches.forEach(({ category, variant }) => {
            container.appendChild(createTraitVariantCard(category, variant, tab, { showCategory: true }));
        });
        if (matches.length === 0) {
            container.innerHTML = `<p style="color:#666;text-align:center;padding:60px;">${t('Ничего не найдено. Попробуйте название, слово из описания или количество точек.')}</p>`;
        }
        restoreMeritsListScroll(restoreScroll);
        return;
    }

    Object.keys(source).forEach(catKey => {
        if (catKey === vtmName('СЛАБОКРОВНЫЕ')) return;
        const category = source[catKey];
        const catName = category.название || catKey;
        const description = category.описание || t("Нет описания");

        if (search && !catName.toLowerCase().includes(search)) return;

        const count = category.варианты ? category.варианты.length : 0;

        const div = document.createElement('div');
        div.style.cssText = `
            background:#1a1a1a; padding:16px; margin-bottom:10px; border-radius:6px;
            border:1px solid #444; cursor:pointer; font-size:16px;
        `;

        div.innerHTML = `
            <strong>${catName}</strong>
            <span style="color:#666; font-size:14px;">${tf('({count} вариантов)', { count })}</span>
            <div style="margin-top:8px; font-size:14px; color:#aaa; line-height:1.4;">
                ${description}
            </div>
        `;

        div.onclick = () => {
            meritsModalScrollByTab[tab] = container.scrollTop;
            renderVariantsInCategory(category, tab);
        };
        container.appendChild(div);
    });

    if (container.children.length === 0) {
        container.innerHTML = `<p style="color:#666; text-align:center; padding:60px;">${t('Ничего не найдено')}</p>`;
    }
    restoreMeritsListScroll(restoreScroll);
}


function renderVariantsInCategory(category, tab, restoreScroll = 0) {
    const container = document.getElementById('merits-list');
    meritsModalTab = tab;
    meritsModalCategory = category;
    container.innerHTML = `
        <button onclick="returnToMeritsCategories(${tab})"
                style="margin-bottom:15px; background:#333; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">
            ← ${t('Назад к категориям')}
        </button>
        <h3 style="color:#ffae00; margin-bottom:15px;">${category.название}</h3>
    `;

    category.варианты.forEach(variant => container.appendChild(createTraitVariantCard(category, variant, tab)));
    restoreMeritsListScroll(restoreScroll);
}


function confirmPredatorSelection(predName) {
    const predData = RULES.predator_types?.[predName];
    if (!predData) return;

    // Преимущества
    document.querySelectorAll('.pred-adv:checked').forEach(cb => {
        const rawItem = predData.advantages?.[parseInt(cb.dataset.index, 10)] || cb.value;
        const item = buildPredatorTrait(rawItem, true, predName);
        // Проверяем, нет ли уже (включая от охоты)
        if (!selectedMerits.some(m => m.name === item.name && m.category === item.category)) {
            selectedMerits.push(item);
        }
    });

    // Недостатки
    document.querySelectorAll('.pred-flaw:checked').forEach(cb => {
        const rawItem = predData.disadvantages?.[parseInt(cb.dataset.index, 10)] || cb.value;
        const item = buildPredatorTrait(rawItem, false, predName);
        if (!selectedFlaws.some(f => f.name === item.name && f.category === item.category)) {
            selectedFlaws.push(item);
        }
    });

    closePredatorSelectionModal();
    renderSelectedMeritsFlaws();
}

// Отображение выбранных
function renderSelectedMeritsFlaws() {
    selectedMerits = selectedMerits.filter(item => item.category !== vtmName('Достоинства слабокровных') && item.category !== vtmName('СЛАБОКРОВНЫЕ'));
    selectedFlaws = selectedFlaws.filter(item => item.category !== vtmName('Недостатки слабокровных') && item.category !== vtmName('СЛАБОКРОВНЫЕ'));

    let totalMerits = 0;
    let totalFlaws = 0;

    const meritsContainer = document.getElementById('selected-merits-list');
    meritsContainer.innerHTML = '';
    selectedMerits.forEach((item, index) => {
        totalMerits += getPaidMeritPoints(item);
        meritsContainer.appendChild(createSelectedItem(item, index, true));
    });

    const flawsContainer = document.getElementById('selected-flaws-list');
    flawsContainer.innerHTML = '';
    selectedFlaws.forEach((item, index) => {
        if (!item.fromPredator) totalFlaws += getTraitPoints(item);
        flawsContainer.appendChild(createSelectedItem(item, index, false));
    });

    renderDots('merits-dots', totalMerits, true);
    renderDots('flaws-dots', totalFlaws, false);
}





function renderDots(containerId, points, isMerit) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    const recommendedMax = isMerit ? getMeritsLimit() : getFlawsLimit();
    const max = isNpcCharacterType() ? Math.max(points, recommendedMax) : recommendedMax;
    
    for (let i = 1; i <= max; i++) {
        const dot = document.createElement('div');
        dot.style.cssText = `
            width: 22px; 
            height: 22px; 
            border-radius: 50%; 
            background: ${i <= points ? '#ff3131' : '#333'};
            border: 2px solid ${i <= points ? '#ff6666' : '#555'};
            box-shadow: ${i <= points ? '0 0 8px #ff3131' : 'none'};
        `;
        container.appendChild(dot);
    }
}

function createSelectedItem(item, index, isMerit) {
    const points = getTraitPoints(item);
    const isFromPredator = item.fromPredator === true;
    const predatorBasePoints = isFromPredator ? getPredatorBasePoints(item) : 0;
    const paidPoints = isMerit ? getPaidMeritPoints(item) : points;
    const baseKeys = isMerit ? getBaseMeritKeys() : getBaseFlawKeys();
    const snapshotItems = isMerit ? (expShopSnapshot?.merits || []) : (expShopSnapshot?.flaws || []);
    const snapshotKeys = new Set(snapshotItems.map(getItemKey));
    const isPendingPurchase = expShopMode && !snapshotKeys.has(getItemKey(item));
    const isFromExperience = startingSheetFixed && !isFromPredator && !baseKeys.has(getItemKey(item));
    const categoryName = item.category || '';
    let displayName = item.name || item.название_пункта || '';
    
    if (categoryName && !displayName.toLowerCase().includes(categoryName.toLowerCase().slice(0, 15))) {
        displayName = `${categoryName} • ${displayName}`;
    }
    const rollLine = formatTraitRollLine(item);

    const maxDots = 5;
    let dotsHTML = '';

    for (let i = 1; i <= maxDots; i++) {
        const filled = i <= points;
        const isPaidPredatorDot = isFromPredator && i > predatorBasePoints && filled;
        const dotColor = isPaidPredatorDot ? '#ffae00' : isPendingPurchase && filled ? '#ffcc00' : isFromExperience && filled ? '#ff9500' : '#ff3131';
        const borderColor = isPaidPredatorDot ? '#ffd166' : isPendingPurchase && filled ? '#ffe066' : isFromExperience && filled ? '#ffb733' : '#ff6666';
        const dotClass = isPendingPurchase && filled ? 'exp-pending' : isFromExperience && filled ? 'exp-purchased' : '';
        const hasVariantAtLevel = Boolean(getTraitVariantAtPoints(item, i, true));
        const editable = isMerit && isFromPredator && i >= predatorBasePoints && hasVariantAtLevel;
        const title = i <= predatorBasePoints
            ? tf('Точка от типа охоты ({i}/{base})', { i, base: predatorBasePoints })
            : filled
                ? tf('Своя точка. Нажать, чтобы изменить уровень до {level}', { level: i === points ? Math.max(predatorBasePoints, i - 1) : i })
                : tf('Добавить свои точки до уровня {level}', { level: i });
        dotsHTML += `
            <button type="button" class="merit-dot ${dotClass}" title="${title}" aria-label="${title}"
                    ${editable ? `onclick="event.stopImmediatePropagation(); setPredatorMeritPoints(${index}, ${i})"` : 'disabled'}
                    style="width:18px; height:18px; min-width:18px; padding:0; border-radius:50%; cursor:${editable ? 'pointer' : 'default'};
                        background: ${filled ? dotColor : '#333'}; 
                        border: 2px solid ${filled ? borderColor : '#555'}; 
                        margin-left: 3px;"></button>`;
    }

    if (isFromPredator) {
        dotsHTML += `
            <span style="color:#ffae00; font-weight:bold; background:#1a1a1a;
                         padding:4px 8px; border-radius:6px; border:1px solid #444; margin-left:6px; white-space:nowrap;">
                ${tf('Тип охоты: {pred} • {base} бесплатно{paid}', { pred: item.predatorType || '', base: predatorBasePoints, paid: paidPoints ? tf(' • +{paid} своих', { paid: paidPoints }) : '' })}
            </span>`;
    } else if (expShopMode && isPendingPurchase) {
        dotsHTML += `
            <span style="color:#ffcc00; font-weight:bold; background:#1a1a1a; 
                         padding:4px 8px; border-radius:6px; border:1px solid #665500; margin-left:6px; white-space:nowrap;">
                ${isMerit ? `${points * 3} XP` : '0 XP'}
            </span>`;
    } else if (expShopMode && isFromExperience) {
        dotsHTML += `
            <span style="color:#ff9500; font-weight:bold; background:#1a1a1a; 
                         padding:4px 8px; border-radius:6px; border:1px solid #664400; margin-left:6px; white-space:nowrap;">
                ${isMerit ? `${points * 3} XP` : '0 XP'}
            </span>`;
    }

    const div = document.createElement('div');
    div.className = 'selected-item';
    div.style.cssText = `
        background:#1a1a1a; padding:12px 14px; margin-bottom:6px; border-radius:6px;
        border-left:4px solid ${isPendingPurchase ? '#ffcc00' : isFromExperience ? '#ff9500' : isMerit ? '#ffcc00' : '#ff6666'}; 
        cursor: pointer; overflow: hidden; transition: all 0.3s;
    `;
    div.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:12px; flex:1;">
                <strong style="flex:1;">${displayName}</strong>
                <div style="display:flex; gap:3px; align-items:center;">${dotsHTML}</div>
            </div>
            ${(!isFromPredator || expShopMode) ? `
            <button class="selected-item-remove" onclick="event.stopImmediatePropagation(); ${isMerit ? `removeMerit(${index})` : `removeFlaw(${index})`}" 
                    style="background:none; border:none; color:#ff3131; font-size:22px; cursor:pointer; padding:0 8px;">×</button>` : ''}
            <button type="button" class="selected-item-show-master" style="background:#111; color:#ffae00; border:1px solid #553500; border-radius:6px; padding:6px 9px; cursor:pointer;">${t('Показать мастеру')}</button>
        </div>
        
        <!-- Раскрывающаяся часть -->
        <div class="detail-content" style="display:none; margin-top:12px; padding-top:12px; border-top:1px solid #333; color:#ccc; font-size:14.5px; line-height:1.55;">
            ${item.categoryDesc ? `
            <div style="margin-bottom:16px;">
                <strong style="color:#ffae00;">${tf('Раздел «{category}»:', { category: item.category })}</strong><br>
                ${item.categoryDesc}
            </div>` : ''}

            <div>
                <strong style="color:#ffae00;">${t('Описание пункта:')}</strong><br>
                ${item.desc || item.полное_описание || '—'}
            </div>

            ${rollLine ? `
            <div style="margin-top:16px;">
                <strong style="color:#ffae00;">${t('Бросок:')}</strong><br>
                ${rollLine}
            </div>` : ''}

            ${item.mechanic ? `
            <div style="margin-top:16px;">
                <strong style="color:#ffae00;">${t('Механика:')}</strong><br>
                ${item.mechanic}
            </div>` : ''}
        </div>
    `;

    div.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') return;
        const content = this.querySelector('.detail-content');
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });

    div.querySelector('.selected-item-show-master')?.addEventListener('click', (event) => {
        event.stopImmediatePropagation();
        const masterDescription = [
            rollLine ? tf('Бросок: {rollLine}', { rollLine }) : '',
            item.mechanic || item.desc || item.полное_описание || t('Описание не указано')
        ].filter(Boolean).join('\n\n');
        showMasterItem(isMerit ? t('Преимущество') : t('Недостаток'), displayName, masterDescription, tf('{category}{pointsNote}', { category: item.category || '', pointsNote: points ? tf(' · {points} точек', { points }) : '' }));
    });

    return div;
}

window.setPredatorMeritPoints = function(index, targetPoints) {
    const item = selectedMerits[index];
    if (!item?.fromPredator) return;
    if (startingSheetFixed && !expShopMode) {
        alert(t('Лист зафиксирован. Повышать преимущество можно через магазин опыта.'));
        return;
    }

    const basePoints = getPredatorBasePoints(item);
    const currentPoints = getTraitPoints(item);
    const nextPoints = targetPoints === currentPoints && currentPoints > basePoints
        ? currentPoints - 1
        : Math.max(basePoints, targetPoints);
    if (nextPoints === currentPoints) return;

    const currentPaidPoints = getPaidMeritPoints(item);
    const nextPaidPoints = Math.max(0, nextPoints - basePoints);
    const addedPoints = nextPaidPoints - currentPaidPoints;
    if (addedPoints > 0 && !canAddMerit(addedPoints)) {
        showLimitWarning(true);
        return;
    }

    const upgraded = applyTraitVariant({
        ...item,
        predatorBasePoints: basePoints,
        predatorBaseName: item.predatorBaseName || item.name
    }, nextPoints, true);
    if (!upgraded) {
        alert(tf('Для преимущества «{category}» нет варианта на {points} точек.', { category: item.category, points: nextPoints }));
        return;
    }

    selectedMerits[index] = upgraded;
    renderSelectedMeritsFlaws();
    if (expShopMode) renderExpShopPanel();
};

function getThinBloodCategory(isMerit) {
    const key = vtmName('СЛАБОКРОВНЫЕ');
    return isMerit
        ? RULES.advantages?.merits?.[key]
        : (RULES.advantages?.flaws?.[key] || RULES.flaws?.[key]);
}

function buildThinBloodTrait(raw, isMerit) {
    const category = getThinBloodCategory(isMerit) || {};
    return {
        category: category.название || (isMerit ? vtmName('Достоинства слабокровных') : vtmName('Недостатки слабокровных')),
        categoryDesc: category.описание || '',
        name: raw.название_пункта || raw.name || '',
        points: parseInt(raw.точки || raw.points || 1, 10) || 1,
        desc: raw.полное_описание || raw.desc || '',
        mechanic: raw.механика || raw.mechanic || '',
        thinBlood: true
    };
}

function syncThinBloodAlchemy() {
    if (!isThinBloodClan()) return;

    if (hasThinBloodAlchemyMerit()) {
        if (!disciplineSources[THIN_BLOOD_ALCHEMY]) disciplineSources[THIN_BLOOD_ALCHEMY] = {};
        disciplineSources[THIN_BLOOD_ALCHEMY][t('Достоинство слабокровного: Алхимик')] = 1;
    } else {
        if (disciplineSources[THIN_BLOOD_ALCHEMY]) {
            delete disciplineSources[THIN_BLOOD_ALCHEMY][t('Достоинство слабокровного: Алхимик')];
            if (Object.keys(disciplineSources[THIN_BLOOD_ALCHEMY]).length === 0) {
                delete disciplineSources[THIN_BLOOD_ALCHEMY];
                delete selectedPowers[THIN_BLOOD_ALCHEMY];
            }
        }
    }
    rebuildDisciplineListFromSources();
}

function createThinBloodSelectedItem(item, index, isMerit) {
    const div = createSelectedItem(item, index, isMerit);
    const button = div.querySelector('.selected-item-remove');
    if (button) {
        button.setAttribute('onclick', `event.stopImmediatePropagation(); ${isMerit ? `removeThinBloodMerit(${index})` : `removeThinBloodFlaw(${index})`}`);
    }
    return div;
}

function renderThinBloodMeritsFlaws() {
    const section = document.getElementById('thin-blood-traits-section');
    if (!section) return;

    const shouldShow = isThinBloodClan();
    section.style.display = shouldShow ? 'block' : 'none';
    if (!shouldShow) return;

    selectedThinBloodMerits = selectedThinBloodMerits.filter(item => item.name !== vtmName('Склонность к Дисциплине'));

    const meritsContainer = document.getElementById('selected-thin-blood-merits-list');
    const flawsContainer = document.getElementById('selected-thin-blood-flaws-list');
    const balance = document.getElementById('thin-blood-balance');

    meritsContainer.innerHTML = '';
    flawsContainer.innerHTML = '';

    selectedThinBloodMerits.forEach((item, index) => {
        meritsContainer.appendChild(createThinBloodSelectedItem(item, index, true));
    });
    selectedThinBloodFlaws.forEach((item, index) => {
        flawsContainer.appendChild(createThinBloodSelectedItem(item, index, false));
    });

    const meritCount = selectedThinBloodMerits.length;
    const flawCount = selectedThinBloodFlaws.length;
    const isBalanced = meritCount === flawCount && meritCount <= 3;
    balance.innerHTML = tf('Выбрано: достоинства {meritCount}/3, недостатки {flawCount}/3. Нужно равное количество, максимум 3.', { meritCount, flawCount });
    balance.style.color = isBalanced ? '#78d878' : '#ffcc66';

    syncThinBloodAlchemy();
}

function validateThinBloodBalance({ silent = false } = {}) {
    if (!isThinBloodClan()) return true;
    const meritCount = selectedThinBloodMerits.length;
    const flawCount = selectedThinBloodFlaws.length;
    const ok = meritCount === flawCount && meritCount <= 3 && flawCount <= 3;
    if (!ok && !silent) {
        alert(t('У слабокровных количество слабокровных преимуществ и недостатков должно быть равным, максимум 3 и 3.'));
    }
    return ok;
}

function openThinBloodTraitsModal(tab = 0) {
    if (!isThinBloodClan()) return alert(t('Этот раздел доступен только слабокровным.'));
    if (startingSheetFixed && !expShopMode) return alert(t("Лист зафиксирован. Достоинства и недостатки слабокровных сейчас нельзя менять."));

    const html = `
    <div id="thin-blood-traits-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.96); z-index:12000; overflow:auto; padding:20px;">
        <div style="max-width:980px; margin:30px auto; background:#111; padding:25px; border-radius:8px; border:2px solid #a14600; position:relative;">
            <button onclick="closeThinBloodTraitsModal()" style="position:absolute; top:18px; right:25px; font-size:36px; color:#ffae00; background:none; border:none; cursor:pointer; z-index:10; line-height:1;">×</button>
            <h2 style="text-align:center; color:#ffae00; margin-bottom:20px;">${t('Слабокровные особенности')}</h2>
            <div style="display:flex; margin-bottom:20px; border-bottom:1px solid #333;">
                <button onclick="renderThinBloodTraitChoices(0)" id="tab-thin-merits" style="flex:1; padding:12px; background:${tab === 0 ? '#222' : '#111'}; border:none; color:white; font-weight:bold;">${t('Преимущества')}</button>
                <button onclick="renderThinBloodTraitChoices(1)" id="tab-thin-flaws" style="flex:1; padding:12px; background:${tab === 1 ? '#222' : '#111'}; border:none; color:white; font-weight:bold;">${t('Недостатки')}</button>
            </div>
            <div id="thin-blood-traits-list"></div>
        </div>
    </div>`;

    document.getElementById('thin-blood-traits-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    renderThinBloodTraitChoices(tab);
}

function closeThinBloodTraitsModal() {
    document.getElementById('thin-blood-traits-modal')?.remove();
}

function renderThinBloodTraitChoices(tab) {
    const container = document.getElementById('thin-blood-traits-list');
    if (!container) return;

    document.getElementById('tab-thin-merits').style.background = tab === 0 ? '#222' : '#111';
    document.getElementById('tab-thin-flaws').style.background = tab === 1 ? '#222' : '#111';

    const isMerit = tab === 0;
    const category = getThinBloodCategory(isMerit);
    const selected = isMerit ? selectedThinBloodMerits : selectedThinBloodFlaws;
    const other = isMerit ? selectedThinBloodFlaws : selectedThinBloodMerits;
    const titleColor = isMerit ? '#ffcc00' : '#ff6666';

    if (!category?.варианты?.length) {
        container.innerHTML = `<p style="color:#777;text-align:center;padding:40px;">${t('Данные не найдены.')}</p>`;
        return;
    }

    container.innerHTML = `
        <p style="color:#aaa;line-height:1.5;margin-top:0;">${category.описание || ''}</p>
        <p style="color:#ffcc66;">${tf('Баланс: достоинства {meritCount}/3, недостатки {flawCount}/3.', { meritCount: selectedThinBloodMerits.length, flawCount: selectedThinBloodFlaws.length })}</p>
    `;

    category.варианты.forEach((raw, index) => {
        if (isMerit && raw.название_пункта === vtmName('Склонность к Дисциплине')) return;
        const item = buildThinBloodTrait(raw, isMerit);
        const alreadyTaken = selected.some(existing => existing.name === item.name);
        const limitReached = selected.length >= 3;
        const wouldOverrunBalance = selected.length >= other.length + 1;
        const disabled = alreadyTaken || limitReached || wouldOverrunBalance;
        const reason = alreadyTaken
            ? t('Уже выбрано')
            : limitReached
                ? t('Максимум 3')
                : wouldOverrunBalance
                    ? t('Сначала уравновесь другой стороной')
                    : t('Добавить');

        const div = document.createElement('div');
        div.style.cssText = `
            background:#1a1a1a; padding:16px; margin-bottom:10px; border-radius:6px;
            border:1px solid ${disabled ? '#333' : '#664400'}; opacity:${disabled ? 0.55 : 1};
        `;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
                <div>
                    <strong style="color:${titleColor};">${escapeHTML(item.name)}</strong>
                    <div style="color:#aaa; margin-top:8px; line-height:1.45;">${escapeHTML(item.desc)}</div>
                    ${item.mechanic ? `<div style="color:#ddd; margin-top:8px; line-height:1.45;"><strong>${t("Механика:")}</strong> ${escapeHTML(item.mechanic)}</div>` : ''}
                </div>
                <button ${disabled ? 'disabled' : ''} style="min-width:120px; padding:9px 12px; border-radius:5px; border:1px solid #a14600; background:${disabled ? '#222' : '#2a1805'}; color:#ffcc66; cursor:${disabled ? 'not-allowed' : 'pointer'};">${reason}</button>
            </div>
        `;
        div.querySelector('button').onclick = () => addThinBloodTrait(index, isMerit);
        container.appendChild(div);
    });
}

function addThinBloodTrait(index, isMerit) {
    if (startingSheetFixed && !expShopMode) return alert(t("Лист зафиксирован. Достоинства и недостатки слабокровных сейчас нельзя менять."));
    const category = getThinBloodCategory(isMerit);
    const raw = category?.варианты?.[index];
    if (!raw) return;

    const selected = isMerit ? selectedThinBloodMerits : selectedThinBloodFlaws;
    const other = isMerit ? selectedThinBloodFlaws : selectedThinBloodMerits;
    const item = buildThinBloodTrait(raw, isMerit);

    if (selected.some(existing => existing.name === item.name)) return alert(t('Уже выбрано.'));
    if (selected.length >= 3) return alert(t('Можно взять максимум 3 слабокровных преимущества и 3 недостатка.'));
    if (selected.length >= other.length + 1) return alert(t('Сначала уравновесь другую сторону: количество должно быть равным.'));

    selected.push(item);
    renderThinBloodMeritsFlaws();
    renderThinBloodTraitChoices(isMerit ? 0 : 1);
}

window.removeThinBloodMerit = function(index) {
    if (startingSheetFixed && !expShopMode) return alert(t("Лист зафиксирован. Достоинства слабокровных сейчас нельзя менять."));
    selectedThinBloodMerits.splice(index, 1);
    renderThinBloodMeritsFlaws();
};

window.removeThinBloodFlaw = function(index) {
    if (startingSheetFixed && !expShopMode) return alert(t("Лист зафиксирован. Недостатки слабокровных сейчас нельзя менять."));
    selectedThinBloodFlaws.splice(index, 1);
    renderThinBloodMeritsFlaws();
};

window.openThinBloodTraitsModal = openThinBloodTraitsModal;
window.closeThinBloodTraitsModal = closeThinBloodTraitsModal;
window.renderThinBloodTraitChoices = renderThinBloodTraitChoices;
window.validateThinBloodBalance = validateThinBloodBalance;


// Окно выбора преимуществ и недостатков от стиля охоты
function showPredatorMeritsFlawsSelection(predName, predData) {
    let html = `
    <div id="predator-selection-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:13000; display:flex; align-items:center; justify-content:center;">
        <div style="background:#111; border:2px solid #ff3131; border-radius:10px; width:90%; max-width:820px; max-height:85vh; overflow:auto; padding:25px; position:relative;">
            <button onclick="closePredatorSelectionModal()" 
                    style="position:absolute; top:15px; right:20px; font-size:32px; color:#ff3131; background:none; border:none; cursor:pointer;">×</button>
            
            <h2 style="color:#ff3131; text-align:center; margin:0 0 10px;">${predName}</h2>
            <p style="text-align:center; color:#aaa; margin-bottom:20px;">${t('Выберите, что добавить от этого стиля охоты')}</p>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:25px;">`;

    // Преимущества
    if (predData.advantages && predData.advantages.length > 0) {
        html += `<div><strong style="color:#ffcc00; display:block; margin-bottom:12px;">${t('Преимущества:')}</strong>`;
        predData.advantages.forEach((adv, index) => {
            const name = formatPredatorTraitLine(adv, true);
            html += `<label style="display:block; margin:8px 0; color:#ddd; cursor:pointer;">
                        <input type="checkbox" class="pred-adv" value="${name}" data-index="${index}" checked> ${name}
                     </label>`;
        });
        html += `</div>`;
    }

    // Недостатки
    if (predData.disadvantages && predData.disadvantages.length > 0) {
        html += `<div><strong style="color:#ff6666; display:block; margin-bottom:12px;">${t('Недостатки:')}</strong>`;
        predData.disadvantages.forEach((dis, index) => {
            const name = formatPredatorTraitLine(dis, false);
            html += `<label style="display:block; margin:8px 0; color:#ddd; cursor:pointer;">
                        <input type="checkbox" class="pred-flaw" value="${name}" data-index="${index}" checked> ${name}
                     </label>`;
        });
        html += `</div>`;
    }

    html += `</div>
            <div style="margin-top:30px; display:flex; gap:12px; justify-content:space-between;">
                <button onclick="closePredatorSelectionModal()"
                        style="background:#333; color:white; padding:14px 35px; border:none; border-radius:6px; font-size:17px;">
                    ${t('Отмена')}
                </button>
                <button id="pred-confirm-btn"
                        style="background:#ff3131; color:black; padding:14px 40px; border:none; border-radius:6px; font-size:17px;">
                    ${t('Применить выбранное')}
                </button>
            </div>
        </div>
    </div>`;

    document.getElementById('predator-selection-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => {
        const btn = document.getElementById('pred-confirm-btn');
        if (btn) btn.onclick = () => confirmPredatorSelection(predName);
    }, 100);
}


function confirmPredatorSelection(predName) {
    const predData = RULES.predator_types?.[predName];
    if (!predData) return;

    // Преимущества
    document.querySelectorAll('.pred-adv:checked').forEach(cb => {
        const rawItem = predData.advantages?.[parseInt(cb.dataset.index, 10)] || cb.value;
        const item = buildPredatorTrait(rawItem, true, predName);
        // Проверяем, нет ли уже (включая от охоты)
        if (!selectedMerits.some(m => m.name === item.name && m.category === item.category)) {
            selectedMerits.push(item);
        }
    });

    // Недостатки
    document.querySelectorAll('.pred-flaw:checked').forEach(cb => {
        const rawItem = predData.disadvantages?.[parseInt(cb.dataset.index, 10)] || cb.value;
        const item = buildPredatorTrait(rawItem, false, predName);
        if (!selectedFlaws.some(f => f.name === item.name && f.category === item.category)) {
            selectedFlaws.push(item);
        }
    });

    closePredatorSelectionModal();
    renderSelectedMeritsFlaws();
}





function confirmPredatorDiscipline(predatorName) {
    const disc = document.getElementById('pred-disc-select').value;
    if (!disc) return alert(t("Выберите дисциплину!"));

    const predatorSource = `${t("Охота")}: ${predatorName}`;
    removeDisciplineSource(predatorSource);
    predatorProvidedDisciplines = {};
    setDisciplineSource(disc, 1, predatorSource);
    predatorProvidedDisciplines[disc] = 1;

    closePredDiscModal();

    updateAllDisciplineRows();
    updateTrackers();
    renderSelectedMeritsFlaws();
    applyPredatorChoiceItems(predatorName);
    notifySheetChoice('predatorDiscipline', predatorName);
}

function closePredatorSelectionModal() {
    document.getElementById('predator-selection-modal')?.remove();
}




// Проверка лимита преимуществ (игнорируем пункты от охоты)
function canAddMerit(newPoints) {
    if (expShopMode || isNpcCharacterType()) return true;

    const currentTotal = selectedMerits.reduce((sum, item) => {
        return sum + getPaidMeritPoints(item);
    }, 0);

    return currentTotal + newPoints <= getMeritsLimit();
}

// Проверка лимита недостатков (игнорируем пункты от охоты)
function canAddFlaw(newPoints) {
    if (expShopMode || isNpcCharacterType()) return true;

    const currentTotal = selectedFlaws.reduce((sum, item) => {
        if (item.fromPredator) return sum;        // бесплатно от охоты — не считаем
        return sum + getTraitPoints(item);
    }, 0);

    return currentTotal + newPoints <= getFlawsLimit();
}

// Показываем предупреждение при превышении
function showLimitWarning(isMerit) {
    const meritLimit = getMeritsLimit();
    const flawLimit = getFlawsLimit();
    const msg = isMerit
        ? tf('❌ Максимум {limit} точек преимуществ для выбранного типа!', { limit: meritLimit })
        : tf('❌ Максимум {limit} точек недостатков для выбранного типа!', { limit: flawLimit });
    
    const warning = document.createElement('div');
    warning.style.cssText = `
        position:fixed; top:20px; left:50%; transform:translateX(-50%);
        background:#330000; color:#ff6666; padding:12px 24px; border-radius:6px;
        border:2px solid #ff3131; z-index:99999; font-weight:bold;
    `;
    warning.textContent = msg;
    document.body.appendChild(warning);

    setTimeout(() => warning.remove(), 2500);
}

function createMeritItem(item, index, isMerit) {
    const div = document.createElement('div');
    div.style.cssText = 'background:#1f1f1f; padding:12px 16px; border-radius:6px; border-left:4px solid #ff3131; display:flex; justify-content:space-between; align-items:center;';
    div.innerHTML = `
        <div style="flex:1">
            <strong>${item.category} — ${item.name}</strong>
            <span style="color:#ffae00">(${tf('{points} т.', { points: item.points })})</span><br>
            <small style="color:#ccc">${item.desc}</small>
        </div>
        <button onclick="${isMerit ? `removeMerit(${index})` : `removeFlaw(${index})`}"
                style="background:#330000; color:#ff6666; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:18px;">×</button>
    `;
    return div;
}

window.removeMerit = function(i) {
    if (startingSheetFixed && !expShopMode) return alert(t("Лист зафиксирован. Преимущества сейчас нельзя менять."));
    selectedMerits.splice(i,1);
    renderSelectedMeritsFlaws();
    if (expShopMode) renderExpShopPanel();
};

window.removeFlaw = function(i) {
    if (startingSheetFixed && !expShopMode) return alert(t("Лист зафиксирован. Недостатки сейчас нельзя менять."));
    selectedFlaws.splice(i,1);
    renderSelectedMeritsFlaws();
    if (expShopMode) renderExpShopPanel();
};

// Поиск
document.getElementById('merits-search').addEventListener('input', () => {
    const activeTab = parseInt(document.getElementById('merits-flaws-modal').dataset.activeTab || '0', 10);
    renderCategories(activeTab);
});



// ==================== ГЛОБАЛЬНЫЕ ОКНА ДЛЯ ОХОТЫ ====================
window.showPredatorMeritsFlawsSelection = showPredatorMeritsFlawsSelection;
window.confirmPredatorSelection = confirmPredatorSelection;
window.closePredatorSelectionModal = closePredatorSelectionModal;


// ====================== ЭКСПОРТ / ИМПОРТ JSON ======================

function getFullCharacterData() {
    const character = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        name: document.getElementById('char-name').value.trim() || t("Безымянный"),
        clan: document.getElementById('clan-input').value,
        sire: getInputValue('sire-input'),
        concept: getInputValue('concept-input'),
        nature: getInputValue('nature-input'),
        mask: getInputValue('mask-input'),
        trueAge: getInputValue('true-age-input'),
        apparentAge: getInputValue('apparent-age-input'),
        birthDate: getInputValue('birth-date-input'),
        deathDate: getInputValue('death-date-input'),
        clanBane: getInputValue('clan-bane-input'),
        characterImage: characterImageData || '',
        touchstones: getTouchstonesSnapshot(),
        inventory: normalizeInventory(inventory),
        appearance: getInputValue('appearance-input'),
        backstory: getInputValue('backstory-input'),
        notes: getInputValue('notes-input'),
        predator: document.getElementById('predator-input').value,
        generation: document.getElementById('generation-input')?.value || '',
        type: document.getElementById('type-input')?.value || '',
        characterType: getCurrentCharacterType(),
        characterRole: window.__characterRole || (isNpcCharacterType() ? 'npc' : 'player'),
        sheetMode: currentCharType,
        creationWizard: window.__creationWizardData
            ? JSON.parse(JSON.stringify(window.__creationWizardData))
            : window.__loadedCharacterData?.creationWizard || null,
        hasBeenSaved: characterHasBeenSaved,
        bloodPotency: getCurrentBloodPotencyValue(),
        damageProfile: getSheetDamageProfile(),
        sheetFixed: startingSheetFixed,
        status: {
            physicalState: getHealthTracker().physicalState,
            humanityState: getHumanityState().value <= 0 ? 'lost_to_beast' : null
        },
        healthState: { ...healthState },
        baseHumanity: document.getElementById('base-humanity')?.value || '7',
        humanity: {
            ...getHumanityState(),
            base: parseInt(document.getElementById('base-humanity')?.value || '7', 10) || 7
        },
        morality: getMoralityData(),
        vitalTrackers: getVitalTrackerData(),
        freeExp: getCurrentXP(),
        expHistory: JSON.parse(JSON.stringify(expHistory || [])),
        skillPackage: document.getElementById('skill-package').value,
        sheetLock: {
            fixed: startingSheetFixed,
            baseLevels: baseLevels,
            snapshot: sheetLockSnapshot,
            baseState: startingSheetBase
        },
        
        attributes: {},
        skills: {},
        disciplines: JSON.parse(JSON.stringify(disciplineSources || {})),
        selectedPowers: JSON.parse(JSON.stringify(selectedPowers || {})),
        activeEffects: getActiveDisciplineEffects(),
        merits: JSON.parse(JSON.stringify(selectedMerits || [])),
        flaws: JSON.parse(JSON.stringify(selectedFlaws || [])),
        thinBloodMerits: JSON.parse(JSON.stringify(selectedThinBloodMerits || [])),
        thinBloodFlaws: JSON.parse(JSON.stringify(selectedThinBloodFlaws || []))
    };

    // Атрибуты
    document.querySelectorAll('.dot-input[data-type="attr"]:checked').forEach(input => {
        if (parseInt(input.value) > 0) {
            character.attributes[input.name] = parseInt(input.value);
        }
    });

    // Навыки + специализации
    document.querySelectorAll('.dot-input[data-type="skill"]:checked').forEach(input => {
        const val = parseInt(input.value);
        if (val > 0) {
            const skillName = input.name;
            character.skills[skillName] = { dots: val, specs: [] };

            const container = document.getElementById('specs-' + skillName);
            if (container) {
                container.querySelectorAll('input[type="text"]').forEach(inp => {
                    if (inp.value.trim()) character.skills[skillName].specs.push(inp.value.trim());
                });
            }
        }
    });

    return character;
}

window.getFullCharacterData = getFullCharacterData;

function resetCharacterSheetForLoad() {
    startingSheetFixed = false;
    sheetUnlockedForEditing = false;
    document.querySelectorAll('.dot-input').forEach(input => {
        input.checked = parseInt(input.value, 10) === 0;
    });
    document.querySelectorAll('.skill-specs').forEach(container => {
        container.innerHTML = '';
        container.style.display = 'none';
    });
    document.querySelectorAll('.spec-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });

    disciplineSources = {};
    selectedPowers = {};
    activeDisciplineEffects = [];
    selectedMerits = [];
    selectedFlaws = [];
    selectedThinBloodMerits = [];
    selectedThinBloodFlaws = [];
    vitalTrackers = { health: { superficial: 0, aggravated: 0, bonusMax: 0, maxOverride: null }, willpower: { superficial: 0, aggravated: 0 }, humanity: 0, hunger: 0 };
    damageProfile = 'vampire';
    characterPhysicalState = 'healthy';
    healthState = {};
    clanProvidedDisciplines = {};
    predatorProvidedDisciplines = {};
    currentPredatorSpecialty = null;
    characterImageData = '';
    touchstones = [];
    moralityState = { chronicleTenets: [], convictions: [], touchstones: [] };
    inventory = [];
    humanityState = { value: 7, stains: 0, stainEvents: [], lastRemorseCheckAt: null, lastHumanityLossAt: null };
    explicitBloodPotency = null;
    expShopMode = false;
    expShopSnapshot = null;
    expShopStartLevels = {};

    const list = document.getElementById('disciplines-list');
    if (list) list.innerHTML = '';
    renderCharacterImage();
    renderTouchstones();
    renderInventory();
    renderVitalTrackers();
    renderActiveDisciplineEffects();
    renderDerivedStatsPanel();
}

function applyCharacterData(d, sourceName = 'JSON') {
    console.log(`📥 Загрузка персонажа из ${sourceName}:`, d);
    window.__loadedCharacterData = d;
    window.__characterRole = d.characterRole || (String(d.sheetMode || '').startsWith('npc-') ? 'npc' : 'player');
    window.__creationWizardData = d.creationWizard ? JSON.parse(JSON.stringify(d.creationWizard)) : null;
    isApplyingCharacterData = true;

    try {
        resetCharacterSheetForLoad();
        const loadedCharacterType = getCharacterType(d);
        setCharacterType(d.sheetMode || loadedCharacterType, { persist: false, syncDamageProfile: false });
        setCharacterSavedState(sourceName !== 'JSON' || Boolean(d.hasBeenSaved));

        // Основная информация
        document.getElementById('char-name').value = d.name || t('Безымянный');
        document.getElementById('clan-input').value = d.clan || '';
        setInputValue('sire-input', d.sire);
        setInputValue('concept-input', d.concept);
        setInputValue('nature-input', d.nature);
        setInputValue('mask-input', d.mask);
        setInputValue('true-age-input', d.trueAge);
        setInputValue('apparent-age-input', d.apparentAge);
        setInputValue('birth-date-input', d.birthDate);
        setInputValue('death-date-input', d.deathDate);
        characterImageData = d.characterImage || d.image || d.portrait || '';
        touchstones = Array.isArray(d.touchstones)
            ? JSON.parse(JSON.stringify(d.touchstones))
            : [];
        touchstones = touchstones.map((item, index) => normalizeTouchstoneItem(item, index));
        moralityState = window.VTMHumanity.normalizeMorality(d.morality);
        humanityState = window.VTMHumanity.getHumanityState(d);
        inventory = normalizeInventory(d.inventory);
        setInputValue('appearance-input', d.appearance);
        setInputValue('backstory-input', d.backstory);
        setInputValue('notes-input', d.notes);
        autoResizeTextarea(document.getElementById('backstory-input'));
        renderCharacterImage();
        renderTouchstones();
        renderInventory();
        document.getElementById('predator-input').value = d.predator || '';
        if (document.getElementById('generation-input')) document.getElementById('generation-input').value = d.generation || '';
        if (document.getElementById('type-input')) document.getElementById('type-input').value = d.type || '';
        if (document.getElementById('base-humanity')) {
            document.getElementById('base-humanity').value = String(d.humanity?.base ?? d.baseHumanity ?? d.humanity?.value ?? '7');
        }
        const savedBloodPotency = d.bloodPotency ?? d.blood?.potency;
        explicitBloodPotency = savedBloodPotency === undefined || savedBloodPotency === null ? null : clampBloodPotency(savedBloodPotency);
        damageProfile = window.VTMHealth.normalizeDamageProfile(
            d.damageProfile || getDefaultDamageProfile(loadedCharacterType)
        );
        characterPhysicalState = d.status?.physicalState || 'healthy';
        healthState = d.healthState && typeof d.healthState === 'object' ? { ...d.healthState } : {};
        vitalTrackers = normalizeVitalTrackerData(d.vitalTrackers || {});
        vitalTrackers.humanity = humanityState.value;
        const initialHunger = document.getElementById('initial-hunger');
        if (initialHunger) initialHunger.value = String(clampHunger(vitalTrackers.hunger));
        if (document.getElementById('free-exp')) document.getElementById('free-exp').value = parseInt(d.freeExp ?? d.experience ?? 0, 10) || 0;
        expHistory = Array.isArray(d.expHistory) ? JSON.parse(JSON.stringify(d.expHistory)) : [];
        renderExpHistory();

        if (d.skillPackage) {
            document.getElementById('skill-package').value = d.skillPackage;
            currentPackage = d.skillPackage;
        }

        // Атрибуты
        Object.keys(d.attributes || {}).forEach(name => {
            const radio = document.querySelector(`input[name="${name}"][value="${d.attributes[name]}"]`);
            if (radio) radio.checked = true;
        });

        Object.keys(d.skills || {}).forEach(skill => {
            const s = d.skills[skill];
            const dots = typeof s === 'object' ? s.dots : s;
            const specs = typeof s === 'object' && Array.isArray(s.specs) ? s.specs : [];
            const radio = document.querySelector(`input[name="${skill}"][value="${dots}"]`);
            if (radio) radio.checked = true;

            restoreSpecializations(skill, specs);
        });

        // === ДИСЦИПЛИНЫ ===
        if (d.disciplines) {
            disciplineSources = JSON.parse(JSON.stringify(d.disciplines));
        }
        if (d.selectedPowers) {
            selectedPowers = JSON.parse(JSON.stringify(d.selectedPowers));
        }
        activeDisciplineEffects = normalizeActiveDisciplineEffects(d.activeEffects || []);

        // Полная перерисовка дисциплин
        const list = document.getElementById('disciplines-list');
        if (list) list.innerHTML = '';

        Object.keys(disciplineSources).forEach(name => {
            const total = Object.values(disciplineSources[name]).reduce((a, b) => a + b, 0);
            const sourcesText = Object.keys(disciplineSources[name]).join(" + ");
            addDisciplineRow(name, total, sourcesText);
        });

        renderDisciplines();   // кнопки "+" и панели способностей
        renderActiveDisciplineEffects();

        // Преимущества и недостатки
        if (d.merits) selectedMerits = [...d.merits];
        if (d.flaws) selectedFlaws = [...d.flaws];
        selectedThinBloodMerits = Array.isArray(d.thinBloodMerits) ? [...d.thinBloodMerits] : [];
        selectedThinBloodFlaws = Array.isArray(d.thinBloodFlaws) ? [...d.thinBloodFlaws] : [];
        enforceClanSpecificRules();

        startingSheetFixed = resolveCharacterSheetFixed(d);
        const savedBaseLevels = d.sheetLock?.baseLevels;
        baseLevels = (savedBaseLevels && Object.keys(savedBaseLevels).length > 0)
            ? JSON.parse(JSON.stringify(savedBaseLevels))
            : captureCurrentLevels();
        sheetLockSnapshot = d.sheetLock?.snapshot ? JSON.parse(JSON.stringify(d.sheetLock.snapshot)) : captureSheetSnapshot();
        startingSheetBase = d.sheetLock?.baseState
            ? JSON.parse(JSON.stringify(d.sheetLock.baseState))
            : JSON.parse(JSON.stringify(sheetLockSnapshot));

        renderSelectedMeritsFlaws();
        renderThinBloodMeritsFlaws();
        loadClanHint();
        if (d.clanBane && !getInputValue('clan-bane-input')) setInputValue('clan-bane-input', d.clanBane);
        loadPredatorHint();
        updateClanIcon();
        updateBloodPotencyAndBonuses();
        updateHumanity();
        updateTrackers();
        updateVitals();
        document.querySelectorAll('.skill-name').forEach(el => {
            const skillName = el.getAttribute('data-skill') || el.textContent.trim();
            if (skillName) updateSBadgeState(skillName);
        });
    } finally {
        isApplyingCharacterData = false;
        updateCreationRuleControls();
        applySheetLockState();
        updateExpPurchasedStyles();
        renderExpHistory();
        window.dispatchEvent(new CustomEvent('vtm-character-loaded'));
    }
}

window.applyCharacterData = applyCharacterData;

function exportToJSON() {
    if (!validatePlayerCreation({ requireFixed: true })) return;
    if (!validateThinBloodBalance()) return;
    const character = getFullCharacterData();

    const dataStr = JSON.stringify(character, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `V5_${character.name.replace(/[^a-zA-Z0-9а-яА-Я]/g, '_')}.json`;
    link.click();

    URL.revokeObjectURL(url);
}


// ====================== ИМПОРТ ИЗ JSON (ПОЛНАЯ ЗАГРУЗКА) ======================
function importFromJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(ev) {
            try {
                const d = JSON.parse(ev.target.result);
                applyCharacterData(d, 'JSON');

                alert(tf('✅ Персонаж «{name}» полностью загружен из JSON!', { name: d.name || t('Без имени') }));

            } catch (err) {
                alert(t('Ошибка при чтении JSON: ') + err.message);
                console.error(err);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}




// Привязываем события
function setupGenerationHint() {
    const typeSelect = document.getElementById('type-input');
    const genSelect = document.getElementById('generation-input');
    const predatorSelect = document.getElementById('predator-input');
    const baseHumanitySelect = document.getElementById('base-humanity');

    if (typeSelect) typeSelect.addEventListener('change', () => {
        updateBloodPotencyAndBonuses();
        updateHumanity();
        renderSelectedMeritsFlaws();
    });
    if (genSelect) genSelect.addEventListener('change', updateBloodPotencyAndBonuses);
    if (predatorSelect) predatorSelect.addEventListener('change', () => {
        updateHumanity();
        autoSaveVitalState();
    });
    if (baseHumanitySelect) baseHumanitySelect.addEventListener('change', () => {
        updateHumanity();
        autoSaveVitalState();
    });
}

function setupBloodPotencyField() {
    const input = document.getElementById('val-blood-potency');
    if (!input || input.dataset.ready === 'true') return;
    input.dataset.ready = 'true';
    input.addEventListener('change', () => {
        if (isPlayerVampire()) {
            explicitBloodPotency = null;
            updateBloodPotencyVital();
            return;
        }
        explicitBloodPotency = clampBloodPotency(input.value);
        input.value = String(explicitBloodPotency);
        updateBloodPotencyVital();
        autoSaveVitalState();
    });
    input.addEventListener('input', () => {
        if (isPlayerVampire()) return;
        explicitBloodPotency = clampBloodPotency(input.value);
        autoSaveVitalState();
    });
}




// ==================== ОБНОВЛЕНИЕ ОПЫТА ====================
function formatExpHistoryEntry(entry) {
    if (typeof entry === 'string') return entry;
    const amount = parseInt(entry.amount || 0, 10) || 0;
    const sign = amount >= 0 ? '+' : '';
    const date = entry.timestamp ? new Date(entry.timestamp).toLocaleString('ru-RU') : '';
    const details = Array.isArray(entry.details) && entry.details.length
        ? `<div style="margin-left:10px;color:#777;">${entry.details.map(escapeHTML).join('<br>')}</div>`
        : '';
    return `${sign}${amount} XP → ${escapeHTML(entry.text || t('Операция'))}${date ? ` <small style="color:#666;">${date}</small>` : ''}${details}`;
}

function renderExpHistory() {
    const logEl = document.getElementById('exp-log');
    if (!logEl) return;
    logEl.innerHTML = (expHistory || []).length
        ? expHistory.map(formatExpHistoryEntry).join('<br>')
        : `<span style="color:#666;">${t('История опыта пуста.')}</span>`;
}

function recordExpHistory(text, amount, details = []) {
    expHistory.unshift({
        text,
        amount,
        details,
        timestamp: new Date().toISOString()
    });
    if (expHistory.length > 80) expHistory = expHistory.slice(0, 80);
    renderExpHistory();
}

function addFreeExperience() {
    const raw = prompt(t('Сколько опыта добавить?'));
    const amount = parseInt(raw, 10);
    if (!amount || amount < 1) return alert(t('Введите положительное количество опыта.'));

    const freeExp = document.getElementById('free-exp');
    if (freeExp) freeExp.value = getCurrentXP() + amount;
    recordExpHistory(t('Добавлен свободный опыт'), amount);
    renderExpShopPanel();
}

window.addFreeExperience = addFreeExperience;

function updateExperienceBonus() {
    const type = document.getElementById('type-input').value;
    const expInput = document.getElementById('free-exp');
    const infoEl = document.getElementById('exp-bonus-info');

    if (!expInput) return;

    let bonus = 0;
    let text = t('Базовый опыт');

    switch(type) {
        case 'childe':
            bonus = 0;
            text = t('0 опыта (Птенец)');
            break;
        case 'neonate':
            bonus = 15;
            text = t('+15 опыта (Неонат)');
            break;
        case 'ancilla':
            bonus = 35;
            text = t('+35 опыта (Анцилла)');
            break;
        case 'elder':
            bonus = 50;
            text = t('+50 опыта (Старейшина)');
            break;
        case 'methuselah':
            bonus = 75;
            text = t('+75 опыта (Матузалем)');
            break;
        default:
            bonus = 0;
            text = '—';
    }

    const currentValue = parseInt(expInput.value) || 0;
    const canApplyAutoBonus = !startingSheetFixed && expHistory.length === 0 && (
        lastAutoExperienceBonus === null ||
        currentValue === lastAutoExperienceBonus ||
        currentValue === 0
    );

    if (canApplyAutoBonus) {
        expInput.value = bonus;
        lastAutoExperienceBonus = bonus;
    }

    if (infoEl) {
        infoEl.innerHTML = `<strong style="color:#ffcc00;">${text}</strong>`;
    }
}

// Привязываем события
function setupExperienceListener() {
    const typeSelect = document.getElementById('type-input');
    const expInput = document.getElementById('free-exp');

    if (expInput) {
        expInput.readOnly = true;
        expInput.addEventListener('keydown', e => e.preventDefault());
        expInput.addEventListener('paste', e => e.preventDefault());
    }

    if (typeSelect) {
        typeSelect.addEventListener('change', updateExperienceBonus);
    }
    
    // Также обновляем при загрузке
    window.addEventListener('load', () => {
        setTimeout(() => {
            updateExperienceBonus();
            renderExpHistory();
        }, 100);
    });
}

// Запускаем
setupExperienceListener();

// Привязываем к изменениям типа
document.getElementById('type-input').addEventListener('change', updateExperienceBonus);





// ==================== УЛУЧШЕННАЯ ГЕНЕРАЦИЯ JPG ====================
async function generateSheetImage() {
    const area = document.getElementById('capture-area');
    if (!area) return alert(t("Не найден #capture-area"));

    const charName = (document.getElementById('char-name')?.value || 'Kindred').trim();
    const btn = document.getElementById('btn-save');
    const originalText = btn?.textContent || t('Сохранить в JPG');

    if (btn) { btn.textContent = t('Генерируем...'); btn.disabled = true; }
    let restoreTextareaHeights = null;
    let restoreImageStyles = null;

    try {
        if (typeof window.html2canvas !== 'function') {
            throw new Error(t('html2canvas не загружен'));
        }
        restoreTextareaHeights = expandTextareasForCapture(area);
        restoreImageStyles = stabilizeImagesForCapture(area);

        const specContainers = area.querySelectorAll('.skill-specs');
        specContainers.forEach(c => {
            if (c.children.length > 0) c.style.display = 'flex';
        });

        await new Promise(r => setTimeout(r, 100));

        const canvas = await window.html2canvas(area, {
            scale: 3,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#0a0a0a',
            logging: false,
        });

        const link = document.createElement('a');
        link.download = `V5_${charName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_')}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.92);
        link.click();

    } catch (err) {
        console.error(err);
        alert(t("Ошибка генерации JPG. Проверь, что html2canvas подключён."));
    } finally {
        if (restoreImageStyles) restoreImageStyles();
        if (restoreTextareaHeights) restoreTextareaHeights();
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
    }
}

function setupSaveButton() {
    const btn = document.getElementById('btn-save');
    if (btn) {
        btn.removeEventListener('click', generateSheetImage);
        btn.addEventListener('click', generateSheetImage);
    }
}

// ==================== ГЕНЕРАЦИЯ PDF (только раздел социалки) ====================
// ---- Helpers for text PDF ----
function _pdfDots(n, max) {
    n = Math.min(Math.max(parseInt(n) || 0, 0), max || 5);
    return '●'.repeat(n) + '○'.repeat((max || 5) - n);
}

function _pdfEsc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _pdfField(label, value) {
    if (!value) return '';
    return `<tr>
        <td style="color:#555;padding:3px 10px 3px 0;white-space:nowrap;vertical-align:top;font-weight:600;">${_pdfEsc(label)}</td>
        <td style="padding:3px 0;vertical-align:top;">${_pdfEsc(value)}</td>
    </tr>`;
}

function _pdfSection(title, content) {
    return `<div style="margin-bottom:22px;">
        <div style="font-size:13pt;font-weight:bold;color:#8b0000;border-bottom:2px solid #8b0000;padding-bottom:4px;margin-bottom:10px;letter-spacing:1px;">${_pdfEsc(title)}</div>
        ${content}
    </div>`;
}

function _pdfTextBlock(title, text) {
    if (!text) return '';
    return `<div style="margin-bottom:18px;">
        <div style="font-size:10pt;font-weight:bold;color:#8b0000;margin-bottom:4px;letter-spacing:1px;">${_pdfEsc(title)}</div>
        <div style="font-size:9.5pt;line-height:1.5;white-space:pre-wrap;color:#1a1a1a;">${_pdfEsc(text)}</div>
    </div>`;
}

function buildPDFHTML(d) {
    const ATTR_CATS = {
        'Физические': ['Сила','Ловкость','Выносливость'],
        'Социальные': ['Обаяние','Манипуляция','Самообладание'],
        'Ментальные': ['Интеллект','Смекалка','Упорство'],
    };
    const SKILL_CATS = {
        'Физические': ['Атлетика','Вождение','Воровство','Выживание','Драка','Ремесло','Скрытность','Стрельба','Фехтование'],
        'Социальные': ['Запугивание','Исполнение','Лидерство','Обращение с животными','Проницательность','Убеждение','Уличное чутьё','Хитрость','Этикет'],
        'Ментальные': ['Гуманитарные науки','Естественные науки','Медицина','Наблюдательность','Оккультизм','Политика','Расследование','Техника','Финансы'],
    };

    const base = `font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#111;line-height:1.45;`;

    // --- PAGE BREAK helper ---
    const pb = `<div style="page-break-before:always;"></div>`;

    // ============================================================
    // SECTION 1: SOCIAL
    // ============================================================
    const infoRows = [
        _pdfField(t('Имя'), d.charName),
        _pdfField(t('Сир'), d.sire),
        _pdfField(t('Концепция'), d.concept),
        _pdfField(t('Натура'), d.nature),
        _pdfField(t('Маска'), d.mask),
        _pdfField(t('Истинный возраст'), d.trueAge),
        _pdfField(t('Видимый возраст'), d.apparentAge),
        _pdfField(t('Дата рождения'), d.birthDate),
        _pdfField(t('Дата смерти'), d.deathDate),
        _pdfField(t('Клан'), d.clan),
        _pdfField(t('Стиль охоты'), d.predator),
        _pdfField(t('Поколение'), d.generation),
        _pdfField(t('Тип'), d.type),
    ].join('');

    const social = `
        <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:20pt;font-weight:bold;color:#8b0000;letter-spacing:2px;">${_pdfEsc(d.charName)}</div>
            <div style="font-size:9pt;color:#666;margin-top:2px;">Vampire: the Masquerade V5 — ${t("Лист персонажа")}</div>
        </div>

        ${_pdfSection(t('ОСНОВНАЯ ИНФОРМАЦИЯ'), `<table style="width:100%;border-collapse:collapse;">${infoRows}</table>`)}

        ${d.clanBane ? _pdfSection(t('ИЗЪЯН КЛАНА'), `<div style="font-size:9.5pt;line-height:1.5;color:#1a1a1a;white-space:pre-wrap;">${_pdfEsc(d.clanBane)}</div>`) : ''}

        ${d.touchstones.length ? _pdfSection(t('ОПОРЫ И ПРИНЦИПЫ'),
            d.touchstones.map((item, i) => {
                const text = formatTouchstoneText(item) || item.text || '';
                return text ? `<div style="margin-bottom:6px;"><span style="color:#8b0000;font-weight:bold;">${i+1}.</span> ${_pdfEsc(text)}</div>` : '';
            }).join('')
        ) : ''}

        ${_pdfTextBlock(t('ВНЕШНОСТЬ'), d.appearance)}
        ${_pdfTextBlock(t('ПРЕДЫСТОРИЯ'), d.backstory)}
        ${_pdfTextBlock(t('ЗАМЕТКИ'), d.notes)}
    `;

    // ============================================================
    // SECTION 2: MECHANICS
    // ============================================================

    // Attributes columns
    const attrColsHTML = Object.entries(ATTR_CATS).map(([cat, names]) => `
        <div style="flex:1;">
            <div style="font-weight:bold;color:#8b0000;margin-bottom:6px;font-size:9pt;">${_pdfEsc(t(cat))}</div>
            ${names.map(name => `
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:9.5pt;">
                    <span>${_pdfEsc(t(name))}</span>
                    <span style="font-size:8pt;letter-spacing:1px;">${_pdfDots(d.attrs[name])}</span>
                </div>
            `).join('')}
        </div>
    `).join('');

    // Skills columns
    const skillColsHTML = Object.entries(SKILL_CATS).map(([cat, names]) => `
        <div style="flex:1;">
            <div style="font-weight:bold;color:#8b0000;margin-bottom:6px;font-size:9pt;">${_pdfEsc(t(cat))}</div>
            ${names.map(name => {
                const val = d.skills[name] || 0;
                return `
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:9.5pt;">
                        <span>${_pdfEsc(t(name))}</span>
                        <span style="font-size:8pt;letter-spacing:1px;">${_pdfDots(val)}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `).join('');

    // Vitals
    const vitalsHTML = `
        <div style="display:flex;gap:30px;flex-wrap:wrap;margin-top:6px;">
            <div><span style="color:#555;font-weight:600;">${t("Здоровье")}:</span> ${_pdfEsc(d.hp)}</div>
            <div><span style="color:#555;font-weight:600;">${t("Сила воли")}:</span> ${_pdfEsc(d.wp)}</div>
            <div><span style="color:#555;font-weight:600;">${t("Человечность")}:</span> ${_pdfEsc(d.humanity)}</div>
            <div><span style="color:#555;font-weight:600;">${t("Сила крови")}:</span> ${_pdfEsc(d.bloodPotency)}</div>
        </div>
    `;

    // Disciplines
    let discHTML = '';
    const discEntries = Object.entries(d.disciplines);
    if (discEntries.length) {
        discHTML = discEntries.map(([name, info]) => `
            <div style="margin-bottom:8px;">
                <span style="font-weight:bold;">${_pdfEsc(name)}</span>
                <span style="margin-left:8px;font-size:8pt;letter-spacing:1px;">${_pdfDots(info.dots)}</span>
                ${info.powers.length ? `<div style="font-size:9pt;color:#444;margin-left:14px;margin-top:2px;">${info.powers.map(p => `• ${_pdfEsc(p)}`).join('  ')}</div>` : ''}
            </div>
        `).join('');
    }

    // Merits / Flaws
    const meritRows = d.selectedMerits.map(m =>
        `<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:9.5pt;"><span>${_pdfEsc(m.name)}</span><span style="color:#555;">${'●'.repeat(m.points || 0)}</span></div>`
    ).join('');
    const flawRows = d.selectedFlaws.map(f =>
        `<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:9.5pt;"><span>${_pdfEsc(f.name)}</span><span style="color:#555;">${'●'.repeat(f.points || 0)}</span></div>`
    ).join('');

    const mechanics = `
        ${_pdfSection(t('ХАРАКТЕРИСТИКИ'), `<div style="display:flex;gap:24px;">${attrColsHTML}</div>`)}
        ${_pdfSection(t('НАВЫКИ'), `<div style="display:flex;gap:24px;">${skillColsHTML}</div>`)}
        ${_pdfSection(t('ВИТАЛЫ'), vitalsHTML)}
        ${discHTML ? _pdfSection(t('ДИСЦИПЛИНЫ'), discHTML) : ''}
        ${meritRows || flawRows ? _pdfSection(t('ПРЕИМУЩЕСТВА И НЕДОСТАТКИ'), `
            ${meritRows ? `<div style="margin-bottom:12px;"><div style="font-weight:bold;color:#555;margin-bottom:4px;">${t("Преимущества")}</div>${meritRows}</div>` : ''}
            ${flawRows ? `<div><div style="font-weight:bold;color:#555;margin-bottom:4px;">${t("Недостатки")}</div>${flawRows}</div>` : ''}
        `) : ''}
    `;

    // ============================================================
    // SECTION 3: INVENTORY
    // ============================================================
    let invHTML = '';
    if (d.inventory.length) {
        invHTML = d.inventory.map(item => `
            <div style="margin-bottom:10px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;">
                <div style="font-weight:bold;font-size:10pt;">${_pdfEsc(item.name || t('Без названия'))}
                    <span style="font-weight:normal;color:#666;font-size:9pt;"> — ${_pdfEsc(item.category)} · ${item.quantity} ${t('шт.')}</span>
                </div>
                ${item.description ? `<div style="font-size:9pt;color:#444;margin-top:3px;white-space:pre-wrap;">${_pdfEsc(item.description)}</div>` : ''}
                ${item.note ? `<div style="font-size:9pt;color:#888;margin-top:2px;font-style:italic;white-space:pre-wrap;">${_pdfEsc(item.note)}</div>` : ''}
            </div>
        `).join('');
    } else {
        invHTML = `<div style="color:#888;font-style:italic;">${t('Инвентарь пуст.')}</div>`;
    }

    const inventory_section = `
        <div style="font-size:15pt;font-weight:bold;color:#8b0000;margin-bottom:16px;letter-spacing:1px;">${t("ИНВЕНТАРЬ")}</div>
        ${invHTML}
    `;

    return `<div style="${base}padding:0;margin:0;background:#fff;">
        <div style="padding:0;">${social}</div>
        ${pb}
        <div style="padding:0;">${mechanics}</div>
        ${pb}
        <div style="padding:0;">${inventory_section}</div>
    </div>`;
}

function getSheetPdfFileName() {
    const rawName = (document.getElementById('char-name')?.value || 'Kindred').trim() || 'Kindred';
    return `V5_${rawName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_')}.pdf`;
}

function getSelectText(id) {
    const select = document.getElementById(id);
    if (!select) return '';
    return select.options?.[select.selectedIndex]?.textContent?.trim() || select.value || '';
}

function getInputValue(id) {
    return (document.getElementById(id)?.value || '').trim();
}

function getTextValue(id) {
    const element = document.getElementById(id);
    if (!element) return '';
    if ('value' in element) return String(element.value || '').trim();
    return (element.textContent || '').trim();
}

function getCheckedDots(name, fallback = 0) {
    return parseInt(document.querySelector(`input[name="${name}"]:checked`)?.value || String(fallback), 10) || 0;
}

function getSheetPdfData() {
    const attrGroups = {
        'Физические': ['Сила', 'Ловкость', 'Выносливость'],
        'Социальные': ['Обаяние', 'Манипуляция', 'Самообладание'],
        'Ментальные': ['Интеллект', 'Смекалка', 'Упорство']
    }; // category keys + trait names translated for display in renderPdfMechanics
    const skillGroups = {
        'Физические': ['Атлетика', 'Вождение', 'Воровство', 'Выживание', 'Драка', 'Ремесло', 'Скрытность', 'Стрельба', 'Фехтование'],
        'Социальные': ['Запугивание', 'Исполнение', 'Лидерство', 'Обращение с животными', 'Проницательность', 'Убеждение', 'Уличное чутьё', 'Хитрость', 'Этикет'],
        'Ментальные': ['Гуманитарные науки', 'Естественные науки', 'Медицина', 'Наблюдательность', 'Оккультизм', 'Политика', 'Расследование', 'Техника', 'Финансы']
    };

    const disciplines = Object.keys(disciplineSources || {}).map(name => ({
        name,
        dots: Object.values(disciplineSources[name] || {}).reduce((sum, value) => sum + Number(value || 0), 0),
        powers: (selectedPowers[name] || []).map(power => typeof power === 'string' ? power : power.name || power.название || '').filter(Boolean)
    })).filter(item => item.dots > 0);

    return {
        name: getInputValue('char-name') || 'Kindred',
        info: [
            [t('Сир'), getInputValue('sire-input')],
            [t('Концепция'), getInputValue('concept-input')],
            [t('Натура'), getInputValue('nature-input')],
            [t('Маска'), getInputValue('mask-input')],
            [t('Истинный возраст'), getInputValue('true-age-input')],
            [t('Видимый возраст'), getInputValue('apparent-age-input')],
            [t('Дата рождения'), getInputValue('birth-date-input')],
            [t('Дата смерти'), getInputValue('death-date-input')],
            [t('Клан'), getSelectText('clan-input')],
            [t('Стиль охоты'), getSelectText('predator-input')],
            [t('Поколение'), getSelectText('generation-input')],
            [t('Тип'), getSelectText('type-input')]
        ],
        clanBane: getInputValue('clan-bane-input'),
        touchstones: getTouchstonesSnapshot().map(item => formatTouchstoneText(item) || item.text || '').filter(Boolean),
        appearance: getInputValue('appearance-input'),
        backstory: getInputValue('backstory-input'),
        notes: getInputValue('notes-input'),
        attrGroups,
        skillGroups,
        attrValues: Object.values(attrGroups).flat().reduce((acc, name) => ({ ...acc, [name]: getCheckedDots(name, 1) }), {}),
        skillValues: Object.values(skillGroups).flat().reduce((acc, name) => ({ ...acc, [name]: getCheckedDots(name, 0) }), {}),
        vitals: [
            [t('Здоровье'), getVitalTrackerSummary('health')],
            [t('Сила воли'), getVitalTrackerSummary('willpower')],
            [t('Человечность'), getVitalTrackerSummary('humanity')],
            [t('Голод'), getVitalTrackerSummary('hunger')],
            [t('Сила крови'), getTextValue('val-blood-potency')],
            [t('Свободный опыт'), getInputValue('free-exp')]
        ],
        disciplines,
        merits: (selectedMerits || []).map(item => ({ name: item.name, points: item.points || 0 })),
        flaws: (selectedFlaws || []).map(item => ({ name: item.name, points: item.points || 0 })),
        thinBloodMerits: (selectedThinBloodMerits || []).map(item => ({ name: item.name, points: item.points || 0 })),
        thinBloodFlaws: (selectedThinBloodFlaws || []).map(item => ({ name: item.name, points: item.points || 0 })),
        inventory: (inventory || []).map(item => ({
            name: item.name || t('Без названия'),
            category: t(item.category || 'Другое'),
            quantity: item.quantity || 1,
            description: item.description || '',
            note: item.note || ''
        }))
    };
}

async function addPdfFont(pdf) {
    const toBase64 = (buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
    };

    const [regular, bold] = await Promise.all([
        fetch('/vampires/fonts/Arial.ttf').then(response => {
            if (!response.ok) throw new Error(t('Не удалось загрузить шрифт PDF'));
            return response.arrayBuffer();
        }),
        fetch('/vampires/fonts/ArialBold.ttf').then(response => {
            if (!response.ok) throw new Error(t('Не удалось загрузить жирный шрифт PDF'));
            return response.arrayBuffer();
        })
    ]);

    pdf.addFileToVFS('Arial.ttf', toBase64(regular));
    pdf.addFileToVFS('ArialBold.ttf', toBase64(bold));
    pdf.addFont('Arial.ttf', 'VTMArial', 'normal');
    pdf.addFont('ArialBold.ttf', 'VTMArial', 'bold');
    pdf.setFont('VTMArial', 'normal');
}

function drawPdfSheet(pdf, data) {
    const page = {
        w: pdf.internal.pageSize.getWidth(),
        h: pdf.internal.pageSize.getHeight(),
        margin: 28
    };
    const colors = {
        bg: [10, 10, 10],
        sheet: [0, 0, 0],
        panel: [8, 8, 8],
        line: [46, 46, 46],
        text: [220, 220, 220],
        muted: [130, 130, 130],
        red: [255, 49, 49],
        white: [255, 255, 255],
        gold: [255, 174, 0]
    };
    let y = page.margin;

    const setColor = (color) => pdf.setTextColor(color[0], color[1], color[2]);
    const fillPage = () => {
        pdf.setFillColor(...colors.bg);
        pdf.rect(0, 0, page.w, page.h, 'F');
        pdf.setFillColor(...colors.sheet);
        pdf.setDrawColor(...colors.line);
        pdf.rect(20, 18, page.w - 40, page.h - 36, 'FD');
        y = page.margin + 8;
    };
    const addPage = () => {
        pdf.addPage();
        fillPage();
    };
    const ensureSpace = (height) => {
        if (y + height > page.h - page.margin) addPage();
    };
    const text = (value, x, yy, options = {}) => {
        pdf.setFont('VTMArial', options.bold ? 'bold' : 'normal');
        pdf.setFontSize(options.size || 9);
        setColor(options.color || colors.text);
        pdf.text(String(value || ''), x, yy, options.align ? { align: options.align } : undefined);
    };
    const wrapped = (value, x, yy, width, options = {}) => {
        pdf.setFont('VTMArial', options.bold ? 'bold' : 'normal');
        pdf.setFontSize(options.size || 9);
        const lines = pdf.splitTextToSize(String(value || ''), width);
        setColor(options.color || colors.text);
        pdf.text(lines, x, yy);
        return lines.length * (options.lineHeight || 11);
    };
    const section = (title) => {
        ensureSpace(28);
        y += 10;
        text(title.toUpperCase(), page.w / 2, y, { size: 14, bold: true, color: colors.white, align: 'center' });
        y += 8;
        pdf.setDrawColor(...colors.line);
        pdf.line(page.margin + 12, y, page.w - page.margin - 12, y);
        y += 14;
    };
    const panel = (x, yy, w, h) => {
        pdf.setFillColor(...colors.panel);
        pdf.setDrawColor(...colors.line);
        pdf.roundedRect(x, yy, w, h, 3, 3, 'FD');
    };
    const field = (label, value, x, yy, w, h = 27) => {
        panel(x, yy, w, h);
        text(label, x + 8, yy + 10, { size: 6.8, bold: true, color: colors.muted });
        wrapped(value || ' ', x + 8, yy + 22, w - 16, { size: 8.6, lineHeight: 9.8, color: colors.white });
    };
    const dots = (count, x, yy, max = 5) => {
        for (let i = 1; i <= max; i++) {
            pdf.setDrawColor(...colors.red);
            if (i <= count) {
                pdf.setFillColor(...colors.red);
                pdf.circle(x + (i - 1) * 9, yy, 3.1, 'FD');
            } else {
                pdf.circle(x + (i - 1) * 9, yy, 3.1, 'S');
            }
        }
    };
    const dotText = (count, max = 5) => '●'.repeat(Math.max(0, count)) + '○'.repeat(Math.max(0, max - count));
    const blockText = (title, value) => {
        if (!value) return;
        const width = page.w - page.margin * 2 - 28;
        const lines = pdf.splitTextToSize(value, width);
        const height = Math.max(46, 28 + lines.length * 10);
        ensureSpace(height + 8);
        panel(page.margin + 14, y, width + 14, height);
        text(title, page.margin + 24, y + 14, { size: 8, bold: true, color: colors.red });
        wrapped(value, page.margin + 24, y + 29, width - 6, { size: 8.5, lineHeight: 10.5 });
        y += height + 8;
    };

    fillPage();

    text(data.name, page.w / 2, y + 14, { size: 20, bold: true, color: colors.red, align: 'center' });
    text('Vampire: the Masquerade V5 - ' + t('лист персонажа'), page.w / 2, y + 30, { size: 8, color: colors.muted, align: 'center' });
    y += 46;

    section(t('Социальное'));
    const fieldW = (page.w - page.margin * 2 - 24) / 3;
    data.info.forEach(([label, value], index) => {
        const x = page.margin + 14 + (index % 3) * (fieldW + 8);
        if (index > 0 && index % 3 === 0) y += 35;
        field(label, value, x, y, fieldW, 29);
    });
    y += 43;
    blockText(t('Изъян клана'), data.clanBane);
    if (data.touchstones.length) blockText(t('Опоры и принципы'), data.touchstones.map((item, index) => `${index + 1}. ${item}`).join('\n'));
    blockText(t('Внешность'), data.appearance);
    blockText(t('Предыстория'), data.backstory);
    blockText(t('Заметки персонажа'), data.notes);
}

async function generateSheetPDF() {
    if (typeof window.jspdf === 'undefined') return alert(t('jsPDF не загружен'));
    const { jsPDF } = window.jspdf;
    const btn = document.getElementById('btn-pdf');
    const originalText = btn?.textContent || t('Скачать PDF');
    if (btn) { btn.textContent = t('Скачиваем PDF…'); btn.disabled = true; }

    try {
        const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
        await addPdfFont(pdf);
        drawPdfSheet(pdf, getSheetPdfData());
        pdf.save(getSheetPdfFileName());
    } catch (err) {
        console.error(err);
        alert(t('Ошибка генерации PDF: ') + err.message);
    } finally {
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
    }
}

window.generateSheetPDF = generateSheetPDF;

// ==================== ТРАТА ОПЫТА — АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ УРОВНЯ ====================

let expLog = [];

function logExp(text, cost) {
    const freeExpEl = document.getElementById('free-exp');
    if (freeExpEl) {
        let current = parseInt(freeExpEl.value) || 0;
        freeExpEl.value = Math.max(0, current - cost);
    }

    recordExpHistory(text, -cost);
}

// Вспомогательная функция кумулятивного расчёта
function calculateCumulativeCost(current, target, multiplier) {
    let total = 0;
    for (let i = current + 1; i <= target; i++) {
        total += i * multiplier;
    }
    return total;
}

// ====================== ХАРАКТЕРИСТИКА ======================
function spendOnAttribute() {
    const typedName = prompt(t("Какую характеристику хочешь повысить?"));
    if (!typedName) return;
    const name = vtmCanonicalName(typedName);

    // Автоматически берём текущий уровень
    const currentRadio = document.querySelector(`input[name="${name}"]:checked`);
    const current = currentRadio ? parseInt(currentRadio.value) : 0;

    const target = parseInt(prompt(tf("Текущий уровень: {current}\nНовый уровень?", { current })));
    if (!target || target <= current || target > 5) return alert(t("Неверный уровень"));

    const cost = target * 5;
    if (!assertEnoughXP(cost)) return;

    if (confirm(tf("Повысить {name} с {current} → {target} за {cost} XP?", { name: t(name), current, target, cost }))) {
        const newRadio = document.querySelector(`input[name="${name}"][value="${target}"]`);
        if (newRadio) newRadio.checked = true;

        logExp(`${t(name)} ${current}→${target}`, cost);
        updateVitals();
        alert(tf("✅ {name} повышена!", { name: t(name) }));
    }
}

// ====================== НАВЫК ======================
function spendOnSkill() {
    const typedName = prompt(t("Какой навык хочешь повысить?"));
    if (!typedName) return;
    const name = vtmCanonicalName(typedName);

    const currentRadio = document.querySelector(`input[name="${name}"]:checked`);
    const current = currentRadio ? parseInt(currentRadio.value) : 0;

    const target = parseInt(prompt(tf("Текущий уровень: {current}\nНовый уровень?", { current })));
    if (!target || target <= current || target > 5) return alert(t("Неверный уровень"));

    const cost = calculateCumulativeCost(current, target, 3);

    if (confirm(tf("Повысить {name} с {current} → {target} за {cost} XP?", { name: t(name), current, target, cost }))) {
        const newRadio = document.querySelector(`input[name="${name}"][value="${target}"]`);
        if (newRadio) newRadio.checked = true;

        logExp(`${t(name)} ${current}→${target}`, cost);
        alert(tf("✅ {name} повышен!", { name: t(name) }));
    }
}

// ====================== СПЕЦИАЛИЗАЦИЯ ======================
function spendOnSpecialty() {
    const typedSkill = prompt(t("Для какого навыка добавляем специализацию?"));
    if (!typedSkill) return;
    const skill = vtmCanonicalName(typedSkill);
    const spec = prompt(t("Название специализации?"));

    if (confirm(tf('Добавить "{spec}" за 3 XP?', { spec }))) {
        const container = document.getElementById(`specs-${skill}`);
        if (container) {
            const div = document.createElement('div');
            div.className = 'skill-spec-line';
            div.innerHTML = `• ${spec} <small>(3 XP)</small>`;
            container.appendChild(div);
            container.style.display = 'block';
        }
        logExp(tf('Специализация "{spec}" ({skill})', { spec, skill }), 3);
    }
}

// ====================== ПРЕИМУЩЕСТВО ======================
function spendOnMerit() {
    const name = prompt(t("Какое преимущество покупаешь/повышаешь?"));
    if (!name) return;
    const dots = parseInt(prompt(t("Сколько пунктов добавить?")) || "1");

    const cost = dots * 3;

    if (confirm(tf('Добавить "{name}" (+{dots} пунктов) за {cost} XP?', { name, dots, cost }))) {
        logExp(tf('Преимущество "{name}" +{dots}', { name, dots }), cost);
        alert(t("✅ Добавлено!"));
    }
}

// ====================== ДИСЦИПЛИНА ======================
function spendOnDiscipline() {
    const name = prompt(t("Название дисциплины?"));
    if (!name) return;
    if (!canUseDiscipline(name) || isThinBloodClan()) return alert(t('Эта дисциплина недоступна текущему клану.'));

    // Автоматически считаем текущий уровень дисциплины
    let current = 0;
    if (disciplineSources[name]) {
        current = Object.values(disciplineSources[name]).reduce((a, b) => a + b, 0);
    }

    const target = parseInt(prompt(tf("Текущий уровень: {current}\nНовый уровень?", { current })));
    if (!target || target <= current || target > 5) return;

    const isClan = confirm(t("Это **клановая** дисциплина?"));
    const multiplier = isClan ? 5 : 7;

    const cost = calculateCumulativeCost(current, target, multiplier);

    if (confirm(tf("Повысить {name} с {current} → {target} за {cost} XP?", { name, current, target, cost }))) {
        mergeDiscipline(name, target - current, t("Опыт"));
        logExp(tf("Дисциплина {name} {current}→{target}", { name, current, target }), cost);
    }
}

// ==================== КРАСИВОЕ МОДАЛЬНОЕ ОКНО ТРАТЫ ОПЫТА ====================

let expLogModal = [];

function logModal(text, cost) {
    const freeExp = document.getElementById('free-exp');
    if (freeExp) freeExp.value = Math.max(0, (parseInt(freeExp.value) || 0) - cost);

    expLogModal.unshift(`-${cost} XP → ${text}`);
    if (expLogModal.length > 8) expLogModal.pop();

    const logEl = document.getElementById('modal-log');
    if (logEl) logEl.innerHTML = expLogModal.join('<br>');
    recordExpHistory(text, -cost);
}

function openExpModal() {
    startExpShopMode();
}

function closeExpModal() {
    document.getElementById('exp-modal').style.display = 'none';
}

function getTraitKindLabel(type) {
    if (type === 'attr') return t('Характеристика');
    if (type === 'skill') return t('Навык');
    if (type === 'discipline') return t('Дисциплина');
    if (type === 'merit') return t('Преимущество');
    if (type === 'flaw') return t('Недостаток');
    if (type === 'specialty') return t('Специализация');
    if (type === 'power') return t('Сила дисциплины');
    return t('Покупка');
}

function getTraitMultiplier(type) {
    return type === 'attr' ? 5 : 3;
}

function getLevelPurchaseCost(fromLevel, toLevel, multiplier) {
    let total = 0;
    if (toLevel > fromLevel) {
        for (let level = fromLevel + 1; level <= toLevel; level++) {
            total += level * multiplier;
        }
    } else if (toLevel < fromLevel) {
        for (let level = toLevel + 1; level <= fromLevel; level++) {
            total -= level * multiplier;
        }
    }
    return total;
}

function getDisciplineTotal(name, sources = disciplineSources) {
    return Object.values(sources?.[name] || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
}

function getBaseDisciplineLevel(name) {
    return getDisciplineTotal(name, startingSheetBase?.disciplines || {});
}

function getDisciplineModeMultiplier(modeLabel) {
    const normalized = String(modeLabel || '').toLowerCase();
    if (normalized.includes('каитиф')) return 6;
    if (normalized.includes('сторон')) return 7;
    return 5;
}

function getDisciplineMultiplier(name, sources = disciplineSources) {
    const sourceText = Object.keys(sources?.[name] || {}).join(' ').toLowerCase();
    if (!sourceText && expShopMode) return getDisciplineModeMultiplier(expShopDisciplineMode);
    if (sourceText.includes('каитиф')) return 6;
    if (sourceText.includes('сторон')) return 7;
    return 5;
}

function getDisciplineCartMultiplier(name, from, to) {
    if (to > from) return getDisciplineMultiplier(name, disciplineSources);
    return getDisciplineMultiplier(name, expShopSnapshot?.disciplines || disciplineSources);
}

function getDisciplinePreviewCost(name, target) {
    const from = getDisciplineTotal(name, expShopSnapshot?.disciplines || {});
    return getLevelPurchaseCost(from, target, getDisciplineCartMultiplier(name, from, target));
}

function getExistingDisciplineModeLabel(name) {
    const sourceText = Object.keys(disciplineSources[name] || {}).join(' ').toLowerCase();
    if (sourceText.includes('каитиф')) return 'каитиф';
    if (sourceText.includes('сторон')) return 'сторонняя';
    return 'клановая';
}

function getItemKey(item) {
    if (item?.fromPredator) {
        return `predator::${item.predatorType || ''}::${item.category || ''}::${item.predatorBaseName || item.name || ''}`;
    }
    return `${item?.category || ''}::${item?.name || item?.название_пункта || ''}`;
}

function getBaseMeritKeys() {
    return new Set((startingSheetBase?.merits || []).map(getItemKey));
}

function getBaseFlawKeys() {
    return new Set((startingSheetBase?.flaws || []).map(getItemKey));
}

function getPowerLevel(discName, powerName) {
    const powers = RULES.disciplines?.[discName]?.powers || {};
    for (let level = 1; level <= 5; level++) {
        if (powers[level]?.[powerName]) return level;
    }
    return 0;
}

function getPowerPurchaseCost(discName, powerName) {
    return 0;
}

function getTraitPurchaseCost(item) {
    return getTraitPoints(item) * 3;
}

function getMeritPurchaseCost(item) {
    return getPaidMeritPoints(item) * 3;
}

function getExpShopCart() {
    const cart = [];
    document.querySelectorAll('.dots input.dot-input:checked').forEach(input => {
        const name = input.name;
        const current = parseInt(input.value) || 0;
        const start = expShopStartLevels[name] ?? 0;
        if (!name || current === start) return;

        const multiplier = getTraitMultiplier(input.dataset.type);
        cart.push({
            name,
            type: input.dataset.type,
            from: start,
            to: current,
            cost: getLevelPurchaseCost(start, current, multiplier)
        });
    });

    const snapshotDisciplines = expShopSnapshot?.disciplines || {};
    const allDisciplines = new Set([...Object.keys(snapshotDisciplines), ...Object.keys(disciplineSources)]);
    allDisciplines.forEach(name => {
        const from = getDisciplineTotal(name, snapshotDisciplines);
        const to = getDisciplineTotal(name, disciplineSources);
        if (from === to) return;
        const multiplier = getDisciplineCartMultiplier(name, from, to);
        cart.push({
            name,
            type: 'discipline',
            from,
            to,
            cost: getLevelPurchaseCost(from, to, multiplier)
        });
    });

    const snapshotMerits = expShopSnapshot?.merits || [];
    const currentMeritMap = new Map(selectedMerits.map(item => [getItemKey(item), item]));
    const snapshotMeritMap = new Map(snapshotMerits.map(item => [getItemKey(item), item]));
    selectedMerits.forEach(item => {
        const key = getItemKey(item);
        const previous = snapshotMeritMap.get(key);
        if (previous) {
            const previousPaidPoints = getPaidMeritPoints(previous);
            const currentPaidPoints = getPaidMeritPoints(item);
            if (previousPaidPoints !== currentPaidPoints) {
                cart.push({
                    name: item.name,
                    type: 'merit',
                    from: getTraitPoints(previous),
                    to: getTraitPoints(item),
                    cost: (currentPaidPoints - previousPaidPoints) * 3
                });
            }
            return;
        }
        const points = getTraitPoints(item);
        cart.push({ name: item.name, type: 'merit', from: 0, to: points, cost: getMeritPurchaseCost(item) });
    });
    snapshotMerits.forEach(item => {
        const key = getItemKey(item);
        if (currentMeritMap.has(key)) return;
        const points = getTraitPoints(item);
        const cost = getMeritPurchaseCost(item);
        cart.push({ name: item.name, type: 'merit', from: points, to: 0, cost: cost ? -cost : 0 });
    });

    const snapshotFlaws = expShopSnapshot?.flaws || [];
    const currentFlawKeys = new Set(selectedFlaws.map(getItemKey));
    const snapshotFlawKeys = new Set(snapshotFlaws.map(getItemKey));
    selectedFlaws.forEach(item => {
        const key = getItemKey(item);
        if (snapshotFlawKeys.has(key)) return;
        const points = getTraitPoints(item);
        cart.push({ name: item.name, type: 'flaw', from: 0, to: points, cost: 0 });
    });
    snapshotFlaws.forEach(item => {
        const key = getItemKey(item);
        if (currentFlawKeys.has(key)) return;
        const points = getTraitPoints(item);
        cart.push({ name: item.name, type: 'flaw', from: points, to: 0, cost: 0 });
    });

    const snapshotSkills = expShopSnapshot?.skills || {};
    const currentSkills = getFullCharacterData().skills || {};
    const allSkillNames = new Set([...Object.keys(snapshotSkills), ...Object.keys(currentSkills)]);
    allSkillNames.forEach(skillName => {
        const before = new Set(snapshotSkills[skillName]?.specs || []);
        const after = new Set(currentSkills[skillName]?.specs || []);
        after.forEach(spec => {
            if (!before.has(spec)) cart.push({ name: `${skillName}: ${spec}`, type: 'specialty', from: 0, to: 1, cost: 3 });
        });
        before.forEach(spec => {
            if (!after.has(spec)) cart.push({ name: `${skillName}: ${spec}`, type: 'specialty', from: 1, to: 0, cost: -3 });
        });
    });

    const snapshotPowers = expShopSnapshot?.selectedPowers || {};
    const allPowerDisciplines = new Set([...Object.keys(snapshotPowers), ...Object.keys(selectedPowers)]);
    allPowerDisciplines.forEach(discName => {
        const before = new Set(snapshotPowers[discName] || []);
        const after = new Set(selectedPowers[discName] || []);
        after.forEach(power => {
            if (!before.has(power)) cart.push({ name: `${discName}: ${power}`, type: 'power', from: 0, to: getPowerLevel(discName, power), cost: getPowerPurchaseCost(discName, power) });
        });
        before.forEach(power => {
            if (!after.has(power)) cart.push({ name: `${discName}: ${power}`, type: 'power', from: getPowerLevel(discName, power), to: 0, cost: -getPowerPurchaseCost(discName, power) });
        });
    });

    return cart;
}

function getExpShopTotal() {
    return getExpShopCart().reduce((sum, item) => sum + item.cost, 0);
}

function getCartCostLabel(cost) {
    if (cost > 0) return `-${cost} XP`;
    if (cost < 0) return `+${Math.abs(cost)} XP`;
    return '0 XP';
}

function shouldShowCartCost(item) {
    return item.type !== 'power';
}

function renderExpShopPanel() {
    const rightPanel = document.querySelector('.right-panel');
    if (!rightPanel) return;

    document.querySelectorAll('#clan-hint-box, #predator-hint-box, #generation-hint-box').forEach(box => {
        box.style.display = expShopMode ? 'none' : '';
    });

    let panel = document.getElementById('xp-shop-side-panel');
    if (!expShopMode) {
        panel?.remove();
        return;
    }

    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'xp-shop-side-panel';
        panel.className = 'xp-shop-panel';
        const authBtn = document.getElementById('auth-btn');
        if (authBtn?.nextSibling) {
            rightPanel.insertBefore(panel, authBtn.nextSibling);
        } else {
            rightPanel.prepend(panel);
        }
    }

    const cart = getExpShopCart();
    const total = cart.reduce((sum, item) => sum + item.cost, 0);
    const freeXP = getCurrentXP();
    const overBudget = total > freeXP;

    const cartHTML = cart.length
        ? cart.map(item => `
            <div class="xp-cart-line">
                <span>${getTraitKindLabel(item.type)}: ${item.name} ${item.from}→${item.to}</span>
                ${shouldShowCartCost(item) ? `<strong>${getCartCostLabel(item.cost)}</strong>` : ''}
            </div>
        `).join('')
        : `<div style="color:#777; font-size:13px; line-height:1.45;">${t('Кликай по листу. Покупки и продажи появятся здесь отдельными строками.')}</div>`;

    panel.innerHTML = `
        <h3 style="margin:0 0 8px; color:#ff9500; text-align:center;">${t('Касса опыта')}</h3>
        <table>
            <tr><th>${t('Покупка')}</th><th>${t('Цена')}</th></tr>
            <tr><td>${t('Характеристика')}</td><td>${t('Новое значение × 5')}</td></tr>
            <tr><td>${t('Навык')}</td><td>${t('Новое значение × 3')}</td></tr>
            <tr><td>${t('Новая специализация')}</td><td>3 XP</td></tr>
            <tr><td>${t('Клановая дисциплина')}</td><td>${t('Новое значение × 5')}</td></tr>
            <tr><td>${t('Сторонняя дисциплина')}</td><td>${t('Новое значение × 7')}</td></tr>
            <tr><td>${t('Дисциплина каитифа')}</td><td>${t('Новое значение × 6')}</td></tr>
            <tr><td>${t('Сила дисциплины')}</td><td>${t('Бесплатно, максимум = уровень дисциплины')}</td></tr>
            <tr><td>${t('Ритуал / рецептура')}</td><td>${t('Уровень × 3')}</td></tr>
            <tr><td>${t('Преимущество')}</td><td>${t('3 XP за пункт')}</td></tr>
            <tr><td>${t('Недостаток')}</td><td>${t('Бесплатно')}</td></tr>
            <tr><td>${t('Сила Крови')}</td><td>${t('Новое значение × 10')}</td></tr>
        </table>
        <label style="display:block;color:#aaa;font-size:12px;margin:10px 0 6px;">${t('Цена новых дисциплин')}</label>
        <select id="xp-discipline-mode" onchange="expShopDisciplineMode=this.value; renderDisciplines(); renderExpShopPanel();" style="width:100%;margin-bottom:10px;">
            <option value="клановая" ${expShopDisciplineMode === 'клановая' ? 'selected' : ''}>${t('Клановая ×5')}</option>
            <option value="сторонняя" ${expShopDisciplineMode === 'сторонняя' ? 'selected' : ''}>${t('Сторонняя ×7')}</option>
            <option value="каитиф" ${expShopDisciplineMode === 'каитиф' ? 'selected' : ''}>${t('Каитиф ×6')}</option>
        </select>
        <div style="color:#aaa; font-size:12px; margin-bottom:8px;">${t('Чек покупок и продаж')}</div>
        ${cartHTML}
        <div class="xp-cart-total">
            <span>${t('Итого')}</span>
            <span style="color:${overBudget ? '#ff6666' : '#ffcc66'}">${getCartCostLabel(total)} / ${freeXP} XP</span>
        </div>
        ${overBudget ? `<div style="color:#ff6666; font-size:12px; margin-top:8px;">${tf('Не хватает {amount} XP.', { amount: total - freeXP })}</div>` : ''}
        <div class="xp-shop-actions">
            <button onclick="cancelExpShopPurchases()" style="background:#333; color:#eee;">${t('Отмена')}</button>
            <button onclick="acceptExpShopPurchases()" style="background:#ff9500; color:#111;">${t('Принять')}</button>
        </div>
    `;
}

function getDisciplineNamesForPrompt() {
    if (isThinBloodClan()) return [];
    return getStandardDisciplineNames();
}

function askDisciplineName(message = t('Название дисциплины?')) {
    const known = getDisciplineNamesForPrompt();
    if (known.length === 0) {
        alert(t('Для текущего клана покупка дисциплин здесь недоступна.'));
        return '';
    }
    const hint = known.length ? tf('\n\nДоступные: {names}', { names: known.join(', ') }) : '';
    const name = prompt(`${message}${hint}`);
    return name ? name.trim() : '';
}

function buildDisciplineSourcesAtTotal(name, target, modeLabel = 'клановая') {
    const snapshotSources = expShopMode
        ? JSON.parse(JSON.stringify(expShopSnapshot?.disciplines?.[name] || {}))
        : JSON.parse(JSON.stringify(disciplineSources?.[name] || startingSheetBase?.disciplines?.[name] || {}));
    const result = {};
    let left = target;

    Object.entries(snapshotSources).forEach(([source, value]) => {
        if (left <= 0) return;
        const dots = Math.max(0, parseInt(value, 10) || 0);
        const kept = Math.min(dots, left);
        if (kept > 0) {
            result[source] = kept;
            left -= kept;
        }
    });

    if (left > 0) {
        result[tf('Опыт: {modeLabel}', { modeLabel: t(modeLabel) })] = (result[tf('Опыт: {modeLabel}', { modeLabel: t(modeLabel) })] || 0) + left;
    }

    return result;
}

function setDisciplineTotal(name, target, modeLabel = 'клановая') {
    if (target === 0) {
        delete disciplineSources[name];
        delete selectedPowers[name];
    } else {
        disciplineSources[name] = buildDisciplineSourcesAtTotal(name, target, modeLabel);
    }

    if (selectedPowers[name] && selectedPowers[name].length > target) {
        selectedPowers[name] = selectedPowers[name].slice(0, target);
    }

    updateAllDisciplineRows();
    updateDisciplineTotal();
    renderDisciplines();
    renderExpShopPanel();
    return true;
}

function shopBuyDiscipline() {
    const name = askDisciplineName(t('Какую дисциплину купить или повысить?'));
    if (!name) return;

    const current = getDisciplineTotal(name);
    const target = parseInt(prompt(tf('Текущий уровень: {current}\nДо какого уровня повысить?', { current }), String(Math.min(5, current + 1))), 10);
    if (!target || target <= current || target > 5) return alert(t('Неверный уровень.'));

    const mode = prompt(t('Тип покупки: clan / out / caitiff'), 'clan');
    if (!mode) return;
    const normalized = mode.toLowerCase();
    const label = normalized === 'out' ? 'сторонняя' : normalized === 'caitiff' ? 'каитиф' : 'клановая';

    setDisciplineTotal(name, target, label);
}

function shopSellDiscipline() {
    const currentNames = Object.keys(disciplineSources).filter(name => getDisciplineTotal(name) > 0);
    if (currentNames.length === 0) return alert(t('Нет дисциплин для продажи.'));

    const name = prompt(tf('Какую дисциплину продать?\n\nМожно: {names}', { names: currentNames.join(', ') }));
    if (!name || !disciplineSources[name]) return;

    const current = getDisciplineTotal(name);
    const target = parseInt(prompt(tf('Текущий уровень: {current}\nДо какого уровня снизить?', { current }), String(Math.max(0, current - 1))), 10);
    if (Number.isNaN(target) || target < 0 || target >= current) return alert(t('Неверный уровень.'));

    setDisciplineTotal(name, target, getExistingDisciplineModeLabel(name));
}

function shopAddPower() {
    const names = Object.keys(disciplineSources).filter(name => getDisciplineTotal(name) > 0);
    if (names.length === 0) return alert(t('Сначала купи или получи дисциплину.'));

    const name = prompt(tf('Для какой дисциплины добавить силу?\n\nДоступные: {names}', { names: names.join(', ') }));
    if (!name || !disciplineSources[name]) return;

    openPowerSelectionModal(name, getDisciplineTotal(name));
}

function shopAddMerit() {
    openMeritsFlawsModal();
}

function shopSellMerit() {
    const removable = selectedMerits
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !item.fromPredator);

    if (removable.length === 0) return alert(t('Нет преимуществ для продажи.'));

    const list = removable.map(({ item }, i) => tf('{n}. {category} — {name} ({points} XP-точ.)', { n: i + 1, category: item.category, name: item.name, points: getTraitPoints(item) })).join('\n');
    const choice = parseInt(prompt(tf('Какое преимущество продать?\n\n{list}', { list })), 10);
    if (!choice || !removable[choice - 1]) return;

    selectedMerits.splice(removable[choice - 1].index, 1);
    renderSelectedMeritsFlaws();
    renderExpShopPanel();
}

function startExpShopMode() {
    if (!startingSheetFixed) {
        alert(t("Сначала зафиксируй стартовый лист."));
        return;
    }

    if (expShopMode) {
        renderExpShopPanel();
        return;
    }

    expShopMode = true;
    expShopSnapshot = getFullCharacterData();
    expShopStartLevels = captureCurrentLevels();
    applySheetLockState();
    updateExpPurchasedStyles();
    renderDisciplines();
    renderExpShopPanel();
}

function stopExpShopMode() {
    expShopMode = false;
    expShopSnapshot = null;
    expShopStartLevels = {};
    updateExpPurchasedStyles();
    renderDisciplines();
    applySheetLockState();
    renderExpShopPanel();
}

function cancelExpShopPurchases() {
    if (expShopSnapshot) {
        applyCharacterData(expShopSnapshot, t('отмены покупок'));
    }
    stopExpShopMode();
}

function acceptExpShopPurchases() {
    const cart = getExpShopCart();
    const total = cart.reduce((sum, item) => sum + item.cost, 0);

    if (cart.length === 0) {
        alert(t("В корзине пока нет покупок."));
        return;
    }

    if (total > 0 && !assertEnoughXP(total)) return;

    const freeExp = document.getElementById('free-exp');
    if (freeExp) freeExp.value = Math.max(0, getCurrentXP() - total);

    const lines = cart.map(item => {
        const costText = shouldShowCartCost(item) ? ` (${getCartCostLabel(item.cost)})` : '';
        return `${getTraitKindLabel(item.type)}: ${item.name} ${item.from}→${item.to}${costText}`;
    });
    recordExpHistory(total >= 0 ? t('Покупки приняты') : t('Продажа принята'), -total, lines);

    sheetLockSnapshot = captureSheetSnapshot();
    stopExpShopMode();
}

function setTraitLevel(name, level) {
    const radio = document.querySelector(`input[name="${name}"][value="${level}"]`);
    if (!radio) return false;
    radio.checked = true;
    updateTrackers();
    updateVitals();
    updateExpPurchasedStyles();
    renderExpShopPanel();
    return true;
}

function setupExpShopDotEditing() {
    if (window.__expShopDotEditingReady) return;
    window.__expShopDotEditingReady = true;

    document.addEventListener('click', function(e) {
        if (!expShopMode) return;

        const label = e.target.closest('label.dot-label');
        if (!label) return;

        const input = document.getElementById(label.getAttribute('for'));
        if (!input) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const name = input.name;
        const clickedValue = parseInt(input.value) || 0;
        const current = getCurrentLevel(name);

        let target = clickedValue;
        if (clickedValue === current && current > 0) target = current - 1;

        setTraitLevel(name, target);
    }, true);

    document.addEventListener('click', function(e) {
        if (!expShopMode) return;

        const dot = e.target.closest('.discipline-item .disc-dot');
        if (!dot) return;

        const item = dot.closest('.discipline-item');
        const name = item?.dataset.disciplineName || item?.querySelector('.discipline-title')?.textContent?.trim();
        if (!name) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const clickedValue = parseInt(dot.dataset.level || '0', 10) || 0;
        const current = getDisciplineTotal(name);
        const mode = current > 0 ? getExistingDisciplineModeLabel(name) : expShopDisciplineMode;

        let target = clickedValue;
        if (clickedValue === current && current > 0) target = current - 1;

        setDisciplineTotal(name, target, mode);
    }, true);

    ['input', 'change'].forEach(eventName => {
        document.addEventListener(eventName, function() {
            if (!expShopMode) return;
            setTimeout(() => {
                updateTrackers();
                updateVitals();
                updateExpPurchasedStyles();
                renderSelectedMeritsFlaws();
                renderDisciplines();
                renderExpShopPanel();
            }, 0);
        });
    });
}

// ====================== ФУНКЦИИ ======================

function spendModalAttribute() {
    if (!startingSheetFixed) {
        alert(t("Сначала зафиксируй стартовый лист!"));
        return;
    }

    const typedName = prompt(t("Какую характеристику повышаем?"));
    if (!typedName) return;
    const name = vtmCanonicalName(typedName);

    const current = getCurrentLevel(name);
    const target = parseInt(prompt(tf(`Текущий: {current}\nНовый уровень?`, { current })));
    if (!target || target <= current) return;

    const cost = target * 5;
    if (!assertEnoughXP(cost)) return;
    if (confirm(tf("Повысить {name} → {target} за {cost} XP?", { name: t(name), target, cost }))) {
        runExperiencePurchase(() => {
            setLevel(name, target, true);   // true = за опыт
            logModal(`${t(name)} ${current}→${target}`, cost);
        });
    }
}


function getCurrentXP() {
    return parseInt(document.getElementById('free-exp')?.value || '0') || 0;
}

function hasEnoughXP(cost) {
    return getCurrentXP() >= cost;
}

function assertEnoughXP(cost) {
    if (!hasEnoughXP(cost)) {
        alert(tf("Недостаточно опыта: нужно {cost} XP, доступно {available} XP.", { cost, available: getCurrentXP() }));
        return false;
    }
    return true;
}

function spendModalSkill() {
    if (!startingSheetFixed) return alert(t("Сначала зафиксируй стартовый лист!"));
    const typedName = prompt(t("Какой навык повышаем?"));
    if (!typedName) return;
    const name = vtmCanonicalName(typedName);
    const current = getCurrentLevel(name);
    const target = parseInt(prompt(tf("Текущий: {current}\nНовый уровень?", { current })));
    if (!target || target <= current || target > 5) return;
    const cost = target * 3;
    if (!assertEnoughXP(cost)) return;
    if (confirm(tf("Повысить навык {name} до {target} за {cost} XP?", { name: t(name), target, cost }))) {
        runExperiencePurchase(() => {
            setLevel(name, target, true);
            logModal(tf("Навык {name} {current}→{target}", { name: t(name), current, target }), cost);
        });
    }
}

function spendModalSpecialty() {
    if (!startingSheetFixed) return alert(t("Сначала зафиксируй стартовый лист!"));
    const typedSkill = prompt(t("Для какого навыка добавляем специализацию?"));
    if (!typedSkill) return;
    const skill = vtmCanonicalName(typedSkill);
    const spec = prompt(t("Название специализации?"));
    if (!spec) return;
    const cost = 3;
    if (!assertEnoughXP(cost)) return;
    if (confirm(tf('Добавить специализацию "{spec}" для {skill} за {cost} XP?', { spec, skill: t(skill), cost }))) {
        runExperiencePurchase(() => {
            const container = document.getElementById(`specs-${skill}`);
            if (container) {
                container.style.display = 'flex';
                addSpecLine(skill, tf('{spec} (за опыт)', { spec }));
            }
            logModal(tf('Специализация "{spec}" ({skill})', { spec, skill: t(skill) }), cost);
        });
    }
}

function spendModalMerit() {
    if (!startingSheetFixed) return alert(t("Сначала зафиксируй стартовый лист!"));
    const name = prompt(t("Какое преимущество повышаем/покупаем?"));
    if (!name) return;
    const dots = parseInt(prompt(t("Сколько пунктов добавить?")) || '1');
    if (!dots || dots < 1) return;
    const cost = dots * 3;
    if (!assertEnoughXP(cost)) return;
    if (confirm(tf('Добавить {dots} п. к "{name}" за {cost} XP?', { dots, name, cost }))) {
        runExperiencePurchase(() => {
            logModal(tf('Преимущество "{name}" +{dots}', { name, dots }), cost);
        });
    }
}

function spendModalDiscipline() {
    if (!startingSheetFixed) return alert(t("Сначала зафиксируй стартовый лист!"));
    const name = prompt(t("Название дисциплины?"));
    if (!name) return;
    if (!canUseDiscipline(name) || isThinBloodClan()) return alert(t('Эта дисциплина недоступна текущему клану.'));
    let current = 0;
    if (disciplineSources[name]) current = Object.values(disciplineSources[name]).reduce((a, b) => a + b, 0);
    const target = parseInt(prompt(tf("Текущий: {current}\nНовый уровень?", { current })));
    if (!target || target <= current || target > 5) return;
    const mode = prompt(t('Тип дисциплины: clan / out / caitiff'), 'clan');
    if (!mode) return;
    const normalized = mode.toLowerCase();
    const mult = normalized === 'out' ? 7 : normalized === 'caitiff' ? 6 : 5;
    const cost = target * mult;
    if (!assertEnoughXP(cost)) return;
    if (confirm(tf("Повысить дисциплину {name} до {target} за {cost} XP?", { name, target, cost }))) {
        runExperiencePurchase(() => {
            mergeDiscipline(name, target - current, t('Опыт'));
            logModal(tf("Дисциплина {name} {current}→{target}", { name, current, target }), cost);
        });
    }
}

function spendModalRitual() {
    if (!startingSheetFixed) return alert(t("Сначала зафиксируй стартовый лист!"));
    const ritualType = prompt(t('Что изучаем: ritual / alchemy'), 'ritual');
    if (!ritualType) return;
    const level = parseInt(prompt(t('Уровень ритуала/рецептуры?')));
    if (!level || level < 1 || level > 5) return;
    const cost = level * 3;
    if (!assertEnoughXP(cost)) return;
    const label = ritualType.toLowerCase() === 'alchemy' ? t('Рецептура алхимии') : t('Ритуал Кровавого чародейства');
    if (confirm(tf("{label} ур. {level} за {cost} XP?", { label, level, cost }))) {
        runExperiencePurchase(() => {
            logModal(tf("{label} ур. {level}", { label, level }), cost);
        });
    }
}

function spendModalBloodPotency() {
    if (!startingSheetFixed) return alert(t("Сначала зафиксируй стартовый лист!"));
    const current = parseInt(prompt(t('Текущая Сила Крови?'), '0'));
    if (Number.isNaN(current) || current < 0) return;
    const target = parseInt(prompt(tf("Текущая: {current}\nНовая Сила Крови?", { current })));
    if (!target || target <= current) return;
    const cost = target * 10;
    if (!assertEnoughXP(cost)) return;
    if (confirm(tf("Повысить Силу Крови до {target} за {cost} XP?", { target, cost }))) {
        runExperiencePurchase(() => {
            explicitBloodPotency = clampBloodPotency(target);
            updateBloodPotencyVital();
            autoSaveVitalState();
            logModal(tf("Сила Крови {current}→{target}", { current, target }), cost);
        });
    }
}

// Вспомогательные функции
function getCurrentLevel(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? parseInt(checked.value) : 0;
}

// Установка уровня + окраска ВСЕХ точек, купленных за опыт
function setLevel(name, targetLevel, isFromExp = true) {
    const radios = document.querySelectorAll(`input[name="${name}"]`);

    radios.forEach(radio => {
        const value = parseInt(radio.value);
        radio.checked = (value === targetLevel);
    });

    updateTrackers();
    updateVitals();
    if (isFromExp) updateExpPurchasedStyles();
}



// ==================== ФИКСАЦИЯ СТАРТОВОГО ЛИСТА ====================

function captureCurrentLevels() {
    const levels = {};
    document.querySelectorAll('.dots input.dot-input:checked').forEach(radio => {
        if (radio.name) levels[radio.name] = parseInt(radio.value) || 0;
    });
    return levels;
}

function updateExpPurchasedStyles() {
    document.querySelectorAll('.dot-label.exp-purchased, .dot-label.exp-pending').forEach(label => {
        label.classList.remove('exp-purchased');
        label.classList.remove('exp-pending');
    });

    if (!startingSheetFixed && !Object.keys(baseLevels || {}).length) return;

    document.querySelectorAll('.dots input.dot-input').forEach(input => {
        const value = parseInt(input.value) || 0;
        if (value <= 0) return;

        const current = getCurrentLevel(input.name);
        const base = baseLevels[input.name] ?? 0;
        const shopStart = expShopMode ? (expShopStartLevels[input.name] ?? 0) : current;
        const label = document.querySelector(`label[for="${input.id}"]`);

        if (!label) return;

        if (expShopMode && value > shopStart && value <= current) {
            label.classList.add('exp-pending');
        } else if (value > base && value <= current) {
            label.classList.add('exp-purchased');
        }
    });
}

function captureSheetSnapshot() {
    return {
        name: document.getElementById('char-name')?.value || '',
        clan: document.getElementById('clan-input')?.value || '',
        sire: getInputValue('sire-input'),
        concept: getInputValue('concept-input'),
        nature: getInputValue('nature-input'),
        mask: getInputValue('mask-input'),
        trueAge: getInputValue('true-age-input'),
        apparentAge: getInputValue('apparent-age-input'),
        birthDate: getInputValue('birth-date-input'),
        deathDate: getInputValue('death-date-input'),
        clanBane: getInputValue('clan-bane-input'),
        characterImage: characterImageData || '',
        touchstones: getTouchstonesSnapshot(),
        inventory: normalizeInventory(inventory),
        appearance: getInputValue('appearance-input'),
        backstory: getInputValue('backstory-input'),
        notes: getInputValue('notes-input'),
        predator: document.getElementById('predator-input')?.value || '',
        generation: document.getElementById('generation-input')?.value || '',
        type: document.getElementById('type-input')?.value || '',
        characterType: getCurrentCharacterType(),
        sheetMode: currentCharType,
        hasBeenSaved: characterHasBeenSaved,
        bloodPotency: getCurrentBloodPotencyValue(),
        damageProfile: getSheetDamageProfile(),
        sheetFixed: startingSheetFixed,
        status: {
            physicalState: getHealthTracker().physicalState,
            humanityState: getHumanityState().value <= 0 ? 'lost_to_beast' : null
        },
        healthState: { ...healthState },
        baseHumanity: document.getElementById('base-humanity')?.value || '7',
        humanity: {
            ...getHumanityState(),
            base: parseInt(document.getElementById('base-humanity')?.value || '7', 10) || 7
        },
        morality: getMoralityData(),
        vitalTrackers: getVitalTrackerData(),
        skillPackage: document.getElementById('skill-package')?.value || '',
        levels: captureCurrentLevels(),
        skills: JSON.parse(JSON.stringify(getFullCharacterData().skills || {})),
        disciplines: JSON.parse(JSON.stringify(disciplineSources || {})),
        selectedPowers: JSON.parse(JSON.stringify(selectedPowers || {})),
        merits: JSON.parse(JSON.stringify(selectedMerits || [])),
        flaws: JSON.parse(JSON.stringify(selectedFlaws || [])),
        thinBloodMerits: JSON.parse(JSON.stringify(selectedThinBloodMerits || [])),
        thinBloodFlaws: JSON.parse(JSON.stringify(selectedThinBloodFlaws || []))
    };
}

function applySheetLockState() {
    document.body.classList.toggle('sheet-fixed', startingSheetFixed);
    document.body.classList.toggle('xp-shop-active', expShopMode);
    updateSheetFixedVisibility();

    if (startingSheetFixed) {
        document.querySelector('.guide')?.classList.remove('error');
        const warning = document.getElementById('global-warning');
        if (warning) warning.style.display = 'none';
    }

    const btn = document.getElementById('fix-start-btn');
    if (btn) {
        btn.textContent = startingSheetFixed
            ? t("Расфиксировать лист")
            : isPlayerVampire() ? t("Завершить создание и зафиксировать") : t("Зафиксировать стартовый лист");
        btn.style.background = startingSheetFixed ? "#a14600" : "#ff3131";
        btn.title = startingSheetFixed
            ? t("Снять фиксацию и снова редактировать лист вручную")
            : t("Проверить правила создания и зафиксировать стартовый лист");
    }

    const lockedControls = document.querySelectorAll('#char-type-select, #clan-input, #predator-input, #generation-input, #type-input, #base-humanity, #initial-hunger, #val-blood-potency, .locked-origin-control');
    lockedControls.forEach(control => {
        const isFixedOrigin = startingSheetFixed;
        const isFixedPlayerResource = isPlayerVampire() && ['initial-hunger', 'val-blood-potency'].includes(control.id);
        const shouldDisable = isFixedOrigin || isFixedPlayerResource;
        control.disabled = shouldDisable;
        control.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
    });

    if (startingSheetFixed && !expShopMode) {
        closeMeritsFlawsModal();
        document.getElementById('clan-modal')?.style.setProperty('display', 'none');
        document.getElementById('predator-modal')?.style.setProperty('display', 'none');
        document.getElementById('generation-modal')?.style.setProperty('display', 'none');
        document.getElementById('npc-discipline-modal')?.remove();
    }
    updateCreationRuleControls();
}

function isCharacterSheetFixed() {
    return Boolean(startingSheetFixed);
}

function updateSheetFixedVisibility() {
    updateCreationVsGameVitalsVisibility();
}

function updateCreationVsGameVitalsVisibility() {
    const fixed = isCharacterSheetFixed();

    document
        .querySelectorAll('[data-requires-fixed-sheet="true"]')
        .forEach(element => {
            element.hidden = !fixed;
            element.style.display = fixed ? '' : 'none';
        });

    document
        .querySelectorAll('[data-visible-before-fixed="true"]')
        .forEach(element => {
            element.hidden = fixed;
            element.style.display = fixed ? 'none' : '';
        });

    document
        .querySelectorAll('[data-visible-after-fixed="true"]')
        .forEach(element => {
            element.hidden = !fixed;
            element.style.display = fixed ? '' : 'none';
        });

    updateVitalProfileVisibility();
}

function autoSaveSheetLockState() {
    if (!window.autoSaveCharacterPatch || isApplyingCharacterData) return;
    const data = getFullCharacterData();
    window.autoSaveCharacterPatch({
        sheetFixed: data.sheetFixed,
        sheetLock: data.sheetLock
    }, { silent: true });
}

function autoSaveCurrentCharacterData({ silent = true } = {}) {
    if (!window.autoSaveCharacterPatch || isApplyingCharacterData) return;
    window.autoSaveCharacterPatch(getFullCharacterData(), { silent });
}

function isSheetLockedTarget(target) {
    if (!startingSheetFixed || isApplyingCharacterData || isExperiencePurchaseInProgress) return false;
    if (expShopMode) return false;
    if (!target || target.closest('#exp-modal')) return false;
    if (target.closest('.show-master-btn, .selected-item-show-master, [data-inventory-show-master]')) return false;
    if (target.closest('#touchstones-list, .touchstone-add-btn')) return false;
    const dotLabel = target.closest('.dot-label');
    const dotRow = dotLabel?.closest('.row');
    if ((dotLabel && (dotRow?.querySelector('.attr-name') || dotRow?.querySelector('.skill-name'))) || target.closest('.discipline-item:not(.xp-shop-discipline-option) .disc-dot')) return false;
    if (target.closest('#char-type-select, #clan-input, #predator-input, #generation-input, #type-input, #base-humanity, #initial-hunger, #val-blood-potency, .locked-origin-control, .dot-label, .dot-input, .disc-dot, .s-badge, .add-power-btn, .remove-disc-btn, .merit-add-btn, .selected-item-remove')) return true;
    if (target.closest('.skill-spec-line button, .skill-spec-line input')) return true;
    if (target.closest('.attr-name, .skill-name, .skill-spec-line')) return false;
    const disciplineItem = target.closest('.discipline-item:not(.xp-shop-discipline-option)');
    if (!disciplineItem) return false;
    return !target.closest('button, input, select, textarea');
}

function setupSheetLockGuards() {
    if (window.__sheetLockGuardsReady) return;
    window.__sheetLockGuardsReady = true;

    ['click', 'input', 'change', 'keydown'].forEach(eventName => {
        document.addEventListener(eventName, (e) => {
            if (!isSheetLockedTarget(e.target)) return;
            e.preventDefault();
            e.stopImmediatePropagation();
        
        }, true);
    });
}

function setupCreationRuleGuards() {
    if (window.__creationRuleGuardsReady) return;
    window.__creationRuleGuardsReady = true;

    document.addEventListener('click', event => {
        if (!isStrictPlayerCreation()) return;
        const label = event.target.closest('label.dot-label');
        if (!label) return;
        const input = document.getElementById(label.getAttribute('for'));
        if (!input || !['attr', 'skill'].includes(input.dataset.type)) return;

        const limits = input.dataset.type === 'attr'
            ? ATTR_LIMITS
            : SKILL_PACKAGES[document.getElementById('skill-package')?.value];
        if (!limits) {
            event.preventDefault();
            event.stopImmediatePropagation();
            alert(t('Сначала выбери набор навыков.'));
            return;
        }

        const current = parseInt(document.querySelector(`input[name="${input.name}"]:checked`)?.value || '0', 10) || 0;
        const clicked = parseInt(input.value, 10) || 0;
        const target = clicked === current ? 0 : clicked;
        const projected = getAllocationCounts(input.dataset.type);
        if (current > 0) projected[current] = Math.max(0, projected[current] - 1);
        if (target > 0) projected[target] = (projected[target] || 0) + 1;

        if (target > 0 && projected[target] > (limits[target] || 0)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            alert(tf('В стартовом листе значений {target} может быть только {limit}.', { target, limit: limits[target] || 0 }));
        }
    }, true);

    document.addEventListener('click', event => {
        if (currentCharType !== 'npc-vampire' || expShopMode || startingSheetFixed) return;
        const dot = event.target.closest('.discipline-item:not(.xp-shop-discipline-option) .disc-dot');
        if (!dot) return;
        const item = dot.closest('.discipline-item');
        const name = item?.dataset.disciplineName;
        if (!name) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const current = getDisciplineTotal(name);
        const clicked = parseInt(dot.dataset.level || '0', 10) || 0;
        setDisciplineTotal(name, clicked === current ? Math.max(0, current - 1) : clicked, 'НПС');
    }, true);
}

function runExperiencePurchase(callback) {
    isExperiencePurchaseInProgress = true;
    try {
        callback();
        sheetLockSnapshot = captureSheetSnapshot();
    } finally {
        isExperiencePurchaseInProgress = false;
        applySheetLockState();
    }
}

function captureStartingSheetBase({ force = false } = {}) {
    const hasExistingStartBase = startingSheetBase && Object.keys(startingSheetBase.levels || {}).length > 0;

    if (force || !hasExistingStartBase) {
        baseLevels = captureCurrentLevels();
        sheetLockSnapshot = captureSheetSnapshot();
        startingSheetBase = JSON.parse(JSON.stringify(sheetLockSnapshot));
        return;
    }

    if (!Object.keys(baseLevels || {}).length) {
        baseLevels = captureCurrentLevels();
    }
    sheetLockSnapshot = captureSheetSnapshot();
}

function fixStartingSheet({ silent = false } = {}) {
    if (silent && !startingSheetFixed) {
        if (!validatePlayerCreation({ silent: true })) return false;
        if (!validateThinBloodBalance({ silent: true })) return false;
        captureStartingSheetBase({ force: sheetUnlockedForEditing });
        startingSheetFixed = true;
        sheetUnlockedForEditing = false;
        applySheetLockState();
        autoSaveSheetLockState();
        autoSaveCurrentCharacterData({ silent: true });
        autoSaveVitalState({ immediate: true });
        updateExpPurchasedStyles();
        return true;
    }
    if (startingSheetFixed) {
        if (confirm(t("Расфиксировать лист?\nПосле этого поля снова можно будет менять вручную."))) {
            startingSheetFixed = false;
            sheetUnlockedForEditing = true;
            expShopMode = false;
            expShopSnapshot = null;
            expShopStartLevels = {};
            applySheetLockState();
            autoSaveSheetLockState();
            autoSaveCurrentCharacterData({ silent: true });
            alert(t("Лист расфиксирован. Ручное редактирование снова доступно."));
        }
        return;
    }

    if (!validatePlayerCreation()) return;
    if (!validateThinBloodBalance()) return;

    if (!confirm(t("Завершить создание и зафиксировать стартовый лист?\nПосле этого значения меняются только через магазин опыта."))) {
        return;
    }

    captureStartingSheetBase({ force: sheetUnlockedForEditing });
    startingSheetFixed = true;
    sheetUnlockedForEditing = false;
    applySheetLockState();
    autoSaveSheetLockState();
    autoSaveCurrentCharacterData({ silent: true });
    autoSaveVitalState({ immediate: true });
    updateExpPurchasedStyles();

    alert(t("Создание завершено. Теперь изменения характеристик проходят через магазин опыта."));
}

window.validatePlayerCreation = validatePlayerCreation;
window.getPlayerCreationIssues = getPlayerCreationIssues;
window.updateCreationRuleControls = updateCreationRuleControls;
