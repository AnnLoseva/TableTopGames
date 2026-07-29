// ==================== ПРОСТАЯ АВТОРИЗАЦИЯ (username + password) ====================

const SUPABASE_URL = 'https://klhxbaagarqxaqnrvurr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaHhiYWFnYXJxeGFxbnJ2dXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzkwNjAsImV4cCI6MjA5MzY1NTA2MH0.Cy2496DJgJhqZkERL9h19FkiiTfkcW2pauPaJU5r5oY';

let supabaseClient = null;
let currentUser = null;
let currentCharacterRecordId = null;
let charactersListCache = null;
let requestedCharacterLoadStarted = false;

function isNewCharacterMode() {
    return new URLSearchParams(window.location.search).get('new') === '1';
}

function startNewCharacter() {
    localStorage.removeItem('vtm-character-creation-draft-v2');
    const currentParams = new URLSearchParams(window.location.search);
    const targetParams = new URLSearchParams({
        room: currentParams.get('room') || localStorage.getItem('vtm-table-room') || 'campaign-666',
        role: currentParams.get('role') || localStorage.getItem('vtm-table-role') || 'player',
        new: '1'
    });
    window.top.location.assign(`/character-sheet?${targetParams.toString()}`);
}

function setAutoSaveStatus(text, kind = '') {
    const status = document.getElementById('autosave-status');
    if (!status) return;
    status.textContent = text || '';
    status.dataset.kind = kind;
}

function isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function mergeCharacterPatch(base, patch) {
    const result = { ...(isPlainObject(base) ? base : {}) };
    Object.entries(patch || {}).forEach(([key, value]) => {
        if (isPlainObject(value) && isPlainObject(result[key])) {
            result[key] = mergeCharacterPatch(result[key], value);
        } else {
            result[key] = value;
        }
    });
    return result;
}

function syncLoadedCharacterData(nextData) {
    if (!isPlainObject(nextData)) return;
    window.__loadedCharacterData = {
        ...(isPlainObject(window.__loadedCharacterData) ? window.__loadedCharacterData : {}),
        ...nextData
    };
    if (Array.isArray(nextData.activeEffects)) {
        window.setActiveDisciplineEffectsFromData?.(nextData.activeEffects, { render: true });
    }
}

async function autoSaveCharacterPatchFallback(client, patchWithTimestamp) {
    const { data, error } = await client
        .from('characters')
        .select('data')
        .eq('id', currentCharacterRecordId)
        .eq('user_id', currentUser.id)
        .single();
    if (error) throw error;

    const nextData = mergeCharacterPatch(data?.data || {}, patchWithTimestamp);

    const { error: updateError } = await client
        .from('characters')
        .update({ data: nextData })
        .eq('id', currentCharacterRecordId)
        .eq('user_id', currentUser.id);
    if (updateError) throw updateError;

    return nextData;
}

function initSupabase() {
    if (supabaseClient) return supabaseClient;
    
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase подключён (простая авторизация)");
    checkUserSession();
    return supabaseClient;
}

function ensureSupabase() {
    if (supabaseClient) return supabaseClient;
    if (!window.supabase) {
        alert('Supabase ещё загружается. Подождите секунду и попробуйте снова.');
        return null;
    }
    return initSupabase();
}

// ==================== ПОРТРЕТЫ В STORAGE ====================
// Портреты и изображения опор храним как файлы в bucket'е character-portraits,
// а в characters.data — только публичный URL (раньше base64 раздувал JSON).
const PORTRAIT_BUCKET = 'character-portraits';

