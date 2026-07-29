/* ====================================================================
   МАСТЕР ПОШАГОВОГО СОЗДАНИЯ ПЕРСОНАЖА (Vampire: the Masquerade V5)
   Весь UI живёт в этом оверлее. Источник истины — те же поля листа
   персонажа, поэтому «Перейти к листу» просто прячет оверлей.
   ==================================================================== */
(function () {
    'use strict';

    const STEP_ORDER = [
        'warning', 'identity', 'clanFilter', 'clan', 'predator', 'generation',
        'humanity', 'touchstones', 'backstory', 'appearance', 'notes',
        'attributes', 'disciplines', 'meritsFlaws', 'inventory', 'summary'
    ];
    const OPTIONAL_STEPS = new Set(['touchstones', 'backstory', 'appearance', 'notes', 'inventory']);

    let wizard = null;          // creationWizard data object
    let pendingType = null;     // chosen character type before wizard
    let activeStep = null;
    const DRAFT_KEY = 'vtm-character-creation-draft-v2';

    // ---------- утилиты ----------
    function el(id) { return document.getElementById(id); }
    function val(id) { return (el(id)?.value || '').trim(); }
    function setVal(id, v) { if (el(id)) el(id).value = v == null ? '' : v; }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function isNewMode() {
        return new URLSearchParams(window.location.search).get('new') === '1';
    }
    function rules() { return window.VTM_RULES || (typeof RULES !== 'undefined' ? RULES : {}); }
    function sheetData() {
        try {
            return typeof window.getFullCharacterData === 'function'
                ? window.getFullCharacterData()
                : {};
        } catch (error) {
            console.warn('Не удалось прочитать данные листа для мастера:', error);
            return {};
        }
    }
    function clone(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }
    function readDraft() {
        if (!isNewMode()) return null;
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('Не удалось прочитать черновик мастера:', error);
            return null;
        }
    }
    function writeDraft(extra) {
        if (!isNewMode() || !wizard) return;
        try {
            const character = Object.assign({}, sheetData(), extra || {}, {
                creationWizard: clone(wizard),
                characterRole: window.__characterRole || (isNpcSheet() ? 'npc' : 'player'),
                sheetFixed: document.body.classList.contains('sheet-fixed')
            });
            localStorage.setItem(DRAFT_KEY, JSON.stringify({
                wizard: clone(wizard),
                character
            }));
        } catch (error) {
            console.warn('Не удалось сохранить локальный черновик мастера:', error);
        }
    }
    function isNpcSheet() {
        return /char-type-npc-/.test(document.body.className);
    }

    const VAMPIRE_SPECIALTY_LIMIT = 5;
    const MIN_FILLED_SPECIALTIES = 1;
    const THIN_BLOOD_GENERATIONS = [14, 15, 16];

    function clanValue() { return val('clan-input'); }
    function isThinBloodClan() {
        const thin = typeof vtmName === 'function' ? vtmName('Слабокровные') : 'Слабокровные';
        return clanValue() === thin;
    }
    function isCaitiffClan() {
        const caitiff = typeof vtmName === 'function' ? vtmName('Каитиф') : 'Каитиф';
        return clanValue() === caitiff;
    }
    function parseGenerationValue() {
        const raw = val('generation-input');
        const gen = parseInt(raw, 10);
        return Number.isFinite(gen) ? gen : null;
    }
    function generationValid() {
        const gen = parseGenerationValue();
        const type = val('type-input');
        if (!gen || !type) return false;
        if (isThinBloodClan()) return THIN_BLOOD_GENERATIONS.includes(gen);
        return gen < 14;
    }

    function defaultWizard() {
        return {
            mode: null,
            currentStep: 'warning',
            completedSteps: [],
            skippedSteps: [],
            clanFilter: 'v5',
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            finishedAt: null
        };
    }

    function persist(extra) {
        if (!wizard) return;
        wizard.updatedAt = new Date().toISOString();
        window.__creationWizardData = clone(wizard);
        writeDraft(extra);
        if (window.autoSaveCharacterPatch) {
            window.autoSaveCharacterPatch(Object.assign({
                creationWizard: clone(wizard),
                characterRole: window.__characterRole || (isNpcSheet() ? 'npc' : 'player')
            }, extra || {}), { silent: true });
        }
    }

    function markCompleted(step) {
        if (!wizard) return;
        if (!wizard.completedSteps.includes(step)) wizard.completedSteps.push(step);
        wizard.skippedSteps = wizard.skippedSteps.filter(s => s !== step);
    }
    function markSkipped(step) {
        if (!wizard) return;
        if (!wizard.skippedSteps.includes(step)) wizard.skippedSteps.push(step);
        wizard.completedSteps = wizard.completedSteps.filter(s => s !== step);
    }

    // ---------- overlay show/hide ----------
    function openOverlay() {
        document.body.classList.add('cw-active');
        const overlay = getOverlay();
        overlay.classList.add('cw-open');
        overlay.style.display = 'block';
        const btn = el('cw-return-btn');
        if (btn) btn.style.display = 'none';
    }
    function hideOverlay() {
        document.body.classList.remove('cw-active');
        const overlay = el('cw-overlay');
        if (overlay) { overlay.classList.remove('cw-open'); overlay.style.display = 'none'; }
    }

    function updateReturnButton() {
        const btn = el('cw-return-btn');
        if (!btn) return;
        const overlayOpen = el('cw-overlay').classList.contains('cw-open');
        const sheetFixed = document.body.classList.contains('sheet-fixed');
        const isNpc = /char-type-npc-/.test(document.body.className);
        // Кнопка возврата к мастеру: лист не зафиксирован, не НПС, оверлей скрыт
        const show = !overlayOpen && !sheetFixed && !isNpc &&
            (isNewMode() || (wizard && wizard.mode));
        btn.style.display = show ? 'block' : 'none';
    }

    // ---------- переход к листу ----------
    function goToSheet() {
        persist();
        hideOverlay();
        updateReturnButton();
    }
    window.creationGoToSheet = goToSheet;

    window.returnToCreationWizard = function () {
        if (!wizard) {
            wizard = defaultWizard();
            wizard.mode = 'guided';
        }
        const step = wizard.currentStep && STEP_ORDER.includes(wizard.currentStep)
            ? wizard.currentStep : 'warning';
        openOverlay();
        renderStep(step);
        persist();
    };

    // ---------- навигация ----------
    function goStep(step) {
        if (!STEP_ORDER.includes(step)) return;
        renderStep(step);
        persist();
    }
    function nextStep() {
        const idx = STEP_ORDER.indexOf(activeStep);
        if (idx < STEP_ORDER.length - 1) goStep(STEP_ORDER[idx + 1]);
    }
    function prevStep() {
        const idx = STEP_ORDER.indexOf(activeStep);
        if (idx > 0) goStep(STEP_ORDER[idx - 1]);
    }

    // ---------- progress bar ----------
    function wizardStepLabel(step) {
        const labels = {
            warning: t('Старт'),
            identity: t('Имя'),
            clanFilter: t('Фильтр'),
            clan: t('Клан'),
            predator: t('Охота'),
            generation: t('Поколение'),
            humanity: t('Человечность'),
            touchstones: t('Опоры'),
            backstory: t('История'),
            appearance: t('Вид'),
            notes: t('Заметки'),
            attributes: t('Навыки'),
            disciplines: t('Дисциплины'),
            meritsFlaws: t('Плюсы/минусы'),
            inventory: t('Инвентарь'),
            summary: t('Итог')
        };
        return labels[step] || step;
    }

    function progressHtml() {
        const idx = STEP_ORDER.indexOf(activeStep);
        const stepIssues = typeof getWizardIssuesByStep === 'function' ? getWizardIssuesByStep() : {};
        return `<div class="cw-progress" role="navigation" aria-label="${esc(t('Шаги мастера'))}">`
            + STEP_ORDER.map((s, i) => {
                const cls = [];
                if (i === idx) cls.push('current');
                else if (wizard.completedSteps.includes(s) || i < idx) cls.push('done');
                if (stepIssues[s]) cls.push('error');
                const label = wizardStepLabel(s);
                return `<button type="button" class="${cls.join(' ')}" data-cw-progress-step="${s}" title="${esc(label)}" aria-label="${esc(tf('Шаг {n}: {label}', { n: i + 1, label }))}"></button>`;
            }).join('')
            + '</div>';
    }

    function bindProgressNav(root) {
        root.querySelectorAll('[data-cw-progress-step]').forEach(btn => {
            btn.addEventListener('click', () => goStep(btn.getAttribute('data-cw-progress-step')));
        });
    }

    function shell(stepKey, title, sub, body, nav) {
        const idx = STEP_ORDER.indexOf(stepKey);
        return progressHtml()
            + `<div class="cw-step-meta">${tf('Шаг {idx} из {total}', { idx: idx + 1, total: STEP_ORDER.length })}</div>`
            + `<h1>${esc(title)}</h1>`
            + (sub ? `<h2 class="cw-sub">${esc(sub)}</h2>` : '')
            + '<div class="cw-error" id="cw-step-error" style="display:none"></div>'
            + body
            + `<div class="cw-nav">${nav}</div>`;
    }

    function showStepError(message) {
        const error = el('cw-step-error');
        if (!error) return;
        error.textContent = message;
        error.style.display = 'block';
        error.scrollIntoView({ block: 'nearest' });
    }

    function navBtn(label, handler, cls) {
        const placement = ['next', 'start', 'finish', 'skip', 'skipOptionalIdentity', 'toSheet'].includes(handler)
            ? 'cw-nav-forward'
            : handler === 'prev'
                ? 'cw-nav-left'
                : '';
        return `<button type="button" class="cw-btn ${placement} ${cls || ''}" data-cw="${handler}">${esc(label)}</button>`;
    }
    const toSheetBtn = navBtn(t('Перейти к листу персонажа'), 'toSheet', 'to-sheet');

    function bindNav(root) {
        root.querySelectorAll('[data-cw]').forEach(b => {
            b.addEventListener('click', () => handleNav(b.getAttribute('data-cw')));
        });
    }

    function handleNav(action) {
        switch (action) {
            case 'toSheet': markCurrentProgress(); goToSheet(); break;
            case 'next': if (validateAndAdvance()) {} break;
            case 'prev': prevStep(); break;
            case 'skip': markSkipped(activeStep); nextStep(); break;
            case 'start': markCompleted('warning'); nextStep(); break;
            case 'finish': finishSheet(); break;
            default:
                if (typeof STEP_ACTIONS[action] === 'function') STEP_ACTIONS[action]();
        }
    }

    function markCurrentProgress() {
        // лёгкая отметка прогресса при уходе на лист
        if (activeStep && !OPTIONAL_STEPS.has(activeStep)) {
            // не помечаем обязательные как выполненные принудительно
        }
    }

    const STEP_ACTIONS = {};

    function dispatchSheetChange(id) {
        const node = el(id);
        if (!node) return;
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function setSheetValue(id, value) {
        const node = el(id);
        if (!node) return;
        node.value = value == null ? '' : value;
        dispatchSheetChange(id);
    }

    function openSheetPicker(fnName, fallbackMessage, args = []) {
        const fn = window[fnName];
        if (typeof fn === 'function') {
            fn.apply(window, args);
            return true;
        }
        showStepError(fallbackMessage || t('Это окно пока недоступно.'));
        return false;
    }

    function refreshCurrentStepAfterSheetChoice(type) {
        if (!wizard || !activeStep) return;
        const stepByType = {
            clan: 'clan',
            clanDisciplines: 'disciplines',
            predator: 'predator',
            predatorSpecialty: 'predator',
            predatorDiscipline: 'disciplines',
            predatorTraits: 'predator',
            generation: 'generation'
        };
        const touchedStep = stepByType[type];
        if (touchedStep) markCompleted(touchedStep);
        persist();

        if (activeStep === touchedStep || activeStep === 'disciplines') {
            renderStep(activeStep);
        } else if (activeStep === 'attributes') {
            renderAttrStatus();
        } else if (activeStep === 'meritsFlaws') {
            renderMfStatus();
        }
    }

    document.addEventListener('vtm:sheet-choice', (event) => {
        refreshCurrentStepAfterSheetChoice(event.detail?.type);
    });

    // ---------- рендер шага ----------
    function renderStep(step) {
        activeStep = step;
        wizard.currentStep = step;
        const overlay = getOverlay();
        if (!el('cw-card')) {
            overlay.innerHTML = '<div class="cw-card" id="cw-card"></div>';
        }
        const card = el('cw-card');
        const section = getWizardSection(step);
        if (!section) return;
        card.innerHTML = section.render();
        card.scrollTop = 0;
        overlay.scrollTop = 0;
        bindNav(card);
        bindProgressNav(card);
        section.afterRender();
    }

    const AFTER_RENDER = {};
    const RENDERERS = {};
    const WIZARD_SECTIONS = {};

    class CreationWizardSection {
        constructor(key, renderFn, afterRenderFn) {
            this.key = key;
            this.renderFn = renderFn;
            this.afterRenderFn = afterRenderFn || null;
        }

        render() {
            return this.renderFn();
        }

        afterRender() {
            if (typeof this.afterRenderFn === 'function') this.afterRenderFn();
        }
    }

    function registerWizardSection(section) {
        WIZARD_SECTIONS[section.key] = section;
        RENDERERS[section.key] = () => section.render();
        AFTER_RENDER[section.key] = () => section.afterRender();
        return section;
    }

    function getWizardSection(step) {
        if (WIZARD_SECTIONS[step]) return WIZARD_SECTIONS[step];
        const renderer = RENDERERS[step];
        if (typeof renderer !== 'function') return null;
        const section = new CreationWizardSection(step, renderer, AFTER_RENDER[step]);
        WIZARD_SECTIONS[step] = section;
        return section;
    }

    /* ================= ШАГ 1: ПРЕДУПРЕЖДЕНИЕ ================= */
    RENDERERS.warning = () => shell('warning', t('Лёгкое создание персонажа'), '',
        `<div class="cw-intro">${t('Сейчас система проведёт тебя по основным шагам создания персонажа.\n        Всё, что ты выберешь здесь, можно будет изменить после окончания опросника в полном листе.')}</div>`,
        navBtn(t('Начать'), 'start', 'primary') + toSheetBtn);

    /* ================= ШАГ 2: СОЦИАЛКА + АВАТАР ================= */
    class IdentityWizardSection extends CreationWizardSection {
        constructor() {
            super('identity', () => this.renderIdentity(), () => this.afterIdentityRender());
        }

        renderIdentity() {
            const data = sheetData();
            const portraitValue = data.characterImage || data.image || data.portrait || '';
            const portrait = portraitValue
                ? `<img class="cw-portrait-preview" src="${esc(portraitValue)}" alt="${esc(t('Портрет'))}">`
                : `<div class="cw-portrait-placeholder">${t('Портрет персонажа')}</div>`;

            return shell('identity', t('Кто этот персонаж?'), '',
                `<div class="cw-error" id="cw-identity-error" style="display:none"></div>
                 <div class="cw-portrait-row">
                    ${portrait}
                    <div style="flex:1">
                        <p style="color:#888;font-size:13px;margin:0 0 10px;line-height:1.5;">${t('Изображение персонажа (необязательно)')}</p>
                        <button type="button" class="cw-btn" id="cw-portrait-upload">${t('Загрузить изображение')}</button>
                        ${portraitValue ? `<button type="button" class="cw-btn ghost" id="cw-portrait-remove" style="margin-left:8px">${t('Удалить')}</button>` : ''}
                    </div>
                 </div>
                 <div class="cw-fields">
                    ${this.field('char-name', 'Имя', { required: true })}
                    ${this.field('sire-input', 'Сир', { labelKey: 'Сир ⓘ', hintKey: 'Сир — вампир, который обратил вашего персонажа. Он является вашим создателем, наставником и, нередко, цепью, которая удерживает вас в обществе Сородичей. Отношения с сиром могут быть всем — от любви до ненависти, от слепой покорности до кровной вражды.' })}
                    ${this.field('concept-input', 'Концепция', { labelKey: 'Концепция ⓘ', hintKey: 'Концепция — краткое описание личности персонажа в нескольких словах или одном предложении. Это не архетип и не роль, а скорее суть того, кем персонаж себя считает. Примеры: «потерявшийся идеалист», «хищник в человеческой шкуре», «страж Маскарада».' })}
                    ${this.field('nature-input', 'Натура', { labelKey: 'Натура ⓘ', hintKey: 'Натура — истинная личность персонажа, его глубинная суть. Её опасно показывать окружающим, но именно она определяет, что персонаж представляет собой на самом деле. Действуя согласно натуре, персонаж восстанавливает пункт воли.', archetype: true })}
                    ${this.field('mask-input', 'Маска', { labelKey: 'Маска ⓘ', hintKey: 'Маска — фальшивое лицо, которое персонаж показывает окружающему миру. Маска позволяет взаимодействовать с обществом так, как это выгодно персонажу, скрывая его истинную суть. У персонажа может быть несколько масок для разных ситуаций.', archetype: true })}
                    ${this.field('true-age-input', 'Истинный возраст')}
                    ${this.field('apparent-age-input', 'Видимый возраст')}
                    ${this.field('birth-date-input', 'Дата рождения')}
                    ${this.field('death-date-input', 'Дата смерти')}
                 </div>`,
                navBtn(t('Назад'), 'prev') + navBtn(t('Дальше'), 'next', 'primary')
                + navBtn(t('Пропустить необязательное'), 'skipOptionalIdentity')
                + toSheetBtn);
        }

        field(id, label, options = {}) {
            const labelKey = options.labelKey || label;
            const tooltip = options.hintKey ? ` data-tooltip="${esc(t(options.hintKey))}" data-i18n-tooltip="${esc(options.hintKey)}"` : '';
            const required = options.required === true;
            return `<div class="cw-field ${required ? 'required' : ''}">
                <div class="cw-label-row">
                    <label for="cw-${id}"${tooltip}>${esc(t(labelKey))}${required ? '' : tf(' ({optional})', { optional: t('необязательно') })}</label>
                    ${options.archetype ? this.archetypeButton(id, label) : ''}
                </div>
                <input type="text" id="cw-${id}" data-mirror="${id}" value="${esc(val(id))}">
            </div>`;
        }

        archetypeButton(id, label) {
            const aria = `${t('Список архетипов')}: ${t(label)}`;
            return `<button type="button" class="archetype-hint-btn cw-archetype-hint-btn" data-archetype-field="${id}" data-i18n-title="Список архетипов" title="${esc(t('Список архетипов'))}" aria-label="${esc(aria)}">?</button>`;
        }

        afterIdentityRender() {
            el('cw-card').querySelectorAll('[data-mirror]').forEach(inp => {
                inp.addEventListener('input', () => {
                    setVal(inp.getAttribute('data-mirror'), inp.value);
                });
            });
            el('cw-card').querySelectorAll('[data-archetype-field]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const fieldId = btn.getAttribute('data-archetype-field');
                    openSheetPicker('openArchetypeModal', t('Галерея натуры и маски пока недоступна.'), [fieldId]);
                });
            });
            ['nature-input', 'mask-input'].forEach(fieldId => {
                const source = el(fieldId);
                const mirror = el('cw-' + fieldId);
                if (!source || !mirror || source.__cwArchetypeBound) return;
                source.__cwArchetypeBound = true;
                const sync = () => {
                    const current = el('cw-' + fieldId);
                    if (current) current.value = source.value || '';
                };
                source.addEventListener('input', sync);
                source.addEventListener('change', sync);
            });
            const up = el('cw-portrait-upload');
            if (up) up.addEventListener('click', () => el('character-image-input')?.click());
            const rm = el('cw-portrait-remove');
            if (rm) rm.addEventListener('click', () => {
                if (typeof window.deleteCharacterImage === 'function') window.deleteCharacterImage();
                renderStep('identity');
            });
            // когда листовой uploader загрузит картинку — перерисуем шаг
            const fileInp = el('character-image-input');
            if (fileInp && !fileInp.__cwBound) {
                fileInp.__cwBound = true;
                fileInp.addEventListener('change', () => {
                    setTimeout(() => { if (activeStep === 'identity') renderStep('identity'); }, 400);
                });
            }
        }
    }
    registerWizardSection(new IdentityWizardSection());
    STEP_ACTIONS.skipOptionalIdentity = () => {
        if (!val('char-name')) { showIdentityError(); return; }
        markCompleted('identity'); nextStep();
    };
    function showIdentityError() {
        const e = el('cw-identity-error');
        if (e) { e.textContent = t('Имя обязательно для заполнения.'); e.style.display = 'block'; }
    }

    /* ================= ШАГ 3: ФИЛЬТР КЛАНОВ ================= */
    RENDERERS.clanFilter = () => shell('clanFilter', t('Какие кланы показывать?'), '',
        `<div class="cw-choice-grid">
            ${choiceBtn(t('Кланы только V5 (для новичков)'), 'filterV5', wizard.clanFilter === 'v5')}
            ${choiceBtn(t('Кланы V5 и V20'), 'filterV5V20', wizard.clanFilter === 'v5_v20')}
            ${choiceBtn(t('Все кланы'), 'filterAll', wizard.clanFilter === 'all')}
        </div>`,
        navBtn(t('Назад'), 'prev') + navBtn(t('Дальше'), 'next', 'primary') + toSheetBtn);
    function choiceBtn(label, action, sel, sub) {
        return `<button type="button" class="cw-choice-btn ${sel ? 'selected' : ''}" data-cw="${action}" style="${sel ? 'border-color:#ff3131;background:#2a1111' : ''}">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
    }
    STEP_ACTIONS.filterV5 = () => { wizard.clanFilter = 'v5'; markCompleted('clanFilter'); nextStep(); };
    STEP_ACTIONS.filterV5V20 = () => { wizard.clanFilter = 'v5_v20'; markCompleted('clanFilter'); nextStep(); };
    STEP_ACTIONS.filterAll = () => { wizard.clanFilter = 'all'; markCompleted('clanFilter'); nextStep(); };

    /* ================= ШАГ 4: ГАЛЕРЕЯ КЛАНОВ ================= */
    // name comes from iterating RULES.clans, so it's a Russian or English display name
    // depending on which rules file is loaded; both spellings are listed here.
    const CLAN_V5_NAMES = new Set([
        'Бруха', 'Вентру', 'Гангрел', 'Малкавиан', 'Носферату',
        'Тореадор', 'Тремер', 'Каитиф', 'Слабокровные',
        'Brujah', 'Ventrue', 'Gangrel', 'Malkavian', 'Nosferatu',
        'Toreador', 'Tremere', 'Caitiff', 'Thin-blood'
    ]);
    const CLAN_V20_NAMES = new Set([
        'Ассамиты', 'Джованни', 'Ласомбра', 'Последователи Сета', 'Равнос', 'Цимисхи',
        'Assamite', 'Giovanni', 'Lasombra', 'Followers of Set', 'Ravnos', 'Tzimisce'
    ]);
    function clanSection(name) {
        if (CLAN_V5_NAMES.has(name)) return 'v5';
        if (CLAN_V20_NAMES.has(name)) return 'v20';
        return 'legacy';
    }
    function editionAllowed(name) {
        const section = clanSection(name);
        if (wizard.clanFilter === 'all') return true;
        if (wizard.clanFilter === 'v5_v20') return section === 'v5' || section === 'v20';
        return section === 'v5';
    }
    function clanCardData() {
        const clans = rules().clans || {};
        return Object.entries(clans)
            .filter(([name]) => editionAllowed(name))
            .map(([name, d]) => ({ name, d }));
    }
    const CLAN_IMAGE_OVERRIDES = {
        'Вентру': '/vampires/static/clan_gallery/ventrue_full.png',
        'Каитиф': '/vampires/static/clan_gallery/caitiff_full.png'
    };
    const CLAN_EDITION_LABELS = {
        v5: t('5 версия'),
        v20: t('20 версия'),
        legacy: t('Линии крови')
    };
    function clanImage(name, data) {
        return CLAN_IMAGE_OVERRIDES[name] || data.gallery_image || '';
    }
    function galleryImage(src, alt) {
        if (!src) return `<span class="cw-tile-media cw-tile-media-empty">${t('Изображение не найдено')}</span>`;
        return `<span class="cw-tile-media"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"></span>`;
    }
    RENDERERS.clan = () => {
        const cur = getCurrentClanValue();
        const d = cur ? (rules().clans || {})[cur] : null;
        const desc = (d?.description || '').split(/\n+/).find(Boolean) || '';
        const disc = (d?.disciplines || []).join(', ');
        const clanHint = isThinBloodClan()
            ? `<div class="cw-hint cw-issue-badge">${t('Слабокровные: только 14–16 поколение, особые дисциплины и баланс преимуществ.')}</div>`
            : isCaitiffClan()
                ? `<div class="cw-hint">${t('Каитиф: выбери любые две дисциплины из общего списка (2 + 1), без клановых ограничений.')}</div>`
                : '';
        return shell('clan', t('Выбери клан'), cur ? tf('Выбран: {cur}', { cur }) : '',
            clanHint + `<div class="cw-picker-panel">
                <div class="cw-picker-current">
                    <span class="cw-picker-kicker">${t('Клан')}</span>
                    <strong>${esc(cur || t('Не выбран'))}</strong>
                    ${desc ? `<p>${esc(desc.length > 240 ? desc.slice(0, 237) + '…' : desc)}</p>` : `<p>${t('Открой большую галерею: там есть изображения, правила, теги и умный поиск.')}</p>`}
                    ${disc && !isCaitiffClan() ? `<small>${t('Дисциплины:')} ${esc(disc)}</small>` : ''}
                    ${isCaitiffClan() ? `<small>${t('Дисциплины: любые две из списка V5 (шаг «Дисциплины»).')}</small>` : ''}
                </div>
                <button type="button" class="cw-btn primary" data-cw="openClanGalleryLarge">${t('Открыть галерею кланов')}</button>
            </div>`,
            navBtn(t('Назад'), 'prev') + navBtn(t('Дальше'), 'next', 'primary') + toSheetBtn);
    };
    function getCurrentClanValue() { return val('clan-input'); }
    STEP_ACTIONS.pickClan = function () {}; // заменяется делегированием
    STEP_ACTIONS.openClanGalleryLarge = () => {
        openSheetPicker('openClanGallery', t('Галерея кланов пока недоступна.'), [{ editionFilter: wizard.clanFilter || 'v5' }]);
    };
    AFTER_RENDER.clan = () => {};

    /* ================= ШАГ 5: ГАЛЕРЕЯ ТИПОВ ОХОТЫ ================= */
    RENDERERS.predator = () => {
        const cur = val('predator-input');
        const d = cur ? (rules().predator_types || {})[cur] : null;
        const desc = (d?.description || '').split(/\n+/).find(Boolean) || '';
        const disc = d?.disciplines?.increase ? (d.disciplines.increase.options || []).join(' / ') : '';
        const hum = typeof d?.humanity === 'number' && d.humanity !== 0
            ? (d.humanity > 0 ? '+' + d.humanity : '' + d.humanity) : '0';
        const bp = d?.blood_potency ? '+' + d.blood_potency : '0';
        return shell('predator', t('Выбери тип охоты'), cur ? tf('Выбран: {cur}', { cur }) : '',
            `<div class="cw-picker-panel">
                <div class="cw-picker-current">
                    <span class="cw-picker-kicker">${t('Тип охоты')}</span>
                    <strong>${esc(cur || t('Не выбран'))}</strong>
                    ${desc ? `<p>${esc(desc.length > 240 ? desc.slice(0, 237) + '…' : desc)}</p>` : `<p>${t('Большое окно сразу покажет описание и после выбора откроет дисциплину, специализацию и бонусы охоты.')}</p>`}
                    ${cur ? `<small>${t('Дисциплина:')} ${esc(disc || '—')} · ${t('Сила крови:')} ${esc(bp)} · ${t('Человечность:')} ${esc(hum)}</small>` : ''}
                </div>
                <button type="button" class="cw-btn primary" data-cw="openPredatorGalleryLarge">${t('Открыть галерею типов охоты')}</button>
            </div>`,
            navBtn(t('Назад'), 'prev') + navBtn(t('Дальше'), 'next', 'primary') + toSheetBtn);
    };
    STEP_ACTIONS.openPredatorGalleryLarge = () => {
        openSheetPicker('openPredatorGallery', t('Галерея типов охоты пока недоступна.'));
    };
    AFTER_RENDER.predator = () => {};

    /* ================= ШАГ 6: ГАЛЕРЕЯ ПОКОЛЕНИЙ ================= */
    const GEN_INFO = [
        { gen: 16, bp: 0, note: t('Слабокровный птенец. Сила крови 0.') },
        { gen: 15, bp: 0, note: t('Слабокровный птенец. Сила крови 0.') },
        { gen: 14, bp: 0, note: t('Слабокровный птенец. Сила крови 0.') },
        { gen: 13, bp: 1, note: t('Птенец/Неонат. Стандартный старт для игрока.') },
        { gen: 12, bp: 1, note: t('Птенец/Неонат. Сила крови 1.') },
        { gen: 11, bp: 1, note: t('Анцилла. Сила крови 1.') },
        { gen: 10, bp: 2, note: t('Анцилла. Сила крови 2.') }
    ];
    const GENERATION_GALLERY_GROUPS = [
        {
            key: 'ancilla',
            title: t('Анциллы'),
            subtitle: t('Старшая кровь'),
            image: '/vampires/static/generation_gallery/ancilla.png',
            accent: '#c9a84c',
            generations: [10, 11]
        },
        {
            key: 'neonate',
            title: t('Неонаты'),
            subtitle: t('Молодая кровь'),
            image: '/vampires/static/generation_gallery/neonate.png',
            accent: '#cc3333',
            generations: [12, 13]
        },
        {
            key: 'childe',
            title: t('Птенцы'),
            subtitle: t('Первые ночи'),
            image: '/vampires/static/generation_gallery/childe.png',
            accent: '#7a7aaa',
            generations: [14, 15, 16]
        }
    ];
    function generationOptionDisabled(gen) {
        const select = el('generation-input');
        if (!select) return false;
        const option = Array.from(select.options || []).find(item => item.value === String(gen));
        return Boolean(option && option.disabled);
    }
    RENDERERS.generation = () => {
        const cur = val('generation-input');
        const info = GEN_INFO.find(item => String(item.gen) === String(cur));
        const typeText = val('type-input') || '';
        const thinBlood = isThinBloodClan();
        const genNum = parseGenerationValue();
        const genInvalid = thinBlood
            ? (genNum != null && !THIN_BLOOD_GENERATIONS.includes(genNum))
            : (genNum != null && genNum >= 14);
        const thinHint = thinBlood
            ? `<div class="cw-hint cw-issue-badge">${t('Слабокровным доступны только 14–16 поколения.')}</div>`
            : '';
        const genWarning = genInvalid
            ? `<div class="cw-error" style="display:block;margin-bottom:12px">${thinBlood
                ? t('Выбранное поколение недоступно слабокровному — выбери 14, 15 или 16.')
                : t('14–16 поколение доступно только слабокровным.')}</div>`
            : '';
        return shell('generation', t('Выбери поколение'), cur ? tf('Выбрано: {cur}-е', { cur }) : '',
            thinHint + genWarning + `<div class="cw-picker-panel">
                <div class="cw-picker-current">
                    <span class="cw-picker-kicker">${t('Поколение')}</span>
                    <strong>${esc(cur ? tf('{cur}-е', { cur }) : t('Не выбрано'))}</strong>
                    <p>${esc(info?.note || (thinBlood
                        ? t('Для слабокровного открой галерею и выбери птенца 14–16 поколения.')
                        : t('Открой большое окно, чтобы выбрать поколение и тип персонажа по стартовой группе.')))}</p>
                    ${cur ? `<small>${tf('Сила крови {bp}', { bp: info?.bp ?? (val('val-blood-potency') || 0) })}${typeText ? ` · ${esc(typeText)}` : ''}</small>` : ''}
                </div>
                <button type="button" class="cw-btn primary" data-cw="openGenerationGalleryLarge">${t('Открыть галерею поколений')}</button>
            </div>`,
            navBtn(t('Назад'), 'prev') + navBtn(t('Дальше'), 'next', 'primary') + toSheetBtn);
    };
    STEP_ACTIONS.openGenerationGalleryLarge = () => {
        openSheetPicker('openGenerationGallery', t('Галерея поколений пока недоступна.'));
    };
    AFTER_RENDER.generation = () => {};

    /* ================= ШАГ 7: НАЧАЛЬНАЯ ЧЕЛОВЕЧНОСТЬ ================= */
    function predatorHumanityMod() {
        const p = val('predator-input');
        const pd = (rules().predator_types || {})[p];
        return pd && typeof pd.humanity === 'number' ? pd.humanity : 0;
    }
    RENDERERS.humanity = () => {
        const cur = parseInt(val('base-humanity') || '7', 10);
        const mod = predatorHumanityMod();
        const hint = mod
            ? `<div class="cw-hint">${tf('Тип охоты «{pred}» изменяет Человечность на {mod}. Итоговое значение будет пересчитано на листе.', { pred: val('predator-input'), mod: mod > 0 ? '+' + mod : mod })}</div>`
            : '';
        return shell('humanity', t('Начальная Человечность'), '',
            hint + `<div class="cw-choice-grid" style="grid-template-columns:1fr 1fr;max-width:360px">
                ${choiceBtn('7', 'humanity7', cur === 7)}
                ${choiceBtn('8', 'humanity8', cur === 8)}
            </div>`,
            navBtn(t('Назад'), 'prev') + navBtn(t('Дальше'), 'next', 'primary') + toSheetBtn);
    };
    function setHumanity(v) {
        setVal('base-humanity', String(v));
        if (el('base-humanity')) el('base-humanity').dispatchEvent(new Event('change'));
        if (typeof window.updateHumanity === 'function') window.updateHumanity();
        markCompleted('humanity');
        persist();
        nextStep();
    }
    STEP_ACTIONS.humanity7 = () => setHumanity(7);
    STEP_ACTIONS.humanity8 = () => setHumanity(8);

    /* ================= ШАГИ 8-11: ОПОРЫ И ТЕКСТ ================= */
    function wizardTouchstones() {
        if (typeof window.getTouchstones === 'function') return window.getTouchstones();
        return sheetData().touchstones || [];
    }
    function touchstoneTitle(item, index) {
        return String(item?.name || item?.principle || item?.text || '').trim()
            || tf('Опора {n}', { n: index + 1 });
    }
    RENDERERS.touchstones = () => {
        const ts = wizardTouchstones();
        const rows = ts.length
            ? ts.map((touchstone, i) => `<article class="cw-touchstone-editor">
                <div class="cw-touchstone-image">
                    ${touchstone.image ? `<img src="${esc(touchstone.image)}" alt="${esc(touchstoneTitle(touchstone, i))}">` : `<span>${t('Изображение опоры')}</span>`}
                    <input type="file" accept="image/*" data-cw-touchstone-file="${i}" hidden>
                    <button type="button" class="cw-btn ghost" data-cw-touchstone-upload="${i}">${touchstone.image ? t('Заменить') : t('Загрузить')}</button>
                    ${touchstone.image ? `<button type="button" class="cw-btn ghost" data-cw-touchstone-remove-image="${i}">${t('Удалить фото')}</button>` : ''}
                </div>
                <div class="cw-touchstone-fields">
                    <label>${t('Имя опоры')}
                        <input type="text" data-cw-touchstone-index="${i}" data-cw-touchstone-field="name" value="${esc(touchstone.name || '')}" placeholder="${t('Имя смертного или символа')}">
                    </label>
                    <label>${t('Принцип')}
                        <textarea data-cw-touchstone-index="${i}" data-cw-touchstone-field="principle" placeholder="${t('Во что эта опора помогает верить')}">${esc(touchstone.principle || '')}</textarea>
                    </label>
                    <label>${t('Описание')}
                        <textarea data-cw-touchstone-index="${i}" data-cw-touchstone-field="description" placeholder="${t('Кто это, как связан с персонажем, почему важен')}">${esc(touchstone.description || '')}</textarea>
                    </label>
                    <label>${t('Статус')}
                        <select data-cw-touchstone-status="${i}">
                            <option value="safe"${touchstone.status === 'safe' ? ' selected' : ''}>${t('В безопасности')}</option>
                            <option value="threatened"${touchstone.status === 'threatened' ? ' selected' : ''}>${t('Под угрозой')}</option>
                            <option value="harmed"${touchstone.status === 'harmed' ? ' selected' : ''}>${t('Пострадала')}</option>
                            <option value="lost"${touchstone.status === 'lost' ? ' selected' : ''}>${t('Утрачена')}</option>
                        </select>
                    </label>
                </div>
                <button type="button" class="cw-btn ghost cw-touchstone-delete" data-cw-touchstone-delete="${i}">${t('Удалить')}</button>
            </article>`).join('')
            : `<p style="color:#888;font-size:14px">${t('Опоры пока не добавлены.')}</p>`;
        return shell('touchstones', t('Опоры (Touchstones)'), t('Люди и принципы, удерживающие человечность'),
            `<div class="cw-intro" style="margin-bottom:14px">${t('Опоры — это смертные и убеждения, которые связывают персонажа с человечностью. Можно добавить несколько.')}</div>
             <div class="cw-touchstone-list">${rows}</div>
             <button type="button" class="cw-btn" data-cw="addTouchstone">+ ${t('Добавить опору')}</button>`,
            navBtn(t('Назад'), 'prev') + navBtn(t('Пропустить'), 'skip') + navBtn(t('Дальше'), 'next', 'primary') + toSheetBtn);
    };
    AFTER_RENDER.touchstones = () => {
        const card = el('cw-card');
        card.querySelectorAll('[data-cw-touchstone-field]').forEach(field => {
            field.addEventListener('input', () => {
                const index = parseInt(field.getAttribute('data-cw-touchstone-index'), 10);
                const key = field.getAttribute('data-cw-touchstone-field');
                if (typeof window.updateTouchstoneField === 'function') {
                    window.updateTouchstoneField(index, key, field.value);
                    markCompleted('touchstones');
                    persist();
                }
            });
        });
        card.querySelectorAll('[data-cw-touchstone-status]').forEach(select => {
            select.addEventListener('change', () => {
                const index = parseInt(select.getAttribute('data-cw-touchstone-status'), 10);
                if (typeof window.updateTouchstoneStatus === 'function') {
                    window.updateTouchstoneStatus(index, select.value);
                    markCompleted('touchstones');
                    persist();
                }
            });
        });
        card.querySelectorAll('[data-cw-touchstone-upload]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = btn.getAttribute('data-cw-touchstone-upload');
                card.querySelector(`[data-cw-touchstone-file="${index}"]`)?.click();
            });
        });
        card.querySelectorAll('[data-cw-touchstone-file]').forEach(input => {
            input.addEventListener('change', async () => {
                const index = parseInt(input.getAttribute('data-cw-touchstone-file'), 10);
                const file = input.files?.[0];
                if (!file || typeof window.setTouchstoneImageFromFile !== 'function') return;
                try {
                    await window.setTouchstoneImageFromFile(index, file);
                    markCompleted('touchstones');
                    renderStep('touchstones');
                    persist();
                } catch (error) {
                    showStepError(error.message || t('Ошибка загрузки изображения.'));
                } finally {
                    input.value = '';
                }
            });
        });
        card.querySelectorAll('[data-cw-touchstone-remove-image]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-cw-touchstone-remove-image'), 10);
                if (typeof window.removeTouchstoneImage === 'function') {
                    window.removeTouchstoneImage(index);
                    renderStep('touchstones');
                    persist();
                }
            });
        });
        card.querySelectorAll('[data-cw-touchstone-delete]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-cw-touchstone-delete'), 10);
                if (typeof window.removeTouchstone === 'function') {
                    window.removeTouchstone(index);
                    renderStep('touchstones');
                    persist();
                }
            });
        });
    };
    STEP_ACTIONS.addTouchstone = () => {
        if (typeof window.addTouchstone === 'function') window.addTouchstone();
        markCompleted('touchstones');
        renderStep('touchstones');
        persist();
    };

    function textStep(step, title, sub, mirrorId, placeholder) {
        RENDERERS[step] = () => shell(step, t(title), sub,
            `<div class="cw-field wide">
                <label for="cw-${mirrorId}">${esc(t(title))}</label>
                <textarea id="cw-${mirrorId}" data-mirror="${mirrorId}" placeholder="${esc(t(placeholder))}">${esc(val(mirrorId))}</textarea>
             </div>`,
            navBtn(t('Назад'), 'prev') + navBtn(t('Пропустить'), 'skip') + navBtn(t('Дальше'), 'next', 'primary') + toSheetBtn);
        AFTER_RENDER[step] = () => {
            const textEl = el('cw-' + mirrorId);
            if (textEl) textEl.addEventListener('input', () => {
                setVal(mirrorId, textEl.value);
                if (textEl.value.trim()) markCompleted(step);
            });
        };
    }
    textStep('backstory', 'Предыстория', '', 'backstory-input', 'Предыстория персонажа');
    textStep('appearance', 'Внешность', '', 'appearance-input', 'Описание внешности');
    textStep('notes', 'Заметки', '', 'notes-input', 'Личные заметки, связи, привычки, важные детали');

    /* ================= ШАГ 12: ХАРАКТЕРИСТИКИ И НАВЫКИ ================= */
    const ATTR_SCHEME = { 4: 1, 3: 3, 2: 4, 1: 1 };
    const SKILL_SCHEMES = {
        versatile: { label: t('Мастер на все руки'), limits: { 3: 1, 2: 8, 1: 10 } },
        balanced: { label: t('Сбалансированный'), limits: { 3: 3, 2: 5, 1: 7 } },
        specialist: { label: t('Специалист'), limits: { 4: 1, 3: 3, 2: 3, 1: 3 } }
    };
    const TRAIT_GROUPS = {
        attr: {
            'Физические': ['Сила', 'Ловкость', 'Выносливость'],
            'Социальные': ['Обаяние', 'Манипуляция', 'Самообладание'],
            'Ментальные': ['Интеллект', 'Смекалка', 'Упорство']
        },
        skill: {
            'Физические': ['Атлетика', 'Вождение', 'Воровство', 'Выживание', 'Драка', 'Ремесло', 'Скрытность', 'Стрельба', 'Фехтование'],
            'Социальные': ['Запугивание', 'Исполнение', 'Лидерство', 'Обращение с животными', 'Проницательность', 'Убеждение', 'Уличное чутьё', 'Хитрость', 'Этикет'],
            'Ментальные': ['Гуманитарные науки', 'Естественные науки', 'Медицина', 'Наблюдательность', 'Оккультизм', 'Политика', 'Расследование', 'Техника', 'Финансы']
        }
    };
    function counts(type) {
        const r = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        document.querySelectorAll(`.dot-input[data-type="${type}"]:checked`).forEach(i => {
            const v = parseInt(i.value, 10) || 0;
            if (v >= 1 && v <= 5) r[v]++;
        });
        return r;
    }
    function schemeRemaining(limits, c) {
        return Object.keys(limits).map(k => {
            const n = parseInt(k, 10);
            const used = c[n] || 0, max = limits[n] || 0;
            return { n, used, max };
        }).sort((a, b) => b.n - a.n);
    }
    function schemeComplete(limits, c) {
        return [1, 2, 3, 4, 5].every(v => (c[v] || 0) === (limits[v] || 0));
    }
    RENDERERS.attributes = () => {
        const pkg = val('skill-package');
        const pkgButtons = Object.entries(SKILL_SCHEMES).map(([id, s]) =>
            `<button type="button" class="cw-choice-btn ${pkg === id ? 'selected' : ''}" data-cw="setPkg" data-pkg="${id}" style="${pkg === id ? 'border-color:#ff3131;background:#2a1111' : ''}">${esc(s.label)}<small>${esc(formatScheme(s.limits))}</small></button>`
        ).join('');
        return shell('attributes', t('Характеристики и навыки'),
            t('Распредели точки небольшими окнами'),
            `<div class="cw-intro" style="margin-bottom:14px">${tf('Характеристики: распредели по схеме <b>{scheme}</b>. Навыки: выбери способ развития и заполни их в отдельном окне. Специализации можно добавить отдельным шагом, не открывая весь лист.', { scheme: esc(formatScheme(ATTR_SCHEME)) })}</div>
             <div class="cw-section-title">${t('Способ развития навыков')}</div>
             <div class="cw-choice-grid" style="margin-bottom:18px">${pkgButtons}</div>
             <div id="cw-attr-status"></div>
             <div id="cw-spec-preview"></div>
             <button type="button" class="cw-btn" data-cw="openAttrEditor">${t('Заполнить характеристики')}</button>
             <button type="button" class="cw-btn" data-cw="openSkillEditor">${t('Заполнить навыки')}</button>
             <button type="button" class="cw-btn" data-cw="openSpecEditor">${t('Специализации')}</button>
             <button type="button" class="cw-btn ghost" data-cw="recheckAttr" style="margin-left:8px">${t('Проверить заполнение')}</button>`,
            navBtn(t('Назад'), 'prev') + navBtn(t('Дальше'), 'next', 'primary') + toSheetBtn);
    };
    function formatScheme(limits) {
        return [5, 4, 3, 2, 1].filter(v => limits[v]).map(v => `${limits[v]}×${v}`).join(', ');
    }
    AFTER_RENDER.attributes = () => renderAttrStatus();
    function renderAttrStatus() {
        const box = el('cw-attr-status');
        if (!box) return;
        const ac = counts('attr');
        const attrOk = schemeComplete(ATTR_SCHEME, ac);
        const pkg = val('skill-package');
        const sc = counts('skill');
        let skillBlock = `<div class="cw-counter bad">${t('Сначала выбери способ развития навыков.')}</div>`;
        let skillOk = false;
        if (pkg && SKILL_SCHEMES[pkg]) {
            const limits = SKILL_SCHEMES[pkg].limits;
            skillOk = schemeComplete(limits, sc);
            skillBlock = `<div class="cw-counter">` + schemeRemaining(limits, sc).map(r =>
                `<span class="${r.used === r.max ? 'ok' : 'bad'}">×${r.n}: ${r.used}/${r.max}</span>`).join('') + `</div>`;
        }
        const specOk = specialtiesValid();
        const specIssue = specialtyValidationMessage();
        const specCount = filledSpecialtyCount();
        box.innerHTML = `<div class="cw-section-title">${t('Характеристики')}</div>
            <div class="cw-counter">` + schemeRemaining(ATTR_SCHEME, ac).map(r =>
                `<span class="${r.used === r.max ? 'ok' : 'bad'}">×${r.n}: ${r.used}/${r.max}</span>`).join('') + `</div>
            <div class="cw-section-title">${t('Навыки')}</div>${skillBlock}
            <div class="cw-section-title">${t('Специализации')}</div>
            <div class="cw-counter"><span class="${specOk ? 'ok' : 'bad'}">${tf('{current} / {max}', { current: specCount, max: VAMPIRE_SPECIALTY_LIMIT })}</span></div>
            ${specIssue ? `<p class="cw-issue-badge">${esc(specIssue)}</p>` : ''}
            <p style="color:${attrOk && skillOk && specOk ? '#36d675' : '#ff9500'};font-size:13px;margin-top:10px">
            ${attrOk && skillOk && specOk ? '✓ ' + t('Характеристики, навыки и специализации в порядке.') : t('Распределение ещё не завершено.')}</p>`;
        renderSpecialtyPreview();
        if (attrOk && skillOk && specOk) markCompleted('attributes'); else markSkipped('attributes');
    }
    STEP_ACTIONS.setPkg = function () {};
    STEP_ACTIONS.openAttrEditor = () => openTraitEditor('attr');
    STEP_ACTIONS.openSkillEditor = () => openTraitEditor('skill');
    STEP_ACTIONS.openSpecEditor = () => openSpecialtyEditor();
    STEP_ACTIONS.recheckAttr = () => renderAttrStatus();

    function traitNames(type) {
        return Object.values(TRAIT_GROUPS[type] || {}).flat();
    }
    function dotInputs(type) {
        return Array.from(document.querySelectorAll(`.dot-input[data-type="${type}"]`));
    }
    function getTraitDots(type, name) {
        const checked = dotInputs(type).find(input => input.name === name && input.checked);
        return parseInt(checked?.value || '0', 10) || 0;
    }

    function collectSpecialties() {
        const rows = [];
        document.querySelectorAll('.skill-spec-line').forEach(line => {
            const input = line.querySelector('input[type="text"]');
            const skill = input?.dataset?.skill
                || line.closest('.skill-specs')?.id?.replace('specs-', '')
                || '';
            const name = (input?.value || '').trim();
            rows.push({ skill, name });
        });
        return rows;
    }

    function filledSpecialtyCount() {
        return collectSpecialties().filter(item => item.name).length;
    }

    function specialtyValidationMessage() {
        const rows = collectSpecialties();
        const filled = rows.filter(item => item.name).length;
        if (filled < MIN_FILLED_SPECIALTIES) {
            return tf('Добавь хотя бы {count} специализацию с названием.', { count: MIN_FILLED_SPECIALTIES });
        }
        if (rows.some(item => !item.name)) {
            return t('Заполни названия всех добавленных специализаций или удали пустые строки.');
        }
        const perSkill = {};
        rows.forEach(item => {
            if (!item.skill || !item.name) return;
            perSkill[item.skill] = (perSkill[item.skill] || 0) + 1;
        });
        const overflow = Object.entries(perSkill).find(([skill, count]) => count > getTraitDots('skill', skill));
        if (overflow) {
            return tf('У навыка «{skill}» не может быть больше специализаций, чем точек ({dots}).', {
                skill: overflow[0],
                dots: getTraitDots('skill', overflow[0])
            });
        }
        if (filled > VAMPIRE_SPECIALTY_LIMIT) {
            return tf('Оставь не больше {limit} специализаций.', { limit: VAMPIRE_SPECIALTY_LIMIT });
        }
        return '';
    }

    function specialtiesValid() {
        return !specialtyValidationMessage();
    }

    function renderSpecialtyPreview() {
        const box = el('cw-spec-preview');
        if (!box) return;
        const rows = collectSpecialties().filter(item => item.name);
        const issue = specialtyValidationMessage();
        if (!rows.length) {
            box.innerHTML = `<div class="cw-section-title">${t('Специализации')}</div>
                <p class="cw-spec-empty">${t('Специализации пока не добавлены.')}</p>
                ${issue ? `<p class="cw-issue-badge">${esc(issue)}</p>` : ''}`;
            return;
        }
        box.innerHTML = `<div class="cw-section-title">${t('Ваши специализации')}</div>
            <ul class="cw-spec-preview-list">${rows.map(item =>
                `<li><button type="button" class="cw-spec-preview-item" data-cw-spec-skill="${esc(item.skill)}">
                    <strong>${esc(t(item.skill))}</strong><span>${esc(item.name)}</span>
                </button></li>`).join('')}</ul>
            ${issue ? `<p class="cw-issue-badge">${esc(issue)}</p>` : ''}`;
        box.querySelectorAll('[data-cw-spec-skill]').forEach(btn => {
            btn.addEventListener('click', () => openSpecialtyEditor());
        });
    }
    function setTraitDots(type, name, value) {
        const input = dotInputs(type).find(item => item.name === name && String(item.value) === String(value));
        if (!input) return;
        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof window.updateTrackers === 'function') window.updateTrackers();
        if (type === 'skill' && typeof window.updateSBadgeState === 'function') window.updateSBadgeState(name);
        renderAttrStatus();
        persist();
    }
    function traitEditorStatus(type) {
        if (type === 'attr') {
            return schemeRemaining(ATTR_SCHEME, counts('attr')).map(r =>
                `<span class="${r.used === r.max ? 'ok' : 'bad'}">×${r.n}: ${r.used}/${r.max}</span>`).join('');
        }
        const pkg = val('skill-package');
        if (!pkg || !SKILL_SCHEMES[pkg]) return `<span class="bad">${t('Сначала выбери способ развития навыков.')}</span>`;
        return schemeRemaining(SKILL_SCHEMES[pkg].limits, counts('skill')).map(r =>
            `<span class="${r.used === r.max ? 'ok' : 'bad'}">×${r.n}: ${r.used}/${r.max}</span>`).join('');
    }
    function renderTraitEditorContent(modal, type) {
        const groups = TRAIT_GROUPS[type] || {};
        const title = type === 'attr' ? t('Характеристики') : t('Навыки');
        modal.innerHTML = `<div class="cw-editor-shell" role="dialog" aria-modal="true" aria-label="${esc(title)}">
            <div class="cw-editor-header">
                <div>
                    <span>${type === 'attr' ? t('Схема') + ': ' + formatScheme(ATTR_SCHEME) : t('Схема навыков')}</span>
                    <h2>${esc(title)}</h2>
                </div>
                <button type="button" class="cw-editor-close" data-cw-editor-close aria-label="${t('Закрыть')}">×</button>
            </div>
            <div class="cw-counter cw-editor-status">${traitEditorStatus(type)}</div>
            <div class="cw-editor-grid">
                ${Object.entries(groups).map(([group, names]) => `<section class="cw-editor-group">
                    <h3>${esc(t(group))}</h3>
                    ${names.map(name => {
                        const current = getTraitDots(type, name);
                        return `<div class="cw-editor-row">
                            <span>${esc(t(name))}</span>
                            <div class="cw-editor-dots">
                                ${[0, 1, 2, 3, 4, 5].map(value => `<button type="button"
                                    class="${value === current ? 'current' : ''} ${value > 0 && value <= current ? 'filled' : ''}"
                                    data-cw-dot-type="${type}"
                                    data-cw-dot-name="${esc(name)}"
                                    data-cw-dot-value="${value}"
                                    aria-label="${esc(t(name))}: ${value}">${value === 0 ? '0' : ''}</button>`).join('')}
                            </div>
                        </div>`;
                    }).join('')}
                </section>`).join('')}
            </div>
        </div>`;
        modal.querySelector('[data-cw-editor-close]')?.addEventListener('click', closeCwEditor);
        modal.querySelectorAll('[data-cw-dot-value]').forEach(btn => {
            btn.addEventListener('click', () => {
                setTraitDots(btn.getAttribute('data-cw-dot-type'), btn.getAttribute('data-cw-dot-name'), parseInt(btn.getAttribute('data-cw-dot-value'), 10));
                renderTraitEditorContent(modal, type);
            });
        });
    }
    function openTraitEditor(type) {
        document.getElementById('cw-editor-modal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'cw-editor-modal';
        document.body.appendChild(modal);
        renderTraitEditorContent(modal, type);
    }
    function closeCwEditor() {
        const modal = document.getElementById('cw-editor-modal');
        if (modal?.querySelector('.cw-spec-editor')) {
            const rows = collectSpecialties();
            if (rows.some(item => !item.name)) {
                showStepError(t('Заполни названия всех добавленных специализаций или удали пустые строки.'));
                return;
            }
            const overflow = Object.entries(rows.reduce((acc, item) => {
                if (!item.skill || !item.name) return acc;
                acc[item.skill] = (acc[item.skill] || 0) + 1;
                return acc;
            }, {})).find(([skill, count]) => count > getTraitDots('skill', skill));
            if (overflow) {
                showStepError(tf('У навыка «{skill}» не может быть больше специализаций, чем точек ({dots}).', {
                    skill: overflow[0],
                    dots: getTraitDots('skill', overflow[0])
                }));
                return;
            }
        }
        modal?.remove();
        renderAttrStatus();
    }
    function specInputs(skillName) {
        return Array.from(document.getElementById('specs-' + skillName)?.querySelectorAll('input[type="text"]') || []);
    }
    function specialtyCount() {
        return document.querySelectorAll('.skill-spec-line').length;
    }
    function renderSpecialtyEditorContent(modal) {
        const names = traitNames('skill');
        const rows = names
            .map(name => ({ name, dots: getTraitDots('skill', name), specs: specInputs(name) }))
            .filter(item => item.dots > 0 || item.specs.length > 0);
        modal.innerHTML = `<div class="cw-editor-shell cw-spec-editor" role="dialog" aria-modal="true" aria-label="${t('Специализации')}">
            <div class="cw-editor-header">
                <div>
                    <span>${tf('Специализации (S): {current} / {max}', { current: specialtyCount(), max: 5 })}</span>
                    <h2>${t('Специализации')}</h2>
                </div>
                <button type="button" class="cw-editor-close" data-cw-editor-close aria-label="${t('Закрыть')}">×</button>
            </div>
            ${rows.length ? `<div class="cw-spec-list">${rows.map(item => `<section class="cw-spec-card">
                <div class="cw-spec-card-head">
                    <strong>${esc(t(item.name))}</strong>
                    <span>${tf('{dots} точек', { dots: item.dots })}</span>
                </div>
                <div class="cw-spec-lines">
                    ${item.specs.map((input, index) => `<div class="cw-spec-line">
                        <input type="text" value="${esc(input.value || '')}" data-cw-spec-name="${esc(item.name)}" data-cw-spec-index="${index}" placeholder="${t('Название специализации')}">
                        <button type="button" data-cw-spec-delete="${index}" data-cw-spec-name="${esc(item.name)}">×</button>
                    </div>`).join('')}
                </div>
                <button type="button" class="cw-btn ghost" data-cw-spec-add="${esc(item.name)}" ${item.specs.length >= item.dots || specialtyCount() >= VAMPIRE_SPECIALTY_LIMIT ? 'disabled' : ''}>+ ${t('Добавить специализацию')}</button>
            </section>`).join('')}</div>` : `<div class="cw-intro">${t('Сначала поставь хотя бы одну точку в навык, затем здесь появятся специализации.')}</div>`}
        </div>`;
        modal.querySelector('[data-cw-editor-close]')?.addEventListener('click', closeCwEditor);
        modal.querySelectorAll('[data-cw-spec-add]').forEach(btn => {
            btn.addEventListener('click', () => {
                const skill = btn.getAttribute('data-cw-spec-add');
                const container = document.getElementById('specs-' + skill);
                if (container) container.style.display = 'flex';
                if (typeof window.addSpecLine === 'function') window.addSpecLine(skill);
                if (typeof window.updateSpecUI === 'function') window.updateSpecUI(skill);
                renderSpecialtyEditorContent(modal);
                persist();
            });
        });
        modal.querySelectorAll('[data-cw-spec-delete]').forEach(btn => {
            btn.addEventListener('click', () => {
                const skill = btn.getAttribute('data-cw-spec-name');
                const index = parseInt(btn.getAttribute('data-cw-spec-delete'), 10);
                const input = specInputs(skill)[index];
                input?.closest('.skill-spec-line')?.remove();
                if (typeof window.updateSBadgeState === 'function') window.updateSBadgeState(skill);
                if (typeof window.updateSpecUI === 'function') window.updateSpecUI(skill);
                renderSpecialtyEditorContent(modal);
                persist();
            });
        });
        modal.querySelectorAll('[data-cw-spec-index]').forEach(input => {
            input.addEventListener('input', () => {
                const skill = input.getAttribute('data-cw-spec-name');
                const index = parseInt(input.getAttribute('data-cw-spec-index'), 10);
                const real = specInputs(skill)[index];
                if (real) {
                    real.value = input.value;
                    real.dispatchEvent(new Event('input', { bubbles: true }));
                    real.dispatchEvent(new Event('change', { bubbles: true }));
                }
                persist();
            });
        });
    }
    function openSpecialtyEditor() {
        document.getElementById('cw-editor-modal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'cw-editor-modal';
        document.body.appendChild(modal);
        renderSpecialtyEditorContent(modal);
    }
    // делегирование выбора пакета
    document.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('[data-cw="setPkg"]');
        if (!b || activeStep !== 'attributes') return;
        const pkg = b.getAttribute('data-pkg');
        setVal('skill-package', pkg);
        if (el('skill-package')) el('skill-package').dispatchEvent(new Event('change'));
        el('cw-card').querySelectorAll('[data-cw="setPkg"]').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        renderAttrStatus();
        persist();
    });

    /* ================= ШАГ 13: ДИСЦИПЛИНЫ ================= */
    function disciplineDotsTotal() {
        const src = sheetData().disciplines || {};
        return Object.values(src).reduce((t, s) =>
            t + Object.values(s || {}).reduce((a, b) => a + (parseInt(b, 10) || 0), 0), 0);
    }
    function clanDisciplineDots() {
        const clan = getCurrentClanValue();
        const src = sheetData().disciplines || {};
        return Object.values(src).reduce((total, sources) =>
            total + Object.entries(sources || {}).reduce((sum, [source, dots]) =>
                source === `${t('Клан')} ${clan}` ? sum + (parseInt(dots, 10) || 0) : sum, 0), 0);
    }
    function getWizardAllowedDisciplines() {
        const clan = getCurrentClanValue();
        const pred = val('predator-input');
        const pd = (rules().predator_types || {})[pred];
        const predDisc = pd && pd.disciplines && pd.disciplines.increase
            ? (pd.disciplines.increase.options || []) : [];
        if (isThinBloodClan()) {
            const alchemy = typeof vtmName === 'function' ? vtmName('Алхимия слабокровных') : 'Алхимия слабокровных';
            return [alchemy];
        }
        if (isCaitiffClan()) {
            const all = typeof window.getStandardDisciplineNames === 'function'
                ? window.getStandardDisciplineNames(clan)
                : Object.keys(rules().disciplines || {});
            return Array.from(new Set([...all, ...predDisc]));
        }
        const cd = clan ? ((rules().clans || {})[clan]?.disciplines || []) : [];
        return Array.from(new Set([...cd, ...predDisc]));
    }

    function disciplineStepValid() {
        if (isThinBloodClan()) return true;
        if (isCaitiffClan()) return disciplineDotsTotal() === 3;
        return clanDisciplineDots() === 3;
    }
    RENDERERS.disciplines = () => {
        const clan = getCurrentClanValue();
        const allowed = getWizardAllowedDisciplines();
        const intro = isThinBloodClan()
            ? t('Слабокровные используют Алхимию слабокровных и отдельный баланс преимуществ — стандартные клановые дисциплины не требуются.')
            : isCaitiffClan()
                ? tf('Каитиф выбирает <b>любые две</b> дисциплины из списка V5 (схема 2 + 1). Доступные: <b>{allowed}</b>.', { allowed: esc(allowed.join(', ') || '—') })
                : tf('Стартовому персонажу доступно <b>3 точки</b> дисциплин: одна дисциплина на 2 точки и одна на 1 (только из клановых и предоставленной типом охоты).\n            Доступные дисциплины: <b>{allowed}</b>. Точки и конкретные силы выбираются в отдельных окнах.', { allowed: esc(allowed.join(', ') || '—') });
        return shell('disciplines', t('Дисциплины'), isCaitiffClan() ? t('Любые две дисциплины (2 + 1)') : t('Распредели 3 точки по клановым дисциплинам'),
            `<div class="cw-intro" style="margin-bottom:14px">${intro}</div>
             <div id="cw-disc-status"></div>
             <button type="button" class="cw-btn" data-cw="openClanDiscEditor">${t('Выбрать стартовые дисциплины')}</button>
             <button type="button" class="cw-btn" data-cw="openPowerEditor">${t('Выбрать способности')}</button>
             <button type="button" class="cw-btn ghost" data-cw="recheckDisc" style="margin-left:8px">${t('Проверить')}</button>`,
            navBtn(t('Назад'), 'prev') + navBtn(t('Дальше'), 'next', 'primary') + toSheetBtn);
    };
    AFTER_RENDER.disciplines = () => renderDiscStatus();
    function renderDiscStatus() {
        const box = el('cw-disc-status');
        if (!box) return;
        const total = disciplineDotsTotal();
        const clanTotal = clanDisciplineDots();
        const thinBlood = isThinBloodClan();
        const caitiff = isCaitiffClan();
        const ok = disciplineStepValid();
        const statusHint = thinBlood
            ? t('для слабокровного не требуется')
            : caitiff
                ? t('нужно 3 точки в любых дисциплинах')
                : t('нужно выбрать клановые 2 + 1');
        box.innerHTML = `<div class="cw-counter"><span>${tf('Всего точек: <b>{total}</b>', { total })}</span>
            <span>${tf('От клана: <b>{clanTotal}</b>{note}', { clanTotal, note: thinBlood ? t(' (для слабокровного не требуется)') : (caitiff ? ' / 3' : ' / 3') })}</span>
            <span class="${ok ? 'ok' : 'bad'}">${ok ? '✓ ' + t('готово') : statusHint}</span></div>`;
        if (ok) markCompleted('disciplines'); else markSkipped('disciplines');
    }
    STEP_ACTIONS.openClanDiscEditor = () => {
        const clan = getCurrentClanValue();
        if (clan && typeof window.openClanDisciplineModal === 'function') {
            window.openClanDisciplineModal(clan);
        } else {
            showStepError(t('Сначала выбери клан.'));
        }
    };
    STEP_ACTIONS.openPowerEditor = () => openDisciplinePowerEditor();
    STEP_ACTIONS.recheckDisc = () => renderDiscStatus();

    function currentDisciplineRows() {
        const data = sheetData();
        return Object.entries(data.disciplines || {}).map(([name, sources]) => {
            const dots = Object.values(sources || {}).reduce((sum, value) => sum + (parseInt(value, 10) || 0), 0);
            const powers = (data.selectedPowers?.[name] || []).map(power =>
                typeof power === 'string' ? power : power.name || power.название || '').filter(Boolean);
            return { name, dots, powers };
        }).filter(item => item.dots > 0);
    }
    function openDisciplinePowerEditor() {
        document.getElementById('cw-editor-modal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'cw-editor-modal';
        const rows = currentDisciplineRows();
        modal.innerHTML = `<div class="cw-editor-shell" role="dialog" aria-modal="true" aria-label="${t('Способности дисциплин')}">
            <div class="cw-editor-header">
                <div>
                    <span>${t('Выбор сил')}</span>
                    <h2>${t('Способности дисциплин')}</h2>
                </div>
                <button type="button" class="cw-editor-close" data-cw-editor-close aria-label="${t('Закрыть')}">×</button>
            </div>
            ${rows.length ? `<div class="cw-spec-list">${rows.map(item => `<section class="cw-spec-card">
                <div class="cw-spec-card-head">
                    <strong>${esc(item.name)}</strong>
                    <span>${tf('{dots} точек', { dots: item.dots })}</span>
                </div>
                <p>${item.powers.length ? esc(item.powers.join(', ')) : t('Способности еще не выбраны.')}</p>
                <button type="button" class="cw-btn" data-cw-power-disc="${esc(item.name)}" data-cw-power-dots="${item.dots}">${t('Открыть выбор способностей')}</button>
            </section>`).join('')}</div>` : `<div class="cw-intro">${t('Сначала выбери стартовые дисциплины, затем здесь появятся доступные способности.')}</div>`}
        </div>`;
        document.body.appendChild(modal);
        modal.querySelector('[data-cw-editor-close]')?.addEventListener('click', closeCwEditor);
        modal.querySelectorAll('[data-cw-power-disc]').forEach(btn => {
            btn.addEventListener('click', () => {
                const disc = btn.getAttribute('data-cw-power-disc');
                const dots = parseInt(btn.getAttribute('data-cw-power-dots'), 10) || 1;
                openSheetPicker('openPowerSelectionModal', t('Окно способностей пока недоступно.'), [disc, dots]);
            });
        });
    }

    /* ================= ШАГ 14: ПРЕИМУЩЕСТВА И НЕДОСТАТКИ ================= */
    function itemPoints(item) {
        return parseInt(item?.points ?? item?.dots ?? item?.точки ?? 0, 10) || 0;
    }
    function meritPoints() {
        return (sheetData().merits || []).reduce((sum, item) => {
            const points = itemPoints(item);
            const free = item.fromPredator
                ? parseInt(item.predatorBasePoints ?? item.basePoints ?? points, 10) || 0
                : 0;
            return sum + Math.max(0, points - free);
        }, 0);
    }
    function flawPoints() {
        return (sheetData().flaws || []).reduce((sum, item) =>
            item.fromPredator ? sum : sum + itemPoints(item), 0);
    }
    function meritsLimit() { return typeof window.getMeritsLimit === 'function' ? window.getMeritsLimit() : 7; }
    function flawsLimit() { return typeof window.getFlawsLimit === 'function' ? window.getFlawsLimit() : 2; }
    function renderMfSelectionList() {
        const merits = sheetData().merits || [];
        const flaws = sheetData().flaws || [];
        const meritRows = merits.map((item, index) => {
            const locked = item.fromPredator ? ' cw-mf-locked' : '';
            const remove = item.fromPredator
                ? `<span class="cw-mf-tag">${t('от охоты')}</span>`
                : `<button type="button" class="cw-btn ghost cw-mf-remove" data-cw-remove-merit="${index}">×</button>`;
            return `<div class="cw-mf-row${locked}"><span>${esc(item.name || '')}</span><small>${esc(item.category || '')} · ${itemPoints(item)}</small>${remove}</div>`;
        }).join('');
        const flawRows = flaws.map((item, index) => {
            const locked = item.fromPredator ? ' cw-mf-locked' : '';
            const remove = item.fromPredator
                ? `<span class="cw-mf-tag">${t('от охоты')}</span>`
                : `<button type="button" class="cw-btn ghost cw-mf-remove" data-cw-remove-flaw="${index}">×</button>`;
            return `<div class="cw-mf-row${locked}"><span>${esc(item.name || '')}</span><small>${esc(item.category || '')} · ${itemPoints(item)}</small>${remove}</div>`;
        }).join('');
        return `<div class="cw-mf-selection">
            <div class="cw-section-title">${t('Выбранные преимущества')}</div>
            ${meritRows || `<p class="cw-spec-empty">${t('Пока ничего не выбрано.')}</p>`}
            <div class="cw-section-title">${t('Выбранные недостатки')}</div>
            ${flawRows || `<p class="cw-spec-empty">${t('Пока ничего не выбрано.')}</p>`}
        </div>`;
    }

    function bindMfSelectionActions(root) {
        root.querySelectorAll('[data-cw-remove-merit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-cw-remove-merit'), 10);
                if (typeof window.removeMerit === 'function') window.removeMerit(index);
                renderMfStatus();
                persist();
            });
        });
        root.querySelectorAll('[data-cw-remove-flaw]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-cw-remove-flaw'), 10);
                if (typeof window.removeFlaw === 'function') window.removeFlaw(index);
                renderMfStatus();
                persist();
            });
        });
    }

    function watchMeritsModalRefresh() {
        const modal = document.getElementById('merits-flaws-modal');
        if (!modal || modal.__cwRefreshBound) return;
        modal.__cwRefreshBound = true;
        const observer = new MutationObserver(() => {
            if (activeStep === 'meritsFlaws' && modal.style.display === 'none') renderMfStatus();
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
    }

    RENDERERS.meritsFlaws = () => {
        return shell('meritsFlaws', t('Преимущества и недостатки'), t('Распредели точки по правилам'),
            `<div class="cw-intro" style="margin-bottom:14px">${tf('Распредели ровно <b>{ml}</b> точек преимуществ и возьми ровно <b>{fl}</b> точки недостатков (бонусы типа охоты уже учтены).', { ml: meritsLimit(), fl: flawsLimit() })}</div>
             <div id="cw-mf-status"></div>
             <div id="cw-mf-selection"></div>
             <button type="button" class="cw-btn" data-cw="openMfSheet">${t('Открыть список преимуществ / недостатков')}</button>
             <button type="button" class="cw-btn ghost" data-cw="resetMf" style="margin-left:8px">${t('Сбросить выбор')}</button>
             <button type="button" class="cw-btn ghost" data-cw="recheckMf" style="margin-left:8px">${t('Проверить')}</button>`,
            navBtn(t('Назад'), 'prev') + navBtn(t('Дальше'), 'next', 'primary') + toSheetBtn);
    };
    AFTER_RENDER.meritsFlaws = () => {
        watchMeritsModalRefresh();
        renderMfStatus();
    };
    function renderMfStatus() {
        const box = el('cw-mf-status');
        const list = el('cw-mf-selection');
        if (!box) return;
        const mp = meritPoints(), ml = meritsLimit();
        const fp = flawPoints(), fl = flawsLimit();
        const ok = mp === ml && fp === fl;
        box.innerHTML = `<div class="cw-counter">
            <span>${t('Преимущества:')} <span class="${mp === ml ? 'ok' : 'bad'}">${mp} / ${ml}</span></span>
            <span>${t('Недостатки:')} <span class="${fp === fl ? 'ok' : 'bad'}">${fp} / ${fl}</span></span>
            </div><p style="color:${ok ? '#36d675' : '#ff9500'};font-size:13px">${ok ? '✓ ' + t('распределено верно') : t('распределение не завершено')}</p>
            ${!ok ? `<p class="cw-issue-badge">${t('Есть проблемы — исправь счётчики или сними лишние пункты ниже.')}</p>` : ''}`;
        if (list) {
            list.innerHTML = renderMfSelectionList();
            bindMfSelectionActions(list);
        }
        if (ok) markCompleted('meritsFlaws'); else markSkipped('meritsFlaws');
    }
    STEP_ACTIONS.openMfSheet = () => {
        if (typeof window.openMeritsFlawsModal === 'function') window.openMeritsFlawsModal();
        watchMeritsModalRefresh();
    };
    STEP_ACTIONS.resetMf = () => {
        if (typeof window.removeMerit !== 'function' || typeof window.removeFlaw !== 'function') return;
        for (let pass = 0; pass < 40; pass += 1) {
            const merits = sheetData().merits || [];
            const meritIndex = merits.findIndex(item => !item?.fromPredator);
            if (meritIndex < 0) break;
            window.removeMerit(meritIndex);
        }
        for (let pass = 0; pass < 40; pass += 1) {
            const flaws = sheetData().flaws || [];
            const flawIndex = flaws.findIndex(item => !item?.fromPredator);
            if (flawIndex < 0) break;
            window.removeFlaw(flawIndex);
        }
        renderMfStatus();
        persist();
    };
    STEP_ACTIONS.recheckMf = () => renderMfStatus();

    /* ================= ШАГ 15: ИНВЕНТАРЬ ================= */
    RENDERERS.inventory = () => {
        const inv = sheetData().inventory || [];
        const rows = inv.length
            ? inv.map(it => `<div class="cw-summary-row"><span class="lbl">${esc(it.name || t('Предмет'))}</span><span class="val">${esc(t(it.category || ''))} ×${esc(it.quantity || 1)}</span></div>`).join('')
            : `<p style="color:#888;font-size:14px">${t('Инвентарь пуст.')}</p>`;
        return shell('inventory', t('Инвентарь'), t('Необязательный шаг'),
            `<div class="cw-intro" style="margin-bottom:14px">${t('Добавь стартовые предметы: название, описание, количество, категорию, заметку. Можно пропустить.')}</div>
             <div class="cw-summary" style="margin-bottom:16px">${rows}</div>
             <button type="button" class="cw-btn" data-cw="addInv">+ ${t('Добавить предмет на листе')}</button>`,
            navBtn(t('Назад'), 'prev') + navBtn(t('Пропустить'), 'skip') + navBtn(t('Дальше'), 'next', 'primary') + toSheetBtn);
    };
    STEP_ACTIONS.addInv = () => {
        goToSheet();
        if (typeof window.switchSheetSection === 'function') window.switchSheetSection('inventory');
        if (typeof window.addInventoryItem === 'function') window.addInventoryItem();
    };

    /* ================= ШАГ 16: ИТОГОВЫЙ ЭКРАН ================= */
    function getSheetCreationIssues() {
        if (typeof window.getPlayerCreationIssues !== 'function') return [];
        try {
            const issues = window.getPlayerCreationIssues();
            return Array.isArray(issues) ? issues : [];
        } catch (error) {
            console.warn('Не удалось проверить лист персонажа:', error);
            return [];
        }
    }

    function formatCreationIssuesList(issues) {
        if (!issues.length) return '';
        return issues.map(item => `• ${item}`).join('\n');
    }

    function mandatoryValid() {
        const ac = counts('attr');
        const pkg = val('skill-package');
        const sc = counts('skill');
        const attrOk = schemeComplete(ATTR_SCHEME, ac);
        const skillOk = pkg && SKILL_SCHEMES[pkg] && schemeComplete(SKILL_SCHEMES[pkg].limits, sc);
        const specOk = specialtiesValid();
        const discOk = disciplineStepValid();
        const mfOk = meritPoints() === meritsLimit() && flawPoints() === flawsLimit();
        return {
            name: !!val('char-name'),
            clan: !!getCurrentClanValue(),
            predator: !!val('predator-input'),
            generation: generationValid(),
            humanity: ['7', '8'].includes(val('base-humanity')),
            attributes: attrOk && skillOk && specOk,
            skills: skillOk,
            specialties: specOk,
            disciplines: discOk,
            meritsFlaws: mfOk
        };
    }

    function getWizardIssuesByStep() {
        const v = mandatoryValid();
        return {
            identity: !v.name,
            clan: !v.clan,
            predator: !v.predator,
            generation: !v.generation,
            humanity: !v.humanity,
            attributes: !v.attributes,
            disciplines: !v.disciplines,
            meritsFlaws: !v.meritsFlaws
        };
    }

    function formatSpecialtySummary() {
        const rows = collectSpecialties().filter(item => item.name);
        if (!rows.length) return t('не добавлены');
        return rows.map(item => `${t(item.skill)}: ${item.name}`).join('; ');
    }

    function isGuidedCreationReady() {
        const local = mandatoryValid();
        if (!Object.values(local).every(Boolean)) return false;
        return getSheetCreationIssues().length === 0;
    }
    RENDERERS.summary = () => {
        const v = mandatoryValid();
        const row = (lbl, value, cls) =>
            `<div class="cw-summary-row"><span class="lbl">${esc(t(lbl))}</span><span class="val ${cls || ''}">${esc(value)}</span></div>`;
        const yn = b => b ? { t: t('заполнены'), c: 'ok' } : { t: t('ошибки'), c: 'bad' };
        const inv = (sheetData().inventory || []).length;
        const localOk = Object.values(v).every(Boolean);
        const sheetIssues = getSheetCreationIssues();
        const allOk = isGuidedCreationReady();
        const generation = val('generation-input');
        const vampireType = val('type-input');
        return shell('summary', t('Персонаж почти готов'), '',
            `<div class="cw-summary">
                ${row('Имя', val('char-name') || '—', v.name ? '' : 'bad')}
                ${row('Клан', getCurrentClanValue() || '—', v.clan ? '' : 'bad')}
                ${row('Тип охоты', val('predator-input') || '—', v.predator ? '' : 'bad')}
                ${row('Поколение', generation ? generation + (window.VTM_LANG === 'en' ? 'th' : '-е') : '—', v.generation ? '' : 'bad')}
                ${row('Тип вампира', vampireType || '—', v.generation ? '' : 'bad')}
                ${row('Человечность', val('base-humanity') || '7', '')}
                ${row('Характеристики', yn(v.attributes).t, yn(v.attributes).c)}
                ${row('Навыки', yn(v.skills).t, yn(v.skills).c)}
                ${row('Специализации', formatSpecialtySummary(), v.specialties ? '' : 'bad')}
                ${row('Дисциплины', yn(v.disciplines).t, yn(v.disciplines).c)}
                ${row('Преимущества и недостатки', yn(v.meritsFlaws).t, yn(v.meritsFlaws).c)}
                ${row('Инвентарь', inv ? t('заполнен') : t('пропущен'), '')}
             </div>
             ${!localOk ? `<div class="cw-error">${t('Не все обязательные шаги завершены. Чтобы зафиксировать лист, исправь отмеченные красным пункты.')}</div>` : ''}
             ${localOk && sheetIssues.length ? `<div class="cw-error"><p>${t('Лист не проходит финальную проверку:')}</p><ul>${sheetIssues.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}`,
            navBtn(t('Вернуться и исправить'), 'prev')
            + navBtn(t('Открыть полный лист'), 'toSheet', 'to-sheet')
            + `<button type="button" class="cw-btn cw-nav-forward primary" data-cw="finish" ${allOk ? '' : 'disabled'}>${t('Зафиксировать лист')}</button>`);
    };

    function finishSheet() {
        if (typeof window.updateCreationRuleControls === 'function') {
            try { window.updateCreationRuleControls(); } catch (error) { console.error(error); }
        }
        if (!isGuidedCreationReady()) {
            const local = mandatoryValid();
            const issues = getSheetCreationIssues();
            if (!Object.values(local).every(Boolean)) {
                showStepError(t('Сначала заверши все обязательные шаги.'));
                return;
            }
            showStepError(
                t('Лист не проходит финальную проверку. Вернись к отмеченным шагам и исправь значения.')
                + (issues.length ? '\n\n' + formatCreationIssuesList(issues) : '')
            );
            return;
        }
        let fixed = false;
        if (typeof window.fixStartingSheet === 'function') {
            try {
                fixed = window.fixStartingSheet({ silent: true }) === true;
            } catch (e) { console.error(e); }
        }
        if (!fixed) {
            const issues = getSheetCreationIssues();
            showStepError(
                t('Лист пока не проходит финальную проверку. Вернись к отмеченным шагам и исправь значения.')
                + (issues.length ? '\n\n' + formatCreationIssuesList(issues) : '')
            );
            return;
        }
        wizard.finishedAt = new Date().toISOString();
        markCompleted('summary');
        hideOverlay();
        persist({ sheetFixed: true });
        localStorage.removeItem(DRAFT_KEY);
        updateReturnButton();
    }

    /* ================= ВАЛИДАЦИЯ ПЕРЕХОДА «ДАЛЬШЕ» ================= */
    function validateAndAdvance() {
        const requiredChecks = {
            identity: [() => !!val('char-name'), t('Имя обязательно для заполнения.')],
            clan: [() => !!getCurrentClanValue(), t('Сначала выбери клан.')],
            predator: [() => !!val('predator-input'), t('Сначала выбери тип охоты.')],
            generation: [() => generationValid(), isThinBloodClan()
                ? t('Слабокровному нужно выбрать 14–16 поколение и тип вампира.')
                : t('Сначала выбери поколение и тип вампира (птенец, неонат или анцилла).')],
            humanity: [() => ['7', '8'].includes(val('base-humanity')), t('Выбери начальную Человечность: 7 или 8.')],
            attributes: [() => {
                const pkg = val('skill-package');
                return schemeComplete(ATTR_SCHEME, counts('attr'))
                    && Boolean(pkg && SKILL_SCHEMES[pkg] && schemeComplete(SKILL_SCHEMES[pkg].limits, counts('skill')))
                    && specialtiesValid();
            }, () => specialtyValidationMessage() || t('Заверши строгое распределение характеристик, навыков и специализаций.')],
            disciplines: [disciplineStepValid, t('Выбери стартовые клановые дисциплины по схеме 2 + 1.')],
            meritsFlaws: [() => meritPoints() === meritsLimit() && flawPoints() === flawsLimit(),
                t('Распредели требуемые преимущества и недостатки.')]
        };
        const check = requiredChecks[activeStep];
        if (check && !check[0]()) {
            const message = typeof check[1] === 'function' ? check[1]() : check[1];
            if (activeStep === 'identity') showIdentityError();
            else showStepError(message);
            return false;
        }
        if (!OPTIONAL_STEPS.has(activeStep)) markCompleted(activeStep);
        nextStep();
        return true;
    }

    /* ================= СТАРТОВЫЕ МОДАЛКИ ВЫБОРА ТИПА ================= */
    function modalShell(title, buttonsHtml) {
        return `<div class="cw-card" style="max-width:520px;margin-top:8vh">
            <h1>${esc(title)}</h1>
            <div class="cw-choice-grid">${buttonsHtml}</div>
        </div>`;
    }
    function getOverlay() {
        let overlay = el('cw-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'cw-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            // fallback-стиль если HTML-версия без CSS
            overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:40000;background:#0a0a0a;overflow-y:auto;padding:24px 16px;font-family:"Courier New",monospace;color:#d0d0d0;';
            document.body.appendChild(overlay);
        }
        return overlay;
    }
    function showTypeChoice() {
        openOverlay();
        getOverlay().innerHTML = modalShell(t('Создать персонажа'),
            choiceBtn(t('Создать вампира'), 'typeVampire') +
            choiceBtn(t('Создать НПС'), 'typeNpc'));
        bindTypeNav();
    }
    function showNpcChoice() {
        getOverlay().innerHTML = modalShell(t('Создать НПС'),
            choiceBtn(t('Вампир'), 'npcVampire') +
            choiceBtn(t('Человек'), 'npcHuman'));
        bindTypeNav();
    }
    function showModeChoice() {
        getOverlay().innerHTML = modalShell(t('Как создать персонажа?'),
            choiceBtn(t('Лёгкое создание персонажа'), 'modeGuided') +
            choiceBtn(t('Чистый лист'), 'modeBlank'));
        bindTypeNav();
    }
    function bindTypeNav() {
        getOverlay().querySelectorAll('[data-cw]').forEach(b => {
            b.addEventListener('click', () => typeNav(b.getAttribute('data-cw')));
        });
    }
    function applyCharMeta(meta) {
        pendingType = meta;
        window.__characterRole = meta.characterRole;
        if (typeof window.setCharacterType === 'function') window.setCharacterType(meta.sheetMode);
        persist({
            characterType: meta.characterType,
            characterRole: meta.characterRole,
            damageProfile: meta.damageProfile,
            sheetFixed: false,
            sheetMode: meta.sheetMode
        });
    }
    function restoreCardContainer() {
        el('cw-overlay').innerHTML = '<div class="cw-card" id="cw-card"></div>';
    }
    function typeNav(action) {
        switch (action) {
            case 'typeVampire':
                wizard.entryStage = 'mode';
                applyCharMeta({ characterType: 'vampire', characterRole: 'player', damageProfile: 'vampire', sheetMode: 'vampire' });
                showModeChoice();
                break;
            case 'typeNpc':
                wizard.entryStage = 'npcType';
                persist();
                showNpcChoice();
                break;
            case 'npcVampire':
                wizard.entryStage = null;
                applyCharMeta({ characterType: 'vampire', characterRole: 'npc', damageProfile: 'vampire', sheetMode: 'npc-vampire' });
                startBlank(true);
                break;
            case 'npcHuman':
                wizard.entryStage = null;
                applyCharMeta({ characterType: 'mortal', characterRole: 'npc', damageProfile: 'mortal', sheetMode: 'npc-mortal' });
                startBlank(true);
                break;
            case 'modeGuided':
                wizard.mode = 'guided';
                wizard.entryStage = null;
                restoreCardContainer();
                renderStep('warning');
                persist();
                break;
            case 'modeBlank':
                wizard.mode = 'blank';
                wizard.entryStage = null;
                wizard.currentStep = 'warning';
                startBlank(false);
                break;
        }
    }
    function startBlank(isNpc) {
        wizard.mode = wizard.mode || 'blank';
        hideOverlay();
        restoreCardContainer();
        // НПС не показывают кнопку возврата к мастеру (мастер пропущен)
        if (isNpc) { wizard.finishedAt = wizard.finishedAt || new Date().toISOString(); }
        persist();
        updateReturnButton();
    }

    /* ================= ИНИЦИАЛИЗАЦИЯ ================= */
    function readExistingWizard() {
        if (window.__creationWizardData) {
            return clone(window.__creationWizardData);
        }
        if (window.__loadedCharacterData && window.__loadedCharacterData.creationWizard) {
            return clone(window.__loadedCharacterData.creationWizard);
        }
        return null;
    }

    let _initDone = false;
    function init() {
        if (_initDone) return;
        _initDone = true;

        const draft = readDraft();
        if (draft?.character && typeof window.applyCharacterData === 'function') {
            window.__characterRole = draft.character.characterRole || 'player';
            window.applyCharacterData(draft.character, 'JSON');
        }

        const existing = draft?.wizard || readExistingWizard();
        if (existing) wizard = Object.assign(defaultWizard(), existing);
        window.__creationWizardData = wizard ? clone(wizard) : null;

        try {
            new MutationObserver(updateReturnButton)
                .observe(document.body, { attributes: true, attributeFilter: ['class'] });
        } catch (e) {}

        if (isNewMode()) {
            wizard = wizard || defaultWizard();
            if (wizard.mode === 'guided') {
                openOverlay();
                restoreCardContainer();
                renderStep(STEP_ORDER.includes(wizard.currentStep) ? wizard.currentStep : 'warning');
            } else if (wizard.mode === 'blank') {
                hideOverlay();
                updateReturnButton();
            } else if (wizard.entryStage === 'mode') {
                showModeChoice();
            } else if (wizard.entryStage === 'npcType') {
                showNpcChoice();
            } else {
                showTypeChoice();
            }
        } else {
            updateReturnButton();
        }
    }

    if (isNewMode()) {
        openOverlay();
        getOverlay().innerHTML = `<div class="cw-card" style="max-width:520px;margin-top:8vh">
            <h1>${t('Создание персонажа')}</h1>
            <p style="color:#888;text-align:center">${t('Подготавливаю правила и сохранённый прогресс…')}</p>
        </div>`;
    }

    window.addEventListener('vtm-sheet-ready', init);
    if (window.__vtmSheetReady) init();

    // Обновляем кнопку возврата при загрузке существующего персонажа
    window.addEventListener('vtm-character-loaded', () => {
        const existing = readExistingWizard();
        if (existing) wizard = Object.assign(defaultWizard(), existing);
        window.__creationWizardData = wizard ? clone(wizard) : null;
        updateReturnButton();
    });
})();
