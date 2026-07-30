(function () {
    'use strict';

    const SUPABASE_RULES_MANIFEST =
        'https://klhxbaagarqxaqnrvurr.supabase.co/storage/v1/object/public/rules-vampires/manifest.json';
    const LOCAL_RULES_MANIFEST = '/rules/vampires/manifest.json';

    function isLocalDevelopment() {
        return window.location.hostname === 'localhost'
            || window.location.hostname === '127.0.0.1';
    }

    function isManifest(value) {
        return Boolean(
            value
            && value.schemaVersion === 1
            && value.game === 'vampires'
            && typeof value.release === 'string'
            && value.files
            && typeof value.files === 'object'
        );
    }

    function isSafeFile(file) {
        return Boolean(
            file
            && typeof file.path === 'string'
            && /^[a-z0-9._/-]+$/i.test(file.path)
            && !file.path.startsWith('/')
            && !file.path.includes('..')
            && typeof file.sha256 === 'string'
            && /^[a-f0-9]{64}$/i.test(file.sha256)
            && Number.isSafeInteger(file.bytes)
            && file.bytes > 0
        );
    }

    async function sha256(value) {
        const bytes = new TextEncoder().encode(value);
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest))
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    async function loadFromManifest(manifestUrl, language) {
        const manifestResponse = await fetch(manifestUrl, { cache: 'no-cache' });
        if (!manifestResponse.ok) {
            throw new Error(`Manifest недоступен: HTTP ${manifestResponse.status}`);
        }
        const manifest = await manifestResponse.json();
        if (!isManifest(manifest)) throw new Error('Manifest имеет неизвестный формат');
        const file = manifest.files[language];
        if (!isSafeFile(file)) throw new Error(`В manifest отсутствует язык ${language}`);

        const absoluteManifestUrl = new URL(manifestUrl, window.location.origin);
        const fileUrl = new URL(file.path, absoluteManifestUrl).toString();
        const response = await fetch(fileUrl, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Правила недоступны: HTTP ${response.status}`);
        const text = await response.text();
        if (new TextEncoder().encode(text).byteLength !== file.bytes) {
            throw new Error('Размер правил не совпадает с manifest');
        }
        if (await sha256(text) !== file.sha256) {
            throw new Error('Контрольная сумма правил не совпадает');
        }
        return JSON.parse(text);
    }

    async function loadDirectFallback(language) {
        const filename = language === 'en' ? 'rules_eng.json' : 'rules.json';
        const response = await fetch(`/vampires/${filename}`, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`${filename} недоступен`);
        return response.json();
    }

    async function loadVampireRules(language) {
        const manifests = isLocalDevelopment()
            ? [LOCAL_RULES_MANIFEST]
            : [SUPABASE_RULES_MANIFEST, LOCAL_RULES_MANIFEST];
        for (const manifestUrl of manifests) {
            try {
                return {
                    data: await loadFromManifest(manifestUrl, language),
                    source: manifestUrl === SUPABASE_RULES_MANIFEST ? 'supabase' : 'local'
                };
            } catch (error) {
                // Следующий источник является штатным fallback.
            }
        }
        return {
            data: await loadDirectFallback(language),
            source: 'legacy-local'
        };
    }

    window.TableTopRulesCatalog = {
        loadVampireRules
    };
})();
