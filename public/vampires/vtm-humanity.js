// Source of truth: core/systems/vtm5/rules/humanity/index.ts
// Keep this legacy copy in sync when changing humanity mechanics.
(function (root) {
    const SOURCE_LABELS = {
        manual: 'ручное решение',
        chronicle_tenet_violation: 'нарушение принципа хроники',
        conviction_violation: 'нарушение Убеждения',
        touchstone_harmed: 'вред Опоре',
        predator_type_flaw: 'нарушение пищевого правила',
        discipline_risk: 'использование силы с риском Человечности',
        diablerie: 'диаблери',
        storyteller: 'решение Рассказчика'
    };

    function isRecord(value) {
        return Boolean(value && typeof value === 'object' && !Array.isArray(value));
    }

    function clampValue(value, fallback = 7) {
        const parsed = Number(value);
        const safe = Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
        return Math.max(0, Math.min(10, safe));
    }

    function clampStains(value, humanityValue) {
        const parsed = Number(value);
        const safe = Number.isFinite(parsed) ? Math.floor(parsed) : 0;
        return Math.max(0, Math.min(10 - clampValue(humanityValue), safe));
    }

    function normalizeEvent(value, index) {
        if (!isRecord(value)) return null;
        const source = Object.prototype.hasOwnProperty.call(SOURCE_LABELS, value.source) ? value.source : 'manual';
        return {
            id: typeof value.id === 'string' && value.id ? value.id : `legacy-stain-${index}`,
            amount: Math.max(0, Math.floor(Number(value.amount) || 0)),
            requestedAmount: typeof value.requestedAmount === 'number' ? value.requestedAmount : undefined,
            source,
            reason: typeof value.reason === 'string' && value.reason ? value.reason : SOURCE_LABELS[source],
            reasonText: typeof value.reasonText === 'string' ? value.reasonText : undefined,
            createdAt: typeof value.createdAt === 'string' && value.createdAt ? value.createdAt : new Date(0).toISOString(),
            mitigatedByConviction: typeof value.mitigatedByConviction === 'boolean' ? value.mitigatedByConviction : undefined,
            relatedConvictionId: typeof value.relatedConvictionId === 'string' ? value.relatedConvictionId : undefined,
            relatedTouchstoneId: typeof value.relatedTouchstoneId === 'string' ? value.relatedTouchstoneId : undefined
        };
    }

    function getHumanityState(characterData) {
        const data = characterData || {};
        const raw = data.humanity;
        let rawValue;
        let rawStains = 0;
        let events = [];
        let lastRemorseCheckAt = null;
        let lastHumanityLossAt = null;

        if (typeof raw === 'number' || typeof raw === 'string') {
            rawValue = raw;
        } else if (isRecord(raw)) {
            rawValue = raw.value;
            rawStains = raw.stains;
            events = Array.isArray(raw.stainEvents) ? raw.stainEvents : [];
            lastRemorseCheckAt = typeof raw.lastRemorseCheckAt === 'string' ? raw.lastRemorseCheckAt : null;
            lastHumanityLossAt = typeof raw.lastHumanityLossAt === 'string' ? raw.lastHumanityLossAt : null;
        }

        if (rawValue === undefined || rawValue === null || rawValue === '') {
            rawValue = data.vitalTrackers?.humanity ?? data.baseHumanity ?? 7;
        }

        const value = clampValue(rawValue);
        return {
            value,
            stains: clampStains(rawStains, value),
            stainEvents: events.map(normalizeEvent).filter(Boolean).slice(-100),
            lastRemorseCheckAt,
            lastHumanityLossAt
        };
    }

    function getStatus(state) {
        if (state.value <= 0) return 'lost_to_beast';
        if (state.stains >= 10 - state.value && state.stains > 0) return 'at_risk';
        if (state.stains > 0) return 'stained';
        return 'normal';
    }

    function getRemorseDice(state) {
        return Math.max(0, 10 - clampValue(state.value) - clampStains(state.stains, state.value));
    }

    var HUMANITY_WARNING_AT_RISK = 'Шкала Сомнений заполнена. Следующая проверка мук совести почти наверняка приведёт к потере Человечности.';
    var HUMANITY_WARNING_LOST_TO_BEAST = 'Человечность 0: персонаж окончательно уступает Зверю и переходит под контроль Рассказчика.';

    function getHumanityWarning(state) {
        if (state.value <= 0) return HUMANITY_WARNING_LOST_TO_BEAST;
        if (state.stains >= 10 - clampValue(state.value) && state.stains > 0) return HUMANITY_WARNING_AT_RISK;
        return '';
    }

    function applyRemorseCheckResult(before, params) {
        const remorseDice = Math.max(0, Math.floor(Number(params && params.remorseDice) || 0));
        const automaticFailure = remorseDice <= 0;
        const diceValues = params && Array.isArray(params.diceValues) ? params.diceValues : [];
        const successes = diceValues.filter(value => Number(value) >= 6).length;
        const success = !automaticFailure && successes > 0;
        const humanityAfter = success ? before.value : Math.max(0, before.value - 1);
        const now = (params && params.checkedAt) || new Date().toISOString();
        const nextState = {
            ...before,
            value: humanityAfter,
            stains: 0,
            lastRemorseCheckAt: now,
            lastHumanityLossAt: success ? before.lastHumanityLossAt : now
        };
        return {
            automaticFailure,
            successes,
            success,
            humanityAfter,
            nextState
        };
    }

    function addStains(characterData, amount, reason, options) {
        const before = getHumanityState(characterData);
        const requestedAmount = Math.max(0, Math.floor(Number(amount) || 0));
        const freeBoxes = Math.max(0, 10 - before.value - before.stains);
        const applied = Math.min(requestedAmount, freeBoxes);
        const source = options?.source || 'manual';
        const event = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            amount: applied,
            requestedAmount,
            source,
            reason: reason || SOURCE_LABELS[source] || SOURCE_LABELS.manual,
            reasonText: options?.reasonText,
            createdAt: new Date().toISOString(),
            mitigatedByConviction: options?.mitigatedByConviction,
            relatedConvictionId: options?.relatedConvictionId,
            relatedTouchstoneId: options?.relatedTouchstoneId
        };
        return {
            before,
            humanity: {
                ...before,
                stains: before.stains + applied,
                stainEvents: [...(before.stainEvents || []), event].slice(-100)
            },
            event,
            requestedAmount,
            applied,
            overflow: requestedAmount - applied,
            warning: requestedAmount > applied
                ? getHumanityWarning({ ...before, stains: before.stains + applied })
                : ''
        };
    }

    function normalizeMorality(value) {
        const source = isRecord(value) ? value : {};
        const chronicleTenets = Array.isArray(source.chronicleTenets)
            ? source.chronicleTenets.filter(item => typeof item === 'string' && item.trim())
            : [];
        const convictions = Array.isArray(source.convictions)
            ? source.convictions.map((item, index) => {
                if (typeof item === 'string') return { id: `conviction-${index}`, text: item };
                if (!isRecord(item) || !String(item.text || '').trim()) return null;
                return {
                    id: item.id || `conviction-${index}`,
                    text: String(item.text),
                    touchstoneId: item.touchstoneId || undefined
                };
            }).filter(Boolean)
            : [];
        const touchstones = Array.isArray(source.touchstones)
            ? source.touchstones.map((item, index) => {
                if (typeof item === 'string') return { id: `touchstone-${index}`, name: item, status: 'safe' };
                if (!isRecord(item)) return null;
                const name = String(item.name || item.text || '').trim();
                if (!name) return null;
                return {
                    id: item.id || `touchstone-${index}`,
                    name,
                    description: item.description || undefined,
                    status: ['safe', 'threatened', 'harmed', 'lost'].includes(String(item.status)) ? item.status : 'safe'
                };
            }).filter(Boolean)
            : [];
        return { chronicleTenets, convictions, touchstones };
    }

    const api = {
        SOURCE_LABELS,
        clampValue,
        clampStains,
        getHumanityState,
        getStatus,
        getRemorseDice,
        getHumanityWarning,
        applyRemorseCheckResult,
        addStains,
        normalizeMorality
    };

    root.VTMHumanity = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