function dataUrlToBlob(dataUrl) {
    const [meta, base64] = String(dataUrl).split(',');
    const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

async function uploadPortraitDataUrl(dataUrl, prefix = 'portrait') {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
    if (!supabaseClient && !window.supabase) return null;
    const client = supabaseClient || initSupabase();
    try {
        const blob = dataUrlToBlob(dataUrl);
        const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        const owner = currentUser?.id || 'shared';
        const path = `${owner}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await client.storage.from(PORTRAIT_BUCKET).upload(path, blob, {
            contentType: blob.type,
            cacheControl: '31536000',
            upsert: false
        });
        if (error) throw error;
        const { data } = client.storage.from(PORTRAIT_BUCKET).getPublicUrl(path);
        return data?.publicUrl || null;
    } catch (error) {
        console.warn('Портрет не загрузился в Storage, оставляем base64:', error);
        return null;
    }
}
window.uploadPortraitDataUrl = uploadPortraitDataUrl;

function setButtonBusy(selector, busy, text) {
    const button = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!button) return;
    if (busy) {
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = text || 'Загрузка...';
        button.disabled = true;
        button.style.opacity = '0.65';
        button.style.cursor = 'wait';
    } else {
        if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
        button.disabled = false;
        button.style.opacity = '';
        button.style.cursor = '';
    }
}

async function checkUserSession() {
    try {
        const savedUser = localStorage.getItem('vtm-sheet-user') || localStorage.getItem('vtm-chat-user');
        if (savedUser) currentUser = JSON.parse(savedUser);
    } catch (error) {
        console.warn('Не удалось восстановить пользователя:', error);
        localStorage.removeItem('vtm-sheet-user');
        localStorage.removeItem('vtm-chat-user');
        currentUser = null;
    }
    updateAuthButton();
}

function rememberUserSession(user) {
    currentUser = user;
    localStorage.setItem('vtm-sheet-user', JSON.stringify(user));
    localStorage.setItem('vtm-chat-user', JSON.stringify({
        id: user.id,
        username: user.username,
    }));
    charactersListCache = null;
}

// ==================== UI КНОПКИ ====================
function updateAuthButton() {
    const btn = document.getElementById('auth-btn');
    if (!btn) return;

    if (currentUser) {
        btn.innerHTML = `👤 ${currentUser.username}<br><small onclick="logout()" style="cursor:pointer">Выйти</small>`;
        btn.style.background = '#28a745';
        btn.onclick = null;
    } else {
        btn.textContent = '🔑 Войти в аккаунт';
        btn.style.background = '#ff3131';
        btn.onclick = showAuthModal;
    }
}

// ==================== МОДАЛЬНОЕ ОКНО ====================
function showAuthModal() {
    const html = `
    <div style="padding:35px; max-width:420px; margin:auto; background:#1a1a1a; border:3px solid #ff3131; border-radius:12px; color:#eee;">
        <h2 style="text-align:center; color:#ff3131; margin:0 0 25px 0;">Вход / Регистрация</h2>
        
        <input id="auth-username" type="text" placeholder="Имя пользователя" style="width:100%; padding:14px; margin:10px 0; background:#222; border:none; color:white; border-radius:6px;"><br>
        <input id="auth-password" type="password" placeholder="Пароль" style="width:100%; padding:14px; margin:10px 0; background:#222; border:none; color:white; border-radius:6px;"><br>
        
        <button onclick="handleLogin(this)" style="width:100%; padding:15px; margin:12px 0 8px 0; background:#ff3131; color:white; border:none; border-radius:8px; font-size:16px;">Войти</button>
        <button onclick="handleRegister(this)" style="width:100%; padding:15px; background:#444; color:white; border:none; border-radius:8px; font-size:16px;">Создать аккаунт</button>
        
        <button onclick="closeModal()" style="width:100%; margin-top:20px; padding:12px; background:transparent; color:#888; border:none;">Закрыть</button>
    </div>`;

    showModal(html);
}

// ==================== РЕГИСТРАЦИЯ ====================
window.handleRegister = async (button) => {
    const client = ensureSupabase();
    if (!client) return;
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!username || username.length < 3) return alert("Имя пользователя минимум 3 символа");
    if (password.length < 6) return alert("Пароль минимум 6 символов");

    // Простой hash (для теста)
    const passwordHash = btoa(password); // временно, потом заменим на нормальный

    setButtonBusy(button, true, 'Создаю...');
    const { data, error } = await client
        .from('users')
        .insert({ username, password_hash: passwordHash })
        .select('id, username')
        .single();

    if (error) {
        if (error.code === '23505') alert("Пользователь с таким именем уже существует");
        else alert("Ошибка регистрации: " + error.message);
    } else {
        rememberUserSession(data);
        updateAuthButton();
        closeModal();
    }
    setButtonBusy(button, false);
};

// ==================== ВХОД ====================
window.handleLogin = async (button) => {
    const client = ensureSupabase();
    if (!client) return;
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!username || !password) return alert("Введите логин и пароль");

    const passwordHash = btoa(password);

    setButtonBusy(button, true, 'Вхожу...');
    const { data, error } = await client
        .from('users')
        .select('id, username')
        .eq('username', username)
        .eq('password_hash', passwordHash)
        .single();

    if (error || !data) {
        alert("❌ Неверный логин или пароль");
    } else {
        rememberUserSession(data);
        updateAuthButton();
        closeModal();
    }
    setButtonBusy(button, false);
};

async function logout() {
    currentUser = null;
    currentCharacterRecordId = null;
    charactersListCache = null;
    localStorage.removeItem('vtm-sheet-user');
    localStorage.removeItem('vtm-chat-user');
    updateAuthButton();
    alert("👋 Вы вышли");
}

// Модальное окно
function showModal(html) {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:30000;display:flex;align-items:center;justify-content:center;padding:20px;';
        document.body.appendChild(modal);
    }
    modal.innerHTML = html;
    modal.style.display = 'flex';
}

window.closeModal = () => {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
};

// Автозапуск
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
} else {
    initSupabase();
}


// ==================== СОХРАНЕНИЕ ПЕРСОНАЖЕЙ ====================

async function saveCharacter() {
    const client = ensureSupabase();
    if (!client) return;
    if (!currentUser) {
        alert("❌ Войдите в аккаунт, чтобы сохранить персонажа!");
        showAuthModal();
        return;
    }

    if (window.validateThinBloodBalance && !window.validateThinBloodBalance()) return;
    if (window.validatePlayerCreation && !window.validatePlayerCreation({ requireFixed: true })) return;

    const characterData = window.getFullCharacterData ? window.getFullCharacterData() : {};

    if (!characterData.name) characterData.name = "Без имени";
    characterData.characterType = characterData.characterType || 'vampire';
    characterData.damageProfile = characterData.damageProfile || (characterData.characterType === 'mortal' || characterData.characterType === 'ghoul'
        ? 'mortal'
        : characterData.characterType === 'thinblood' ? 'thinblood' : 'vampire');
    characterData.hasBeenSaved = true;

    setButtonBusy('[onclick="saveCharacter()"]', true, 'Сохраняю...');

    const creatingNewCharacter = isNewCharacterMode();
    let existingId = creatingNewCharacter ? null : currentCharacterRecordId;
    if (!existingId && !creatingNewCharacter) {
        const { data: existing } = await client
            .from('characters')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('name', characterData.name)
            .limit(1)
            .maybeSingle();
        existingId = existing?.id || null;
    }

    let existingCharacterData = null;
    if (existingId) {
        const { data: existingRecord, error: existingRecordError } = await client
            .from('characters')
            .select('data')
            .eq('id', existingId)
            .eq('user_id', currentUser.id)
            .single();
        if (existingRecordError) {
            console.error('Не удалось загрузить активные эффекты перед сохранением:', existingRecordError);
            setButtonBusy('[onclick="saveCharacter()"]', false);
            setAutoSaveStatus('Не удалось сохранить активные эффекты', 'error');
            return;
        }
        if (isPlainObject(existingRecord?.data)) {
            existingCharacterData = existingRecord.data;
        }
    }
    const currentActiveEffects = Array.isArray(characterData.activeEffects)
        ? characterData.activeEffects
        : null;
    const storedActiveEffects = Array.isArray(existingCharacterData?.activeEffects)
        ? existingCharacterData.activeEffects
        : Array.isArray(window.__loadedCharacterData?.activeEffects)
            ? window.__loadedCharacterData.activeEffects
            : [];
    characterData.activeEffects = JSON.parse(JSON.stringify(currentActiveEffects ?? storedActiveEffects));

    const payload = {
        user_id: currentUser.id,
        name: characterData.name,
        clan: characterData.clan || null,
        data: characterData
    };

    const request = existingId
        ? client.from('characters').update(payload).eq('id', existingId).eq('user_id', currentUser.id).select('id').single()
        : client.from('characters').insert(payload).select('id').single();

    const { data, error } = await request;

    setButtonBusy('[onclick="saveCharacter()"]', false);

    if (error) {
        console.error(error);
        alert("❌ Ошибка сохранения:\n" + error.message);
    } else {
        currentCharacterRecordId = data?.id || existingId;
        charactersListCache = null;
        syncLoadedCharacterData(characterData);
        window.setCharacterSavedState?.(true);
        if (currentCharacterRecordId) {
            const params = new URLSearchParams(window.location.search);
            const room = params.get('room');
            params.delete('new');
            params.set('characterId', currentCharacterRecordId);
            window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
            if (currentUser?.id) {
                localStorage.setItem(`vtm-chat-character:${currentUser.id}`, currentCharacterRecordId);
                localStorage.setItem(`vtm-home-character:${currentUser.id}`, currentCharacterRecordId);
                if (room) localStorage.setItem(`vtm-chat-character:${currentUser.id}:${room}`, currentCharacterRecordId);
            }
            window.parent.postMessage({
                type: 'vtm-character-saved',
                characterId: currentCharacterRecordId
            }, window.location.origin);
        }
        alert(`✅ Персонаж "${characterData.name}" сохранён.`);
    }
}

async function autoSaveCharacterPatch(patch = {}, options = {}) {
    const client = ensureSupabase();
    if (!client) return { ok: false, skipped: true };
    if (!currentUser || !currentCharacterRecordId) {
        setAutoSaveStatus('Автосохранение: сначала сохраните лист', 'idle');
        return { ok: false, skipped: true };
    }

    try {
        if (!options.silent) setAutoSaveStatus('Сохраняю...', 'saving');
        const patchWithTimestamp = {
            ...patch,
            timestamp: new Date().toISOString()
        };
        let nextData = null;

        try {
            const { data, error } = await client.rpc('vtm_patch_character_data', {
                p_id: currentCharacterRecordId,
                p_user_id: currentUser.id,
                p_patch: patchWithTimestamp
            });
            if (error) throw error;
            nextData = data;
        } catch (rpcError) {
            console.warn('RPC автосохранения недоступен, используем старый путь:', rpcError);
            nextData = await autoSaveCharacterPatchFallback(client, patchWithTimestamp);
        }

        charactersListCache = null;
        syncLoadedCharacterData(nextData);
        setAutoSaveStatus('Сохранено', 'saved');
        return { ok: true, data: nextData };
    } catch (error) {
        console.error('Ошибка автосохранения персонажа:', error);
        setAutoSaveStatus('Ошибка автосохранения', 'error');
        return { ok: false, error };
    }
}

async function updateCurrentCharacterData(mutator, options = {}) {
    const client = ensureSupabase();
    if (!client) return { ok: false, skipped: true };
    if (!currentUser || !currentCharacterRecordId) {
        setAutoSaveStatus('Автосохранение: сначала сохраните лист', 'idle');
        return { ok: false, skipped: true };
    }

    try {
        if (!options.silent) setAutoSaveStatus('Сохраняю...', 'saving');
        const { data, error } = await client
            .from('characters')
            .select('data')
            .eq('id', currentCharacterRecordId)
            .eq('user_id', currentUser.id)
            .single();
        if (error) throw error;

        const currentData = isPlainObject(data?.data) ? data.data : {};
        const nextData = mutator({ ...currentData }) || currentData;
        nextData.timestamp = new Date().toISOString();

        const { error: updateError } = await client
            .from('characters')
            .update({ data: nextData })
            .eq('id', currentCharacterRecordId)
            .eq('user_id', currentUser.id);
        if (updateError) throw updateError;

        charactersListCache = null;
        syncLoadedCharacterData(nextData);
        setAutoSaveStatus('Сохранено', 'saved');
        return { ok: true, data: nextData };
    } catch (error) {
        console.error('Ошибка автосохранения персонажа:', error);
        setAutoSaveStatus('Ошибка автосохранения', 'error');
        return { ok: false, error };
    }
}

async function fetchMyCharacters({ force = false } = {}) {
    const client = ensureSupabase();
    if (!client || !currentUser) return [];
    if (!force && charactersListCache) return charactersListCache;

    // Лёгкий select: для списка нужен только URL портрета, не весь data
    const { data, error } = await client
        .from('characters')
        .select('id, name, clan, created_at, characterImage:data->>characterImage')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    if (error) {
        console.error(error);
        return null;
    }
    charactersListCache = data || [];
    return charactersListCache;
}

async function showMyCharacters() {
    const client = ensureSupabase();
    if (!client) return;
    if (!currentUser) {
        alert("❌ Войдите в аккаунт!");
        showAuthModal();
        return;
    }

    showModal(`<div style="padding:28px; width:min(420px,92vw); background:#111; border:2px solid #ff3131; border-radius:10px; color:#eee; text-align:center;">Загружаю персонажей...</div>`);
    const data = await fetchMyCharacters({ force: true });

    if (data === null) {
        closeModal();
        alert("Не удалось загрузить сохранённых персонажей. Вы возвращены на лист.");
        return;
    }

    let html = `<div style="position:relative;padding:24px; width:min(980px,96vw); max-height:86vh; overflow:auto; background:#111; border:2px solid #ff3131; border-radius:10px; color:#eee;">
        <button onclick="closeModal()" title="Закрыть" style="position:absolute; top:12px; right:16px; background:none; border:none; color:#ff3131; font-size:32px; cursor:pointer; line-height:1;">×</button>
        <h2 style="color:#ff3131; text-align:center; margin:0 0 18px;">📋 Мои персонажи (${data.length})</h2>
        <button onclick="startNewCharacter()" style="width:100%; margin-bottom:16px; padding:12px; border:1px solid #ff3131; border-radius:6px; background:#2a1111; color:#fff; cursor:pointer; font-size:15px;">+ Создать нового персонажа</button>
        ${data.length ? `
        <table style="width:100%; border-collapse:collapse; background:#111;">
            <thead><tr style="background:#222;">
                <th style="padding:12px; text-align:left;">Картинка</th>
                <th style="padding:12px; text-align:left;">Имя</th>
                <th style="padding:12px; text-align:center;">Клан</th>
                <th style="padding:12px; text-align:center;">Создан</th>
                <th style="padding:12px; text-align:center;">Действия</th>
            </tr></thead><tbody>` : '<p style="color:#888; text-align:center;">Сохранённых персонажей пока нет.</p>'}`;

    data.forEach(char => {
        const date = new Date(char.created_at).toLocaleString('ru-RU');
        const image = char.characterImage || char.data?.characterImage || '';
        html += `
            <tr style="border-bottom:1px solid #333;">
                <td style="padding:12px;">
                    ${image ? `<img src="${image}" alt="" style="width:58px;height:76px;object-fit:cover;border-radius:6px;border:1px solid #333;">` : `<div style="width:58px;height:76px;border:1px dashed #444;border-radius:6px;color:#666;display:flex;align-items:center;justify-content:center;font-size:11px;">нет</div>`}
                </td>
                <td style="padding:12px;">${char.name}</td>
                <td style="padding:12px; text-align:center; color:#aaa;">${char.clan || '—'}</td>
                <td style="padding:12px; text-align:center; color:#aaa;">${date}</td>
                <td style="padding:12px; text-align:center; white-space:nowrap;">
                    <button onclick="loadCharacter('${char.id}', this)" style="background:#ff3131; color:white; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; margin-right:8px;">Загрузить</button>
                    <button onclick="deleteCharacter('${char.id}', '${String(char.name).replace(/'/g, "\\'")}')" style="background:#330000; color:#ff6666; border:1px solid #7a2222; padding:8px 14px; border-radius:6px; cursor:pointer;">Удалить</button>
                </td>
            </tr>`;
    });

    if (data.length) html += `</tbody></table>`;
    html += `</div>`;
    showModal(html);
}

async function loadCharacter(id, button = null) {
    const client = ensureSupabase();
    if (!client) return;
    if (!currentUser) {
        alert("❌ Войдите в аккаунт!");
        showAuthModal();
        return;
    }

    setButtonBusy(button, true, 'Загружаю...');
    const { data, error } = await client
        .from('characters')
        .select('id, data')
        .eq('id', id)
        .eq('user_id', currentUser.id)
        .single();

    if (error || !data?.data) {
        console.error(error);
        setButtonBusy(button, false);
        return alert("Ошибка загрузки персонажа");
    }

    if (!window.applyCharacterData) {
        return alert("Лист ещё не готов к загрузке персонажа. Обновите страницу и попробуйте снова.");
    }

    currentCharacterRecordId = data.id;
    window.__loadedCharacterData = data.data;
    window.applyCharacterData(data.data, 'личного кабинета');
    closeModal();
    setButtonBusy(button, false);
}

async function loadRequestedCharacter() {
    if (isNewCharacterMode()) {
        currentCharacterRecordId = null;
        return;
    }
    const params = new URLSearchParams(window.location.search);
    const characterId = params.get('characterId');
    if (!characterId || requestedCharacterLoadStarted) return;

    const isMasterView = params.get('role') === 'master';
    if (!currentUser && !isMasterView) {
        console.warn('Автозагрузка персонажа пропущена: пользователь не вошёл в аккаунт.');
        return;
    }
    if (!window.applyCharacterData) return;

    const client = ensureSupabase();
    if (!client) return;
    requestedCharacterLoadStarted = true;

    let request = client
        .from('characters')
        .select('id, user_id, data')
        .eq('id', characterId);

    if (!isMasterView && currentUser) request = request.eq('user_id', currentUser.id);

    const { data, error } = await request.single();
    if (error || !data?.data) {
        requestedCharacterLoadStarted = false;
        console.error('Не удалось автоматически загрузить выбранного персонажа:', error);
        alert('Не удалось открыть выбранного персонажа. Возможно, у вас нет доступа к этому листу.');
        return;
    }

    const ownsCharacter = Boolean(currentUser && data.user_id === currentUser.id);
    currentCharacterRecordId = ownsCharacter ? data.id : null;
    window.__loadedCharacterData = data.data;
    window.applyCharacterData(data.data, isMasterView && !ownsCharacter ? 'игрового стола (просмотр мастера)' : 'игрового стола');

    if (ownsCharacter) {
        const room = params.get('room');
        localStorage.setItem(`vtm-chat-character:${currentUser.id}`, data.id);
        localStorage.setItem(`vtm-home-character:${currentUser.id}`, data.id);
        if (room) localStorage.setItem(`vtm-chat-character:${currentUser.id}:${room}`, data.id);
    }
}

window.addEventListener('vtm-sheet-ready', loadRequestedCharacter);
if (window.__vtmSheetReady) queueMicrotask(loadRequestedCharacter);

async function deleteCharacter(id, name = 'персонажа') {
    const client = ensureSupabase();
    if (!client) return;
    if (!currentUser) {
        alert("❌ Войдите в аккаунт!");
        showAuthModal();
        return;
    }

    if (!confirm(`Удалить «${name}»?`)) return;

    const { error } = await client
        .from('characters')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id);

    if (error) {
        console.error(error);
        return alert("Ошибка удаления персонажа:\n" + error.message);
    }

    if (currentCharacterRecordId === id) currentCharacterRecordId = null;
    charactersListCache = null;
    await showMyCharacters();
}

// Глобальные функции
window.saveCharacter = saveCharacter;
window.startNewCharacter = startNewCharacter;
window.showMyCharacters = showMyCharacters;
window.loadCharacter = loadCharacter;
window.deleteCharacter = deleteCharacter;
window.autoSaveCharacterPatch = autoSaveCharacterPatch;
window.autoSaveCharacterDataPatch = autoSaveCharacterPatch;
window.updateCurrentCharacterData = updateCurrentCharacterData;
