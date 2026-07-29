// Source of truth: core/systems/vtm5/rules/health/index.ts
// Keep this legacy copy in sync when changing health mechanics.
(function exposeVtmHealth(global) {
    const mendByBloodPotency = [1, 1, 2, 2, 3, 3, 3, 3, 4, 4, 5];

    function integer(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
        return Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));
    }

    function getHealthMax(stamina, tracker = {}) {
        const bonusMax = integer(tracker.bonusMax);
        const derived = integer(stamina) + 3 + bonusMax;
        return tracker.maxOverride === null || tracker.maxOverride === undefined
            ? derived
            : integer(tracker.maxOverride);
    }

    function normalizeDamageProfile(value, clan = '', type = '') {
        if (['vampire', 'mortal', 'ghoul', 'thinblood', 'custom'].includes(value)) return value;
        const identity = `${clan} ${type}`.toLocaleLowerCase('ru');
        if (/слабокров|thin.?blood/.test(identity)) return 'thinblood';
        if (/гул|ghoul/.test(identity)) return 'ghoul';
        if (/mortal|смертн|npc-mortal/.test(identity)) return 'mortal';
        return 'vampire';
    }

    function getPhysicalState(superficial, aggravated, max, profile) {
        if (max > 0 && aggravated >= max) {
            if (profile === 'vampire') return 'torpor';
            if (profile === 'mortal' || profile === 'ghoul') return 'dead_or_coma';
            return null;
        }
        return max > 0 && superficial + aggravated >= max ? 'impaired' : 'healthy';
    }

    function normalizeHealthTracker(value, stamina, profile = 'vampire') {
        if (typeof value === 'number') {
            const max = getHealthMax(stamina);
            const current = integer(value, 0, max);
            const superficial = max - current;
            return {
                superficial,
                aggravated: 0,
                bonusMax: 0,
                maxOverride: null,
                max,
                current,
                impaired: max > 0 && current <= 0,
                defeated: false,
                physicalState: getPhysicalState(superficial, 0, max, profile)
            };
        }
        const source = value && typeof value === 'object' ? value : {};
        const bonusMax = integer(source.bonusMax);
        const maxOverride = source.maxOverride === null || source.maxOverride === undefined
            ? null
            : integer(source.maxOverride);
        const max = getHealthMax(stamina, { bonusMax, maxOverride });
        const aggravated = integer(source.aggravated, 0, max);
        const superficial = integer(source.superficial, 0, Math.max(0, max - aggravated));
        const current = Math.max(0, max - superficial - aggravated);
        return {
            superficial,
            aggravated,
            bonusMax,
            maxOverride,
            max,
            current,
            impaired: max > 0 && current <= 0,
            defeated: max > 0 && aggravated >= max,
            physicalState: getPhysicalState(superficial, aggravated, max, profile)
        };
    }

    function warningFor(health, profile) {
        if (health.max > 0 && health.aggravated >= health.max) {
            if (profile === 'vampire') return 'Шкала здоровья полностью заполнена тяжёлыми повреждениями: вампир впадает в торпор.';
            if (profile === 'mortal' || profile === 'ghoul') return 'Шкала здоровья полностью заполнена тяжёлыми повреждениями: смертный в коме или мёртв, решение Рассказчика.';
            if (profile === 'thinblood') return 'Слабокровный: проверь профиль урона и решение Рассказчика.';
            return 'Шкала здоровья полностью заполнена тяжёлыми повреждениями: решение Рассказчика.';
        }
        return health.impaired ? 'Шкала здоровья заполнена: физические проверки получают -2к10.' : '';
    }

    function rebuild(health, superficial, aggravated, profile) {
        return normalizeHealthTracker({
            superficial,
            aggravated,
            bonusMax: health.bonusMax,
            maxOverride: health.maxOverride
        }, health.max - 3 - health.bonusMax, profile);
    }

    function applyHealthDamage(health, amount, severity, options = {}, profile = 'vampire') {
        const originalAmount = integer(amount);
        const halved = severity === 'superficial' && options.halveSuperficial !== false && !options.ignoreHalving;
        const finalAmount = halved ? Math.ceil(originalAmount / 2) : originalAmount;
        let superficial = health.superficial;
        let aggravated = health.aggravated;
        let applied = 0;
        let converted = 0;
        const warnings = [...(options.notes || [])];
        for (let index = 0; index < finalAmount; index += 1) {
            if (aggravated >= health.max) break;
            if (superficial + aggravated < health.max) {
                if (severity === 'aggravated') aggravated += 1;
                else superficial += 1;
                applied += 1;
            } else if (superficial > 0) {
                superficial -= 1;
                aggravated += 1;
                applied += 1;
                converted += 1;
            } else break;
        }
        const tracker = rebuild(health, superficial, aggravated, profile);
        if (converted) warnings.push(`Переполнение шкалы: ${converted} лёгк. поврежд. превращено в тяжёлые.`);
        const warning = warningFor(tracker, profile);
        if (warning) warnings.push(warning);
        return { tracker, originalAmount, finalAmount, applied, converted, halved, warnings };
    }

    function recoverHealthDamage(health, amount, severity, profile = 'vampire') {
        const requested = integer(amount);
        const recovered = Math.min(requested, severity === 'aggravated' ? health.aggravated : health.superficial);
        return {
            tracker: rebuild(
                health,
                health.superficial - (severity === 'superficial' ? recovered : 0),
                health.aggravated - (severity === 'aggravated' ? recovered : 0),
                profile
            ),
            recovered
        };
    }

    function getSuperficialMendAmount(bloodPotency) {
        return mendByBloodPotency[integer(bloodPotency, 0, 10)] || 1;
    }

    global.VTMHealth = {
        getHealthMax,
        normalizeDamageProfile,
        normalizeHealthTracker,
        applyHealthDamage,
        recoverHealthDamage,
        getSuperficialMendAmount,
        warningFor
    };
})(window);
