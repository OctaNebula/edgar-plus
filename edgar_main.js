// edgar_main.js — Edgar+ editor enhancements.
// Runs in the page's main world (injected by content.js), so it can talk to Edgar's CodeMirror instances.
(function () {
    'use strict';

    const EP = window.EdgarPlus = window.EdgarPlus || {};
    if (EP.mainLoaded) return;
    EP.mainLoaded = true;

    const DEBUG = false;
    const debugLog = (...args) => { if (DEBUG) console.log('Edgar+:', ...args); };

    // ------------------------------------------------------------------
    // Params passed by content.js through the <script> dataset
    // ------------------------------------------------------------------
    const script = document.currentScript;
    const ds = (script && script.dataset) || {};
    const aceBasePath = ds.aceBasePath || '';
    const ICONS = {
        play: ds.iconPlay, paste: ds.iconPaste, save: ds.iconSave,
        detach: ds.iconDetach, load: ds.iconLoad
    };
    const styleUrl = ds.styleUrl || '';
    // Set when Edgar+ is switched on while the page is already open: the code currently in
    // Edgar's own editor is then the freshest copy and must win over any older local draft.
    let preferPageCodeOnce = ds.preferPageCode === '1';

    EP.assets = { aceBasePath, icons: ICONS, styleUrl };

    if (window.ace && aceBasePath) {
        ['basePath', 'modePath', 'themePath', 'workerPath'].forEach(k => ace.config.set(k, aceBasePath));
    }

    // ------------------------------------------------------------------
    // localStorage helpers (never let a full quota break code syncing)
    // ------------------------------------------------------------------
    const DRAFT_PREFIX = 'edgar_plus_code_';
    const MAX_DRAFTS = 300;

    function lsGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function lsSet(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            pruneDrafts(Math.floor(MAX_DRAFTS / 2));
            try { localStorage.setItem(key, value); return true; } catch (e2) {
                console.warn('Edgar+: localStorage is full, draft not saved.');
                return false;
            }
        }
    }
    function lsRemove(key) {
        try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }

    function pruneDrafts(keep) {
        const drafts = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k || !k.startsWith(DRAFT_PREFIX)) continue;
                let ts = 0;
                const raw = localStorage.getItem(k);
                if (raw && raw.startsWith('{"v":2,')) {
                    try { ts = JSON.parse(raw).ts || 0; } catch (e) { /* legacy */ }
                }
                drafts.push({ k, ts });
            }
        } catch (e) { return; }
        if (drafts.length <= keep) return;
        drafts.sort((a, b) => b.ts - a.ts);
        drafts.slice(keep).forEach(d => lsRemove(d.k));
        debugLog(`Pruned ${drafts.length - keep} old drafts.`);
    }

    // Draft format v2: { v: 2, code, base, run, ts }. `base` is the code we last know the server has
    // (page code at load, or the code at the last Run/Save); `run` is the code of the last Run in this
    // browser (for the "edited since last run" status). Legacy (v1) drafts are plain strings.
    function readDraft(key) {
        const raw = lsGet(key);
        if (raw === null) return null;
        if (raw.startsWith('{"v":2,')) {
            try {
                const d = JSON.parse(raw);
                if (typeof d.code === 'string') return d;
            } catch (e) { /* fall through */ }
        }
        return { v: 1, code: raw, base: null, ts: 0 };
    }
    function writeDraft(key, code, base, run) {
        lsSet(key, JSON.stringify({ v: 2, code, base: base == null ? null : base, run: run == null ? null : run, ts: Date.now() }));
    }
    function normalizeCode(s) {
        return (s || '').replace(/\r\n?/g, '\n').trim();
    }

    // What the compiler sees: tokens without comments/whitespace. Used for "edited since last run",
    // so reformatting or editing comments doesn't count as a change. Falls back to trimmed text.
    const sigCache = new Map();
    function codeSignature(s) {
        s = s || '';
        if (!EP._formatTokenize) return normalizeCode(s);
        if (sigCache.has(s)) return sigCache.get(s);
        let sig;
        try {
            sig = EP._formatTokenize(s.replace(/\r\n?/g, '\n')).toks
                .filter(t => t.t !== 'lc' && t.t !== 'bc').map(t => t.v).join('\u0001');
        } catch (e) {
            sig = normalizeCode(s);
        }
        if (sigCache.size > 40) sigCache.delete(sigCache.keys().next().value);
        sigCache.set(s, sig);
        return sig;
    }

    // ------------------------------------------------------------------
    // Code history (snapshots), stored in IndexedDB on edgar.fer.hr
    // ------------------------------------------------------------------
    const HISTORY_DB = 'edgar-plus-history';
    const MAX_SNAPSHOTS_PER_KEY = 60;
    let historyDbPromise = null;

    function historyDb() {
        if (!historyDbPromise) {
            historyDbPromise = new Promise((resolve, reject) => {
                const req = indexedDB.open(HISTORY_DB, 1);
                req.onupgradeneeded = () => {
                    const store = req.result.createObjectStore('snaps', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('key', 'key');
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            historyDbPromise.catch(() => { historyDbPromise = null; });
        }
        return historyDbPromise;
    }

    async function listSnapshots(key) {
        const d = await historyDb();
        return new Promise((resolve, reject) => {
            const out = [];
            const req = d.transaction('snaps').objectStore('snaps').index('key').openCursor(IDBKeyRange.only(key), 'prev');
            req.onsuccess = () => {
                const c = req.result;
                if (!c) { resolve(out); return; }
                out.push(c.value);
                c.continue();
            };
            req.onerror = () => reject(req.error);
        });
    }

    // Adds a snapshot unless it's identical to the latest one; keeps the newest MAX_SNAPSHOTS_PER_KEY.
    async function addSnapshot(key, code, reason) {
        if (!getSetting('snapshots') || !key || !code || !code.trim()) return null;
        try {
            const existing = await listSnapshots(key);
            if (existing.length && existing[0].code === code) return existing[0];
            const d = await historyDb();
            const t = d.transaction('snaps', 'readwrite');
            const store = t.objectStore('snaps');
            const snap = { key, code, reason, ts: Date.now() };
            store.add(snap);
            existing.slice(MAX_SNAPSHOTS_PER_KEY - 1).forEach(old => store.delete(old.id));
            await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
            return snap;
        } catch (e) {
            console.warn('Edgar+: could not save a code snapshot', e);
            return null;
        }
    }

    const SNAPSHOT_REASONS = {
        run: 'Run',
        auto: 'Auto-saved while typing',
        manual: 'Saved manually',
        'before-paste': 'Before Paste & Run',
        'before-insert': 'Before inserting a snippet',
        'before-restore': 'Before restoring a snapshot',
        'local-draft': 'Your local draft (Edgar had a different version)',
        'before-edgar-change': 'Before Edgar replaced the code',
        'before-format': 'Before formatting'
    };

    // ------------------------------------------------------------------
    // Settings (same localStorage keys as v1.x so existing preferences carry over)
    // ------------------------------------------------------------------
    const SETTINGS = {
        theme: { key: 'edgar_plus_theme', def: 'ace/theme/edgar_plus' },
        mode: { key: 'edgar_plus_mode', def: 'ace/mode/c_cpp' },
        fontSize: { key: 'edgar_plus_fontsize', def: 14, num: true },
        vim: { key: 'edgar_plus_vim', def: false, bool: true },
        brackets: { key: 'edgar_plus_brackets', def: true, bool: true },
        invisibles: { key: 'edgar_plus_invisibles', def: false, bool: true },
        cleanOutput: { key: 'edgar_plus_clean_output', def: false, bool: true },
        hideTimer: { key: 'edgar_plus_hide_timer', def: false, bool: true },
        rainbow: { key: 'edgar_plus_rainbow_brackets', def: true, bool: true },
        highlightBrackets: { key: 'edgar_plus_highlight_brackets', def: false, bool: true },
        lang: { key: 'edgar_plus_lang', def: 'hr' }, // cheat sheet language: 'hr' or 'en'
        // Exam tools
        testDiff: { key: 'edgar_plus_test_diff', def: true, bool: true },
        similarTasks: { key: 'edgar_plus_similar_tasks', def: true, bool: true },
        snapshots: { key: 'edgar_plus_snapshots', def: true, bool: true },
        runState: { key: 'edgar_plus_run_state', def: true, bool: true },
        questionTimer: { key: 'edgar_plus_question_timer', def: true, bool: true },
        timeWarnings: { key: 'edgar_plus_time_warnings', def: true, bool: true }
    };

    function getSetting(name) {
        const s = SETTINGS[name];
        const raw = lsGet(s.key);
        if (raw === null || raw === '') return s.def;
        if (s.bool) return raw === 'true';
        if (s.num) {
            const n = parseFloat(raw);
            return isFinite(n) && n > 0 ? n : s.def;
        }
        return raw;
    }
    function setSetting(name, value) {
        lsSet(SETTINGS[name].key, String(value));
    }
    EP.getSetting = getSetting;

    const BASE_FONT_SIZE = 14;

    const THEMES = [
        ['Edgar+ (Default)', 'ace/theme/edgar_plus'], ['Ambiance', 'ace/theme/ambiance'],
        ['Chaos', 'ace/theme/chaos'], ['Chrome', 'ace/theme/chrome'], ['Clouds', 'ace/theme/clouds'],
        ['Clouds Midnight', 'ace/theme/clouds_midnight'], ['Cobalt', 'ace/theme/cobalt'],
        ['Crimson Editor', 'ace/theme/crimson_editor'], ['Dawn', 'ace/theme/dawn'],
        ['Dracula', 'ace/theme/dracula'], ['Dreamweaver', 'ace/theme/dreamweaver'],
        ['Eclipse', 'ace/theme/eclipse'], ['GitHub', 'ace/theme/github'], ['Gob', 'ace/theme/gob'],
        ['Gruvbox', 'ace/theme/gruvbox'], ['Idle Fingers', 'ace/theme/idle_fingers'],
        ['IPlastic', 'ace/theme/iplastic'], ['Katzenmilch', 'ace/theme/katzenmilch'],
        ['KR Theme', 'ace/theme/kr_theme'], ['Kuroir', 'ace/theme/kuroir'],
        ['Merbivore', 'ace/theme/merbivore'], ['Merbivore Soft', 'ace/theme/merbivore_soft'],
        ['Monokai', 'ace/theme/monokai'], ['Mono Industrial', 'ace/theme/mono_industrial'],
        ['Pastel on dark', 'ace/theme/pastel_on_dark'], ['Solarized Dark', 'ace/theme/solarized_dark'],
        ['Solarized Light', 'ace/theme/solarized_light'], ['SQL Server', 'ace/theme/sqlserver'],
        ['Terminal', 'ace/theme/terminal'], ['TextMate', 'ace/theme/textmate'],
        ['Tomorrow', 'ace/theme/tomorrow'], ['Tomorrow Night', 'ace/theme/tomorrow_night'],
        ['Tomorrow Night Blue', 'ace/theme/tomorrow_night_blue'],
        ['Tomorrow Night Bright', 'ace/theme/tomorrow_night_bright'],
        ['Tomorrow Night 80s', 'ace/theme/tomorrow_night_eighties'], ['Twilight', 'ace/theme/twilight'],
        ['Vibrant Ink', 'ace/theme/vibrant_ink'], ['Xcode', 'ace/theme/xcode']
    ];
    const LIGHT_THEMES = new Set([
        'ace/theme/chrome', 'ace/theme/clouds', 'ace/theme/crimson_editor', 'ace/theme/dawn',
        'ace/theme/dreamweaver', 'ace/theme/eclipse', 'ace/theme/github', 'ace/theme/iplastic',
        'ace/theme/katzenmilch', 'ace/theme/kuroir', 'ace/theme/solarized_light', 'ace/theme/sqlserver',
        'ace/theme/textmate', 'ace/theme/tomorrow', 'ace/theme/xcode'
    ]);
    const LANGS = [
        ['ace/mode/c_cpp', 'C / C++'], ['ace/mode/java', 'Java'],
        ['ace/mode/sql', 'SQL'], ['ace/mode/python', 'Python']
    ];

    function uiPalette() {
        const light = LIGHT_THEMES.has(getSetting('theme'));
        return {
            light,
            bg: light ? '#f0f0f0' : '#2F3129',
            fg: light ? '#333' : '#f8f8f2',
            border: light ? '#ccc' : '#444',
            btnBg: light ? '#e0e0e0' : '#444',
            btnHover: light ? '#d0d0d0' : '#555',
            btnBorder: light ? '#bbb' : '#555'
        };
    }

    // Theme colours go into CSS variables so :hover styles keep working.
    function paintBars(els) {
        const p = uiPalette();
        els.forEach(el => {
            if (!el) return;
            el.style.setProperty('--ep-bar-bg', p.bg);
            el.style.setProperty('--ep-fg', p.fg);
            el.style.setProperty('--ep-border', p.border);
            el.style.setProperty('--ep-btn-bg', p.btnBg);
            el.style.setProperty('--ep-btn-hover', p.btnHover);
            el.style.setProperty('--ep-btn-border', p.btnBorder);
        });
    }

    // Map Edgar's CodeMirror mode (set per question type) to an Ace mode.
    function modeFromCodeMirror(cm) {
        try {
            const m = cm.getOption('mode');
            const s = (typeof m === 'string' ? m : (m && m.name) || '').toLowerCase();
            if (!s) return null;
            if (s.includes('sql')) return 'ace/mode/sql';
            if (s.includes('python')) return 'ace/mode/python';
            if (s.includes('java') && !s.includes('javascript')) return 'ace/mode/java';
            if (s.includes('csrc') || s.includes('c++') || s.includes('clike')) return 'ace/mode/c_cpp';
        } catch (e) { /* ignore */ }
        return null;
    }

    // ------------------------------------------------------------------
    // Small UI helpers
    // ------------------------------------------------------------------
    function toast(message, opts = {}) {
        if (!document.body) return () => {};
        let host = document.getElementById('edgar-plus-toasts');
        if (!host) {
            host = document.createElement('div');
            host.id = 'edgar-plus-toasts';
            document.body.appendChild(host);
        }
        const el = document.createElement('div');
        el.className = 'edgar-plus-toast' + (opts.type ? ' edgar-plus-toast-' + opts.type : '');
        const msg = document.createElement('span');
        msg.textContent = message;
        el.appendChild(msg);
        let timer = null;
        const dismiss = () => { clearTimeout(timer); el.remove(); };
        if (opts.action) {
            const b = document.createElement('button');
            b.className = 'edgar-plus-toast-action';
            b.textContent = opts.action.label;
            b.addEventListener('click', () => { dismiss(); opts.action.run(); });
            el.appendChild(b);
        }
        const close = document.createElement('button');
        close.className = 'edgar-plus-toast-close';
        close.textContent = '×';
        close.addEventListener('click', dismiss);
        el.appendChild(close);
        host.appendChild(el);
        timer = setTimeout(dismiss, opts.duration || 4000);
        return dismiss;
    }
    EP.toast = toast;

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function timeAgo(ts) {
        const s = Math.round((Date.now() - ts) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return Math.round(s / 60) + ' min ago';
        if (s < 86400) return Math.round(s / 3600) + ' h ago';
        return Math.round(s / 86400) + ' days ago';
    }

    // Records inline style changes so they can be undone exactly when Edgar+ is switched off.
    function createStyleLog() {
        const log = [];
        return {
            set(el, prop, value) {
                if (!el) return;
                log.push([el, prop, el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]);
                el.style.setProperty(prop, value, 'important');
            },
            restore() {
                for (let i = log.length - 1; i >= 0; i--) {
                    const [el, prop, value, prio] = log[i];
                    if (value) el.style.setProperty(prop, value, prio);
                    else el.style.removeProperty(prop);
                }
                log.length = 0;
            }
        };
    }

    // ------------------------------------------------------------------
    // Global state
    // ------------------------------------------------------------------
    let enabled = true;
    const instances = new Set();
    let activeInstance = null;
    let instanceCounter = 0;

    let examIdPromise = null;
    let cachedExamId = null;
    function getExamId() {
        if (!location.pathname.startsWith('/exam/run')) return Promise.resolve(null);
        if (!examIdPromise) {
            examIdPromise = fetch('/exam/run/instance', { credentials: 'same-origin' })
                .then(r => (r.ok ? r.json() : null))
                .then(d => {
                    cachedExamId = (d && d.idTestInstance) || null;
                    return cachedExamId;
                })
                .catch(() => null);
        }
        return examIdPromise;
    }
    EP.getExamId = getExamId;

    function getActive() {
        if (activeInstance && instances.has(activeInstance) && activeInstance.isConnected()) return activeInstance;
        for (const inst of instances) {
            if (inst.isConnected()) return inst;
        }
        return null;
    }
    EP.getActiveEditor = () => {
        const a = getActive();
        return a ? a.editor : null;
    };
    EP.canInsert = () => {
        const a = enabled && getActive();
        return !!(a && !a.isReadOnly());
    };
    EP.insertSnippet = (snip) => {
        const a = enabled && getActive();
        if (!a) return { ok: false, reason: 'no-editor' };
        return a.insertSnippet(snip);
    };

    // Brace depth at `end`, ignoring braces in comments, strings and char literals.
    // blockStart is the index of the '{' that opened the outermost block containing `end`.
    function scanBlocks(text, end) {
        let depth = 0;
        let blockStart = -1;
        let state = 0; // 0 code, 1 line comment, 2 block comment, 3 string, 4 char
        for (let i = 0; i < end; i++) {
            const c = text[i];
            const n = text[i + 1];
            if (state === 0) {
                if (c === '/' && n === '/') { state = 1; i++; }
                else if (c === '/' && n === '*') { state = 2; i++; }
                else if (c === '"') state = 3;
                else if (c === "'") state = 4;
                else if (c === '{') { if (depth === 0) blockStart = i; depth++; }
                else if (c === '}' && depth > 0) depth--;
            } else if (state === 1) {
                if (c === '\n') state = 0;
            } else if (state === 2) {
                if (c === '*' && n === '/') { state = 0; i++; }
            } else if (c === '\\') {
                i++;
            } else if ((state === 3 && c === '"') || (state === 4 && c === "'") || c === '\n') {
                state = 0;
            }
        }
        return { depth, blockStart };
    }

    // ------------------------------------------------------------------
    // Editor instance
    // ------------------------------------------------------------------

    // The highest ancestor of the editor that contains no other editor. Run/Save buttons and the
    // compiler output of this editor live inside it (tutorial steps can have several editors).
    function findScope(cmEl) {
        let scope = cmEl;
        while (scope.parentElement && scope.parentElement !== document.body &&
            scope.parentElement.querySelectorAll('code-mirror').length <= 1) {
            scope = scope.parentElement;
        }
        return scope;
    }

    const SETTINGS_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
    const ARCHIVE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><polyline points="9 9 7 11 9 13"></polyline><polyline points="13 9 15 11 13 13"></polyline></svg>`;

    const FORMAT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"></line><line x1="8" y1="10" x2="20" y2="10"></line><line x1="8" y1="14" x2="20" y2="14"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>`;
    const HISTORY_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"></path><polyline points="3 3 3 9 9 9"></polyline><polyline points="12 7 12 12 15.5 14"></polyline></svg>`;
    const CHEAT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><line x1="8" y1="7" x2="16" y2="7"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>`;

    function langOptionsHtml() {
        return LANGS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    }

    function createInstance(textarea, cmEl, oldUI, cm, examId, preferPage) {
        const id = ++instanceCounter;
        const scope = findScope(cmEl);
        const styles = createStyleLog();
        const readOnly = !!(cm.getOption && cm.getOption('readOnly'));

        let destroyed = false;
        let isSyncing = false;        // we are writing into CodeMirror
        let applyingRemote = false;   // we are writing CodeMirror's/draft content into Ace
        let base = '';                // code we last know the server has
        let currentKey = computeKey();
        let detached = null;          // { win, editor, mainListener }
        let loading = false;
        let loadingTimer = null;
        let outputSnapshot = null;
        let lastAnnotatedOutput = null;
        let pendingRestoreToast = null;
        let lastRun = null;           // normalized code of the last Run in this browser (current key)
        let runStateTimer = null;
        let autoSnapTimer = null;
        let historyPop = null;
        let openModal = null;

        function computeKey() {
            let k = DRAFT_PREFIX + location.pathname + location.search;
            if (examId) k += '_exam_' + examId;
            const idx = Array.prototype.indexOf.call(document.querySelectorAll('code-mirror'), cmEl);
            if (idx > 0) k += '_e' + idx; // first editor keeps the v1.x key
            return k;
        }

        const findRunBtn = () => scope.querySelector('button[title="Ctrl+Enter"]');
        const findSaveBtn = () => Array.from(scope.querySelectorAll('button')).find(b => {
            if (b.closest('.edgar-plus-ui')) return false;
            const t = b.textContent.trim();
            return t === 'Save' || t === 'Spremi';
        });
        const findResult = () => scope.querySelector('clang-result');
        const findCompilerOutputCell = () => scope.querySelector('clang-result table.table-striped tr td:nth-child(3)');

        // ---- Hide Edgar's own editor UI ----
        styles.set(cmEl, 'border', 'none');
        styles.set(cmEl, 'box-shadow', 'none');
        styles.set(cmEl, 'outline', 'none');
        styles.set(cmEl, 'padding', '0');
        styles.set(cmEl, 'background', 'transparent');
        Array.from(cmEl.children).forEach(child => styles.set(child, 'display', 'none'));
        if (oldUI.parentElement && oldUI.parentElement !== cmEl) styles.set(oldUI, 'display', 'none');

        function hideOriginalButtons() {
            [findRunBtn(), findSaveBtn()].forEach(b => {
                if (b && !b.dataset.edgarPlusHidden) {
                    b.dataset.edgarPlusHidden = '1';
                    styles.set(b, 'display', 'none');
                }
            });
        }

        // ---- Build our UI ----
        const wrap = document.createElement('div');
        wrap.className = 'edgar-plus-ui edgar-plus-editor-wrap';
        wrap.dataset.edgarPlusId = String(id);
        wrap.innerHTML = `
            <div class="edgar-plus-toolbar">
                <span class="edgar-plus-label">Language:</span>
                <select class="edgar-plus-lang-select">${langOptionsHtml()}</select>
                <span class="edgar-plus-spacer"></span>
                <span class="edgar-plus-label">Zoom:</span>
                <button type="button" class="edgar-plus-square-btn edgar-plus-sm-btn" data-action="zoom-out" data-tooltip="Zoom Out">-</button>
                <span class="edgar-plus-zoom-level" title="Click to set custom zoom">100%</span>
                <button type="button" class="edgar-plus-square-btn edgar-plus-sm-btn edgar-plus-zoom-in" data-action="zoom-in" data-tooltip="Zoom In">+</button>
                <button type="button" class="edgar-plus-square-btn edgar-plus-tb-btn" data-action="format" data-tooltip="Format code (Shift+Alt+F)">${FORMAT_ICON}</button>
                <button type="button" class="edgar-plus-square-btn edgar-plus-tb-btn" data-action="cheatsheet" data-tooltip="Cheat Sheet">${CHEAT_ICON}</button>
                <button type="button" class="edgar-plus-square-btn edgar-plus-tb-btn" data-action="archive" data-tooltip="My Code Archive (Ctrl+Shift+F)">${ARCHIVE_ICON}</button>
                <button type="button" class="edgar-plus-square-btn edgar-plus-tb-btn edgar-plus-history-btn" data-action="history" data-tooltip="Code history">${HISTORY_ICON}</button>
                <button type="button" class="edgar-plus-square-btn edgar-plus-tb-btn" data-action="detach" data-tooltip="Detach Editor"><img src="${ICONS.detach}" width="16" height="16" alt=""></button>
                <button type="button" class="edgar-plus-square-btn edgar-plus-settings-btn" data-action="settings" data-tooltip="Settings">${SETTINGS_ICON}</button>
            </div>
            <div class="edgar-plus-ace"></div>
            <div class="edgar-plus-footer"><div class="edgar-plus-runstate" hidden></div><div class="edgar-plus-btn-group"></div></div>`;
        cmEl.appendChild(wrap);

        const toolbar = wrap.querySelector('.edgar-plus-toolbar');
        const aceContainer = wrap.querySelector('.edgar-plus-ace');
        const footer = wrap.querySelector('.edgar-plus-footer');
        const btnGroup = footer.querySelector('.edgar-plus-btn-group');
        const langSelect = toolbar.querySelector('.edgar-plus-lang-select');
        const zoomLevel = toolbar.querySelector('.edgar-plus-zoom-level');
        const runStateEl = footer.querySelector('.edgar-plus-runstate');
        const historyBtn = toolbar.querySelector('[data-action="history"]');

        function makeFooterBtn(doc, icon, colorClass, tooltip, action) {
            const btn = doc.createElement('button');
            btn.type = 'button';
            btn.className = `btn ${colorClass} edgar-plus-square-btn`;
            btn.setAttribute('data-tooltip', tooltip);
            btn.dataset.action = action;
            const img = doc.createElement('img');
            img.src = icon;
            img.alt = '';
            img.style.width = '24px';
            img.style.height = '24px';
            btn.appendChild(img);
            return btn;
        }
        const runBtn = makeFooterBtn(document, ICONS.play, 'btn-success', 'Run (F5 / Ctrl+Enter)', 'run');
        const pasteBtn = makeFooterBtn(document, ICONS.paste, 'btn-primary', 'Paste & Run (F1)', 'paste-run');
        const saveBtn = makeFooterBtn(document, ICONS.save, 'btn-warning', 'Save (Ctrl+S)', 'save');
        btnGroup.append(runBtn, pasteBtn, saveBtn);
        if (readOnly) pasteBtn.style.display = 'none';

        // ---- Ace ----
        const editor = ace.edit(aceContainer);
        editor.setOptions({
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: true,
            minLines: 15,
            maxLines: Infinity,
            showPrintMargin: false,
            fontFamily: "Consolas, 'Courier New', monospace"
        });
        editor.setReadOnly(readOnly);
        installEditorCommands(editor);

        const initialMode = modeFromCodeMirror(cm) || getSetting('mode');
        editor.session.setMode(initialMode);
        langSelect.value = initialMode;

        function installEditorCommands(ed) {
            // F1 is our Paste & Run; keep the command palette reachable on Ctrl+P.
            ed.commands.bindKey('F1', null);
            ed.commands.bindKey({ win: 'Ctrl-P', mac: 'Command-P' }, 'openCommandPalette');
            ed.commands.addCommand({
                name: 'edgarPlusRun',
                bindKey: { win: 'Ctrl-Enter', mac: 'Command-Enter' },
                exec: () => run(),
                readOnly: true
            });
            ed.commands.addCommand({
                name: 'edgarPlusFormat',
                bindKey: { win: 'Shift-Alt-F', mac: 'Shift-Alt-F' },
                exec: () => formatCode()
            });
            ed.commands.addCommand({
                name: 'edgarPlusSave',
                bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
                exec: () => save(),
                readOnly: true
            });
        }

        function applyEditorOptions(ed) {
            ed.setFontSize(getSetting('fontSize'));
            ed.setBehavioursEnabled(getSetting('brackets'));
            ed.setShowInvisibles(getSetting('invisibles'));
            ed.setKeyboardHandler(getSetting('vim') ? 'ace/keyboard/vim' : null);
        }

        function applyTheme() {
            const theme = getSetting('theme');
            editor.setTheme(theme);
            if (detached && detached.editor) detached.editor.setTheme(theme);
            paintBars([toolbar, footer]);
        }

        function applyToolVisibility() {
            historyBtn.style.display = getSetting('snapshots') ? '' : 'none';
            if (!getSetting('snapshots')) closeHistory();
            updateRunState();
        }

        function applyAllOptions() {
            applyEditorOptions(editor);
            if (detached && detached.editor) applyEditorOptions(detached.editor);
            updateZoomDisplay();
        }

        // ---- Zoom ----
        function zoomPct() {
            return Math.round((getSetting('fontSize') / BASE_FONT_SIZE) * 100);
        }
        function setZoom(pct) {
            pct = Math.max(10, Math.min(500, pct));
            setSetting('fontSize', (pct / 100) * BASE_FONT_SIZE);
            applySetting('fontSize');
        }
        function updateZoomDisplay() {
            zoomLevel.textContent = zoomPct() + '%';
            if (detached && detached.zoomLevel) detached.zoomLevel.textContent = zoomPct() + '%';
        }
        function makeZoomEditable(span, doc) {
            span.addEventListener('click', () => {
                if (span.querySelector('input')) return;
                const input = doc.createElement('input');
                input.type = 'text';
                input.value = zoomPct();
                input.className = 'edgar-plus-zoom-input';
                span.textContent = '';
                span.appendChild(input);
                input.focus();
                input.select();
                let done = false;
                const finish = (apply) => {
                    if (done) return;
                    done = true;
                    const n = parseInt(input.value.replace('%', '').trim(), 10);
                    if (apply && !isNaN(n)) setZoom(n);
                    else updateZoomDisplay();
                };
                input.addEventListener('blur', () => finish(true));
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') finish(true);
                    else if (e.key === 'Escape') finish(false);
                });
            });
        }
        makeZoomEditable(zoomLevel, document);

        // ---- Syncing Ace -> CodeMirror (Edgar reads the answer from CodeMirror) ----
        const nativeTextareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        function syncToCM() {
            if (destroyed) return;
            const value = editor.getValue();
            if (cm.getValue() !== value) {
                isSyncing = true;
                try { cm.setValue(value); } finally { isSyncing = false; }
            }
            if (typeof cm.save === 'function') cm.save();
            if (textarea.tagName === 'TEXTAREA') {
                nativeTextareaSetter.call(textarea, value);
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        function setEditorValueRemote(code) {
            applyingRemote = true;
            try { editor.setValue(code, -1); } finally { applyingRemote = false; }
            syncToCM();
        }

        // Decide whether the page's code or our local draft wins, then apply it.
        function resolveIncoming(appCodeRaw, key, opts = {}) {
            const appCode = normalizeCode(appCodeRaw);
            const draft = readDraft(key);
            const draftCode = draft ? normalizeCode(draft.code) : '';
            let useDraft = false;
            let offerDraft = false;

            if (opts.preferPage || !draft || !draftCode || draftCode === appCode) {
                useDraft = false;
            } else if (!appCode) {
                useDraft = true;                      // server has nothing yet, keep local work
            } else if (draft.v === 1) {
                useDraft = true;                      // legacy draft: keep v1.x behaviour
            } else if (normalizeCode(draft.base) === appCode) {
                useDraft = true;                      // server unchanged since our draft: local is newer
            } else {
                offerDraft = true;                    // server changed elsewhere: trust it, offer the draft
            }

            base = appCode || (draft && draft.base != null ? normalizeCode(draft.base) : '');
            if (draft && draft.run != null) lastRun = normalizeCode(draft.run);
            else if (key !== currentKey || opts.initial) lastRun = null;

            // Never lose code silently: keep what's about to be replaced as a snapshot.
            if (offerDraft) addSnapshot(key, draftCode, 'local-draft');
            const before = normalizeCode(editor.getValue());
            if (!opts.initial && key === currentKey && before && before !== (useDraft ? draftCode : appCode)) {
                addSnapshot(key, editor.getValue(), 'before-edgar-change');
            }
            currentKey = key;

            const target = useDraft ? draftCode : appCode;
            if (normalizeCode(editor.getValue()) !== target || editor.getValue() !== target) {
                setEditorValueRemote(target);
            } else {
                syncToCM();
            }
            if (useDraft) debugLog('Restored local draft for', key);
            updateRunState();

            if (pendingRestoreToast) { pendingRestoreToast(); pendingRestoreToast = null; }
            if (offerDraft && !readOnly) {
                const when = draft.ts ? ' (' + timeAgo(draft.ts) + ')' : '';
                pendingRestoreToast = toast('Edgar has a different version of this code than your local Edgar+ draft' + when + '. Showing Edgar\'s version.', {
                    duration: 15000,
                    action: {
                        label: 'Restore my draft',
                        run: () => {
                            if (destroyed) return;
                            editor.setValue(draftCode, -1); // a user-level change: undoable, saved as draft
                        }
                    }
                });
            }
        }

        function onEditorChange() {
            if (destroyed) return;
            if (!applyingRemote) {
                const key = computeKey();
                if (key !== currentKey) {
                    // URL changed under us without CodeMirror changing; adopt the new key.
                    currentKey = key;
                }
                writeDraft(currentKey, editor.getValue(), base, lastRun);
                scheduleAutoSnapshot();
            }
            syncToCM();
            scheduleRunState();
        }
        editor.session.on('change', onEditorChange);

        // ---- Run status: has the current code been run? ----
        function updateRunState() {
            clearTimeout(runStateTimer);
            runStateTimer = null;
            if (destroyed) return;
            const cur = normalizeCode(editor.getValue());
            if (!getSetting('runState') || readOnly || !cur) {
                runStateEl.hidden = true;
                return;
            }
            const same = lastRun != null && codeSignature(cur) === codeSignature(lastRun);
            let state;
            let text;
            let title;
            if (lastRun == null) {
                state = 'never';
                text = '○ Not run yet';
                title = 'No Run of this code has been recorded in this browser yet.';
            } else if (same) {
                state = 'clean';
                text = '✓ Last run used this code';
                title = 'The test results and score Edgar shows are for exactly the code in the editor.';
            } else {
                state = 'dirty';
                text = '● Edited since last run';
                title = 'You changed the code after your last Run, so the results Edgar shows are for an older version. Run again to check the current code. (Edgar submits whatever is in the editor when you finish the exam.)';
            }
            runStateEl.hidden = false;
            runStateEl.dataset.state = state;
            if (runStateEl.textContent !== text) runStateEl.textContent = text;
            runStateEl.title = title;
        }
        function scheduleRunState() {
            if (!runStateTimer) runStateTimer = setTimeout(updateRunState, 150);
        }

        // ---- Formatter ----
        function formatCode() {
            if (destroyed || readOnly) return;
            if (!EP.formatC) {
                toast('Edgar+: the formatter is not loaded on this page.', { type: 'error' });
                return;
            }
            const src = editor.getValue();
            const res = EP.formatC(src, { indent: editor.session.getTabString() });
            if (!res.ok) {
                toast('Edgar+ couldn\'t format this code safely, so it was left unchanged.', { type: 'error' });
                return;
            }
            if (!res.changed) {
                toast('The code is already formatted.');
                return;
            }
            const doc = editor.session.getDocument();
            const cursorIdx = doc.positionToIndex(editor.getCursorPosition());
            const scrollTop = editor.session.getScrollTop();
            addSnapshot(computeKey(), src, 'before-format');
            const Range = ace.require('ace/range').Range;
            const lastRow = doc.getLength() - 1;
            editor.session.replace(new Range(0, 0, lastRow, doc.getLine(lastRow).length), res.text);
            editor.clearSelection();
            editor.moveCursorToPosition(doc.indexToPosition(res.map(cursorIdx)));
            editor.session.setScrollTop(scrollTop);
            editor.focus();
            toast('Code formatted (only whitespace changed). Ctrl+Z undoes it.');
        }

        // ---- Code history ----
        function scheduleAutoSnapshot() {
            if (autoSnapTimer || !getSetting('snapshots')) return;
            autoSnapTimer = setTimeout(() => {
                autoSnapTimer = null;
                if (!destroyed) addSnapshot(currentKey, editor.getValue(), 'auto');
            }, 120000);
        }

        function fmtWhen(ts) {
            const d = new Date(ts);
            const p = n => String(n).padStart(2, '0');
            const time = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
            return d.toDateString() === new Date().toDateString() ? time : `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${time}`;
        }

        function changedLines(a, b) {
            if (a === b) return 0;
            if (!EP.diff) return null;
            return EP.diff.toRows(EP.diff.diffSeq(EP.diff.splitLines(a), EP.diff.splitLines(b))).filter(r => r.k !== 'same').length;
        }

        function onHistoryOutside(e) {
            if (historyPop && !historyPop.contains(e.target) && !historyBtn.contains(e.target)) closeHistory();
        }
        function onHistoryKey(e) {
            if (e.key === 'Escape' && historyPop) { e.stopPropagation(); closeHistory(); }
        }
        function closeHistory() {
            if (!historyPop) return;
            historyPop.remove();
            historyPop = null;
            document.removeEventListener('mousedown', onHistoryOutside, true);
            document.removeEventListener('keydown', onHistoryKey, true);
        }

        function toggleHistory() {
            if (historyPop) { closeHistory(); return; }
            historyPop = document.createElement('div');
            historyPop.className = 'edgar-plus-history-pop';
            historyPop.innerHTML = '<div class="ep-hp-empty">Loading…</div>';
            toolbar.appendChild(historyPop);
            document.addEventListener('mousedown', onHistoryOutside, true);
            document.addEventListener('keydown', onHistoryKey, true);
            historyPop.addEventListener('click', onHistoryClick);
            renderHistory();
        }

        let shownSnaps = [];
        async function renderHistory() {
            let snaps = [];
            try { snaps = await listSnapshots(computeKey()); } catch (e) { /* history unavailable */ }
            if (!historyPop) return;
            shownSnaps = snaps;
            const cur = editor.getValue();
            const items = snaps.map((sn, i) => {
                const n = changedLines(sn.code, cur);
                const delta = n === 0 ? 'same as now' : (n == null ? '' : (n === 1 ? '1 line differs from now' : `${n} lines differ from now`));
                return `<div class="ep-hp-item" data-i="${i}">
                    <div class="ep-hp-info"><span class="ep-hp-time">${escapeHtml(fmtWhen(sn.ts))}</span>
                        <span class="ep-hp-reason">${escapeHtml(SNAPSHOT_REASONS[sn.reason] || sn.reason)}</span>
                        <span class="ep-hp-delta">${escapeHtml(delta)}</span></div>
                    <div class="ep-hp-btns"><button type="button" data-hp="view" data-i="${i}">View</button>
                        <button type="button" data-hp="restore" data-i="${i}" ${n === 0 ? 'disabled' : ''}>Restore</button></div>
                </div>`;
            }).join('');
            historyPop.innerHTML = `
                <div class="ep-hp-head"><span class="ep-hp-title">Code history</span><span class="ep-hp-sub">this question</span>
                    <button type="button" data-hp="snap">Save snapshot</button></div>
                <div class="ep-hp-list">${items || '<div class="ep-hp-empty">No snapshots yet. Edgar+ saves one on every Run, every 2 minutes while you type, and before Paste &amp; Run, snippet inserts or Edgar replacing your code.</div>'}</div>
                <div class="ep-hp-foot">Stored in this browser · newest ${MAX_SNAPSHOTS_PER_KEY} per question</div>`;
        }

        function onHistoryClick(e) {
            const b = e.target.closest('[data-hp]');
            if (!b) {
                const item = e.target.closest('.ep-hp-item');
                if (item) openSnapshot(shownSnaps[+item.dataset.i]);
                return;
            }
            e.stopPropagation();
            const sn = shownSnaps[+b.dataset.i];
            if (b.dataset.hp === 'snap') {
                const code = editor.getValue();
                if (!code.trim()) { toast('The editor is empty, nothing to save.'); return; }
                const latest = shownSnaps[0];
                addSnapshot(computeKey(), code, 'manual').then(res => {
                    toast(res && latest && res === latest ? 'Already saved: no changes since the last snapshot.' : 'Snapshot saved.');
                    renderHistory();
                });
            } else if (b.dataset.hp === 'view' && sn) {
                openSnapshot(sn);
            } else if (b.dataset.hp === 'restore' && sn) {
                restoreSnapshot(sn);
            }
        }

        function restoreSnapshot(sn) {
            if (destroyed || readOnly) return;
            closeHistory();
            closeSnapshotModal();
            const key = computeKey();
            addSnapshot(key, editor.getValue(), 'before-restore').then(() => {
                if (destroyed) return;
                editor.setValue(sn.code, -1); // a user-level edit: undoable, saved as draft
                editor.focus();
                toast(`Restored the version from ${fmtWhen(sn.ts)}. Ctrl+Z undoes it.`);
            });
        }

        function closeSnapshotModal() {
            if (!openModal) return;
            openModal.remove();
            openModal = null;
            document.removeEventListener('keydown', onModalKey, true);
        }
        function onModalKey(e) {
            if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeSnapshotModal(); }
        }

        function openSnapshot(sn) {
            if (!sn) return;
            closeHistory();
            closeSnapshotModal();
            const cur = editor.getValue();
            const d = EP.diff ? EP.diff.renderDiff(sn.code, cur, { aLabel: 'Snapshot', bLabel: 'Current code', context: 3, maxRows: 1500 }) : null;
            const modal = document.createElement('div');
            modal.className = 'edgar-plus-ui edgar-plus-modal';
            modal.innerHTML = `
                <div class="ep-m-backdrop" data-m="close"></div>
                <div class="ep-m-window" role="dialog">
                    <div class="ep-m-head">
                        <div class="ep-m-title">Snapshot from ${escapeHtml(fmtWhen(sn.ts))} <span class="ep-m-sub">${escapeHtml(SNAPSHOT_REASONS[sn.reason] || sn.reason)}</span></div>
                        <div class="ep-m-actions">
                            <button type="button" class="ep-m-primary" data-m="restore" ${d && d.equal ? 'disabled' : ''}>Restore this version</button>
                            <button type="button" data-m="copy">Copy</button>
                            <button type="button" class="ep-m-close" data-m="close" title="Close (Esc)">&times;</button>
                        </div>
                    </div>
                    <div class="ep-m-tabs">
                        <button type="button" class="active" data-tab="diff">Changes vs current code</button>
                        <button type="button" data-tab="full">Full snapshot</button>
                    </div>
                    <div class="ep-m-body">
                        <div class="ep-m-pane" data-pane="diff">${!d ? '<div class="ep-m-empty">Diff unavailable.</div>' : (d.equal ? '<div class="ep-m-empty">Identical to the current code.</div>' : d.html)}</div>
                        <pre class="ep-m-pane ep-m-code" data-pane="full" hidden>${escapeHtml(sn.code)}</pre>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            openModal = modal;
            document.addEventListener('keydown', onModalKey, true);
            modal.addEventListener('click', (e) => {
                const t = e.target.closest('[data-m], [data-tab]');
                if (!t) return;
                if (t.dataset.tab) {
                    modal.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === t));
                    modal.querySelectorAll('[data-pane]').forEach(x => { x.hidden = x.dataset.pane !== t.dataset.tab; });
                } else if (t.dataset.m === 'close') {
                    closeSnapshotModal();
                } else if (t.dataset.m === 'restore') {
                    restoreSnapshot(sn);
                } else if (t.dataset.m === 'copy') {
                    const done = () => toast('Snapshot copied to clipboard.');
                    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(sn.code).then(done, () => toast('Copy failed.', { type: 'error' }));
                }
            });
        }

        function onCMChange() {
            if (isSyncing || destroyed) return;
            const key = computeKey();
            const appCode = cm.getValue();
            if (key === currentKey && normalizeCode(appCode) === normalizeCode(editor.getValue())) return;
            debugLog(key === currentKey ? 'External code change' : 'Question switch', key);
            resolveIncoming(appCode, key);
        }
        cm.on('change', onCMChange);

        // ---- Run / Paste & Run / Save ----
        function setLoading(on) {
            loading = on;
            clearTimeout(loadingTimer);
            const btns = [runBtn];
            if (detached && detached.runBtn) btns.push(detached.runBtn);
            btns.forEach(btn => {
                const img = btn.querySelector('img');
                btn.classList.toggle('edgar-loading', on);
                if (img) {
                    img.src = on ? ICONS.load : ICONS.play;
                    img.classList.toggle('edgar-spin', on);
                }
            });
            if (on) loadingTimer = setTimeout(() => setLoading(false), 60000);
        }

        function clearAnnotations() {
            editor.session.clearAnnotations();
            if (detached && detached.editor) detached.editor.session.clearAnnotations();
        }

        function run() {
            if (destroyed || !enabled) return;
            syncToCM();
            const orig = findRunBtn();
            if (!orig) {
                toast('Edgar+: Edgar\'s Run button was not found on this page.', { type: 'error' });
                return;
            }
            clearAnnotations();
            const res = findResult();
            outputSnapshot = res ? res.textContent : '';
            lastAnnotatedOutput = findCompilerOutputCell() ? findCompilerOutputCell().textContent : null;
            base = normalizeCode(editor.getValue());
            lastRun = base;
            writeDraft(computeKey(), editor.getValue(), base, lastRun);
            addSnapshot(computeKey(), editor.getValue(), 'run');
            updateRunState();
            setLoading(true);
            orig.click();
        }

        function pasteAndRun(win) {
            if (destroyed || !enabled || readOnly) return;
            const nav = (win || window).navigator;
            if (!nav.clipboard || !nav.clipboard.readText) {
                toast('Edgar+: Clipboard access is not available in this browser.', { type: 'error' });
                return;
            }
            nav.clipboard.readText().then(text => {
                if (!text) return;
                addSnapshot(computeKey(), editor.getValue(), 'before-paste');
                editor.setValue(text, -1); // undoable with Ctrl+Z
                run();
            }).catch(err => {
                console.error('Edgar+: Clipboard error:', err);
                toast('Edgar+: Please allow clipboard access to use Paste & Run.', { type: 'error' });
            });
        }

        function save() {
            if (destroyed || !enabled) return;
            syncToCM();
            const orig = findSaveBtn();
            if (!orig) {
                toast('Your code is synced with Edgar (there is no Save button on this page).');
                return;
            }
            base = normalizeCode(editor.getValue());
            writeDraft(computeKey(), editor.getValue(), base, lastRun);
            orig.click();
            [saveBtn, detached && detached.saveBtn].forEach(btn => {
                if (!btn || btn.classList.contains('edgar-loading')) return;
                const img = btn.querySelector('img');
                btn.classList.add('edgar-loading');
                img.src = ICONS.load;
                img.classList.add('edgar-spin');
                setTimeout(() => {
                    btn.classList.remove('edgar-loading');
                    img.classList.remove('edgar-spin');
                    img.src = ICONS.save;
                }, 1000);
            });
        }

        // ---- Output watching: stop spinner, show compiler errors in the gutter ----
        function parseCompilerErrors(text) {
            const annotations = [];
            const regex = /(?:^|\s)[\w./-]*?\.(?:c|cc|cpp|h|java|py):(\d+)(?::(\d+))?:\s*(fatal error|error|warning|note):\s*(.*)/g;
            let m;
            while ((m = regex.exec(text)) !== null) {
                const type = m[3];
                annotations.push({
                    row: parseInt(m[1], 10) - 1,
                    column: m[2] ? parseInt(m[2], 10) - 1 : 0,
                    text: m[4],
                    type: type.includes('error') ? 'error' : (type === 'warning' ? 'warning' : 'info')
                });
            }
            return annotations;
        }

        function checkOutput() {
            if (destroyed) return;
            hideOriginalButtons();
            saveBtn.style.display = findSaveBtn() ? '' : 'none';
            if (detached && detached.saveBtn) detached.saveBtn.style.display = saveBtn.style.display;

            if (loading) {
                const res = findResult();
                const now = res ? res.textContent : '';
                if (now.trim() && now !== outputSnapshot) setLoading(false);
            }

            const cell = findCompilerOutputCell();
            const text = cell ? cell.textContent : null;
            if (text !== null && text !== lastAnnotatedOutput) {
                lastAnnotatedOutput = text;
                const annotations = parseCompilerErrors(text);
                editor.session.setAnnotations(annotations);
                if (detached && detached.editor) detached.editor.session.setAnnotations(annotations);
            }
        }

        // ---- Rainbow brackets ----
        let rainbowOn = false;
        let rainbowTimer = null;
        function applyRainbowColors() {
            if (!rainbowOn || destroyed) return;
            const session = editor.session;
            const len = session.getLength();
            if (len > 5000) return;
            let depth = 0;
            for (let r = 0; r < len; r++) {
                let tokens = session.bgTokenizer.lines[r] || session.getTokens(r);
                if (!tokens) continue;
                const out = [];
                let modified = false;
                for (const t of tokens) {
                    const isParen = t.type.indexOf('paren.lparen') > -1 || t.type.indexOf('paren.rparen') > -1;
                    if (isParen && t.value.length > 1) {
                        for (const ch of t.value) out.push({ type: t.type, value: ch });
                        modified = true;
                    } else {
                        out.push(t);
                    }
                }
                for (const t of out) {
                    const isL = t.type.indexOf('paren.lparen') > -1;
                    const isR = t.type.indexOf('paren.rparen') > -1;
                    if (!isL && !isR) continue;
                    if (isR) depth = Math.max(0, depth - 1);
                    const newType = t.type.replace(/ ?edgar-depth-\d+/g, '') + ' edgar-depth-' + (depth % 3);
                    if (t.type !== newType) { t.type = newType; modified = true; }
                    if (isL) depth++;
                }
                if (modified) session.bgTokenizer.lines[r] = out;
            }
            editor.renderer.updateText();
        }
        function scheduleRainbow() {
            clearTimeout(rainbowTimer);
            rainbowTimer = setTimeout(applyRainbowColors, 50);
        }
        function enableRainbow() {
            if (rainbowOn) return;
            rainbowOn = true;
            editor.session.bgTokenizer.on('update', scheduleRainbow);
            editor.session.on('change', scheduleRainbow);
            editor.session.on('changeMode', scheduleRainbow);
            applyRainbowColors();
        }
        function disableRainbow() {
            if (!rainbowOn) return;
            rainbowOn = false;
            clearTimeout(rainbowTimer);
            editor.session.bgTokenizer.off('update', scheduleRainbow);
            editor.session.off('change', scheduleRainbow);
            editor.session.off('changeMode', scheduleRainbow);
            const lines = editor.session.bgTokenizer.lines;
            for (let r = 0; r < lines.length; r++) {
                if (!lines[r]) continue;
                lines[r].forEach(t => { t.type = t.type.replace(/ ?edgar-depth-\d+/g, ''); });
            }
            editor.renderer.updateText();
        }
        function applyRainbow() {
            try {
                if (getSetting('rainbow')) enableRainbow();
                else disableRainbow();
            } catch (err) {
                console.error('Edgar+: Rainbow brackets error:', err);
            }
        }

        // ---- Detached window ----
        function closeDetached() {
            if (detached && detached.win && !detached.win.closed) detached.win.close();
        }

        function onDetachedClosed() {
            if (!detached) return;
            const d = detached;
            detached = null;
            editor.session.off('change', d.mainListener);
            if (!destroyed && d.editor) {
                const v = d.editor.getValue();
                if (v !== editor.getValue()) editor.setValue(v, -1);
                syncToCM();
            }
            if (!destroyed) {
                wrap.style.display = '';
                const overlap = cmEl.closest('.edgar-overlap');
                if (overlap) overlap.style.display = '';
                editor.resize(true);
            }
        }

        function detach() {
            if (detached && detached.win && !detached.win.closed) {
                detached.win.focus();
                return;
            }
            const width = 800;
            const height = 600;
            const left = Math.max(0, (screen.width - width) / 2);
            const top = Math.max(0, (screen.height - height) / 2);
            const win = window.open('', 'EdgarPlusDetached_' + id, `width=${width},height=${height},left=${left},top=${top}`);
            if (!win) {
                toast('Edgar+: The browser blocked the popup window. Allow popups for edgar.fer.hr to detach the editor.', { type: 'error' });
                return;
            }
            const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
                .filter(l => !l.disabled)
                .map(l => `<link rel="stylesheet" href="${escapeHtml(l.href)}">`).join('\n');
            const bodyFont = window.getComputedStyle(document.body).fontFamily;

            const doc = win.document;
            doc.open();
            doc.write(`<!DOCTYPE html>
<html><head><title>Edgar+ Editor</title>
${cssLinks}
<link rel="stylesheet" href="${escapeHtml(styleUrl)}">
<style>
  html, body { margin: 0; padding: 0; height: 100%; }
  body { background-color: #272822; display: flex; flex-direction: column; overflow: hidden; font-family: ${bodyFont}; }
  .edgar-plus-editor-wrap { display: flex; flex-direction: column; height: 100vh; }
  .edgar-plus-toolbar { border-radius: 0 !important; position: relative; z-index: 10; }
  .edgar-plus-ace { flex: 1; border: none !important; }
  .edgar-plus-footer { border-radius: 0 !important; min-height: 50px; box-sizing: border-box; }
  .edgar-plus-reattach-icon { transform: rotate(180deg); display: block; }
</style></head>
<body class="${document.body.classList.contains('edgar-hide-bracket-match') ? 'edgar-hide-bracket-match' : ''}">
<div class="edgar-plus-ui edgar-plus-editor-wrap">
  <div class="edgar-plus-toolbar">
    <span class="edgar-plus-label">Language:</span>
    <select class="edgar-plus-lang-select">${langOptionsHtml()}</select>
    <span class="edgar-plus-spacer"></span>
    <span class="edgar-plus-label">Zoom:</span>
    <button type="button" class="edgar-plus-square-btn edgar-plus-sm-btn" data-action="zoom-out" data-tooltip="Zoom Out">-</button>
    <span class="edgar-plus-zoom-level" title="Click to set custom zoom">100%</span>
    <button type="button" class="edgar-plus-square-btn edgar-plus-sm-btn edgar-plus-zoom-in" data-action="zoom-in" data-tooltip="Zoom In">+</button>
    <button type="button" class="edgar-plus-square-btn edgar-plus-tb-btn" data-action="reattach" data-tooltip="Reattach"><img src="${ICONS.detach}" class="edgar-plus-reattach-icon" width="16" height="16" alt=""></button>
  </div>
  <div class="edgar-plus-ace"></div>
  <div class="edgar-plus-footer"><div class="edgar-plus-btn-group"></div></div>
</div>
<script src="${aceBasePath}ace.js"></script>
<script src="${aceBasePath}ext-language_tools.js"></script>
<script src="${aceBasePath}ext-searchbox.js"></script>
<script src="${aceBasePath}keybinding-vim.js"></script>
<script src="${aceBasePath}theme-edgar_plus.js"></script>
</body></html>`);
            doc.close();

            const d = { win, editor: null, runBtn: null, saveBtn: null, zoomLevel: null, mainListener: null };
            detached = d;

            const setup = () => {
                if (d.editor || detached !== d || win.closed) return;
                const pAce = win.ace;
                if (!pAce) { setTimeout(setup, 50); return; }
                if (aceBasePath) ['basePath', 'modePath', 'themePath', 'workerPath'].forEach(k => pAce.config.set(k, aceBasePath));

                const pEditor = pAce.edit(doc.querySelector('.edgar-plus-ace'));
                d.editor = pEditor;
                win.edgarEditor = pEditor;
                pEditor.setOptions({
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true,
                    enableSnippets: true,
                    showPrintMargin: false,
                    fontFamily: "Consolas, 'Courier New', monospace"
                });
                pEditor.setReadOnly(readOnly);
                pEditor.session.setMode(editor.session.getMode().$id || langSelect.value);
                pEditor.setValue(editor.getValue(), -1);
                pEditor.session.setAnnotations(editor.session.getAnnotations());
                installEditorCommands(pEditor);
                applyEditorOptions(pEditor);

                const pToolbar = doc.querySelector('.edgar-plus-toolbar');
                const pLang = pToolbar.querySelector('.edgar-plus-lang-select');
                d.zoomLevel = pToolbar.querySelector('.edgar-plus-zoom-level');
                pLang.value = langSelect.value;
                pLang.addEventListener('change', () => setLanguage(pLang.value));
                makeZoomEditable(d.zoomLevel, doc);
                pToolbar.addEventListener('click', (e) => {
                    const b = e.target.closest('button[data-action]');
                    if (!b) return;
                    if (b.dataset.action === 'zoom-in') setZoom(zoomPct() + 10);
                    else if (b.dataset.action === 'zoom-out') setZoom(zoomPct() - 10);
                    else if (b.dataset.action === 'reattach') win.close();
                });

                const pGroup = doc.querySelector('.edgar-plus-btn-group');
                d.runBtn = makeFooterBtn(doc, ICONS.play, 'btn-success', 'Run (F5 / Ctrl+Enter)', 'run');
                const pPaste = makeFooterBtn(doc, ICONS.paste, 'btn-primary', 'Paste & Run (F1)', 'paste-run');
                d.saveBtn = makeFooterBtn(doc, ICONS.save, 'btn-warning', 'Save (Ctrl+S)', 'save');
                pGroup.append(d.runBtn, pPaste, d.saveBtn);
                if (readOnly) pPaste.style.display = 'none';
                d.saveBtn.style.display = saveBtn.style.display;
                d.runBtn.addEventListener('click', () => run());
                pPaste.addEventListener('click', () => pasteAndRun(win));
                d.saveBtn.addEventListener('click', () => save());
                if (loading) setLoading(true);

                // Popup -> main
                let fromMain = false;
                let fromPopup = false;
                pEditor.session.on('change', () => {
                    if (fromMain) return;
                    fromPopup = true;
                    try {
                        const v = pEditor.getValue();
                        if (editor.getValue() !== v) editor.setValue(v, 1);
                    } finally { fromPopup = false; }
                });
                // Main -> popup
                d.mainListener = () => {
                    if (fromPopup || !d.editor || win.closed) return;
                    fromMain = true;
                    try {
                        const v = editor.getValue();
                        if (pEditor.getValue() !== v) {
                            const cursor = pEditor.getCursorPosition();
                            pEditor.setValue(v, -1);
                            pEditor.moveCursorToPosition(cursor);
                        }
                    } finally { fromMain = false; }
                };
                editor.session.on('change', d.mainListener);

                doc.addEventListener('keydown', (e) => {
                    if (e.key === 'F5' && !e.ctrlKey && !e.shiftKey && !e.metaKey) { e.preventDefault(); run(); }
                    else if (e.key === 'F1') { e.preventDefault(); pasteAndRun(win); }
                });
                win.addEventListener('pagehide', onDetachedClosed);
                win.addEventListener('beforeunload', onDetachedClosed);

                applyTheme();
                paintDetached();
                updateZoomDisplay();
                pEditor.focus();

                // Hide the main editor while detached
                wrap.style.display = 'none';
                const overlap = cmEl.closest('.edgar-overlap');
                if (overlap) overlap.style.display = 'none';
            };

            if (doc.readyState === 'complete') setup();
            else {
                win.addEventListener('load', setup);
                setTimeout(setup, 300); // some browsers don't fire load for document.write()n popups
            }
        }

        function paintDetached() {
            if (!detached || !detached.win || detached.win.closed) return;
            const p = uiPalette();
            const doc = detached.win.document;
            paintBars(Array.from(doc.querySelectorAll('.edgar-plus-toolbar, .edgar-plus-footer')));
            doc.body.style.backgroundColor = p.light ? '#ffffff' : '#272822';
        }

        function setLanguage(mode) {
            editor.session.setMode(mode);
            langSelect.value = mode;
            setSetting('mode', mode);
            if (detached && detached.editor) {
                detached.editor.session.setMode(mode);
                const pLang = detached.win.document.querySelector('.edgar-plus-lang-select');
                if (pLang) pLang.value = mode;
            }
        }

        // ---- Wire toolbar / footer ----
        langSelect.addEventListener('change', () => setLanguage(langSelect.value));
        toolbar.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-action]');
            if (!b) return;
            switch (b.dataset.action) {
                case 'zoom-in': setZoom(zoomPct() + 10); break;
                case 'zoom-out': setZoom(zoomPct() - 10); break;
                case 'detach': detach(); break;
                case 'history': toggleHistory(); break;
                case 'format': editor.execCommand('edgarPlusFormat'); break;
                case 'settings': toggleSidebar(); break;
                case 'archive':
                case 'cheatsheet':
                    if (EP.openArchive) EP.openArchive(b.dataset.action === 'cheatsheet' ? 'cheat' : 'archive');
                    else toast('Edgar+: The code archive is not loaded on this page.');
                    break;
            }
        });
        runBtn.addEventListener('click', () => run());
        pasteBtn.addEventListener('click', () => pasteAndRun());
        saveBtn.addEventListener('click', () => save());
        editor.on('focus', () => { activeInstance = inst; });

        // ---- Cheat sheet snippet insertion ----
        function insertSnippet(snip) {
            if (destroyed || readOnly) return { ok: false, reason: readOnly ? 'read-only' : 'gone' };
            addSnapshot(computeKey(), editor.getValue(), 'before-insert');
            const session = editor.session;
            const doc = session.getDocument();
            const tab = session.getTabString();
            let code = snip.code.replace(/\r\n?/g, '\n');
            let pos = editor.getCursorPosition();
            let where = 'cursor';
            const text = editor.getValue();
            const info = scanBlocks(text, doc.positionToIndex(pos));

            if (snip.kind === 'toplevel' && info.depth > 0 && info.blockStart >= 0) {
                // Functions/types can't go inside another function: put them above it.
                const open = doc.indexToPosition(info.blockStart);
                let row = open.row;
                if (!session.getLine(row).slice(0, open.column).trim() && row > 0) row--; // '{' on its own line
                pos = { row, column: 0 };
                code += '\n\n';
                where = 'above';
            } else if (snip.kind === 'toplevel' || snip.kind === 'program') {
                const line = session.getLine(pos.row);
                if (line.trim()) {
                    pos = { row: pos.row, column: line.length };
                    code = '\n\n' + code;
                } else {
                    pos = { row: pos.row, column: 0 };
                    if (line) doc.removeInLine(pos.row, 0, line.length);
                }
            } else {
                // Statements: match the indentation of where they are inserted.
                const line = session.getLine(pos.row);
                let indent;
                if (!line.trim()) {
                    indent = line || tab.repeat(info.depth);
                    if (line) doc.removeInLine(pos.row, 0, line.length);
                    pos = { row: pos.row, column: 0 };
                    code = code.split('\n').map(l => (l ? indent + l : l)).join('\n');
                } else {
                    indent = (line.match(/^\s*/) || [''])[0];
                    code = code.split('\n').map((l, i) => (i === 0 || !l ? l : indent + l)).join('\n');
                }
            }

            const end = doc.insert(pos, code);

            // Add missing #include lines at the top.
            const added = [];
            (snip.includes || []).forEach(h => {
                const re = new RegExp('^\\s*#\\s*include\\s*<' + h.replace(/\./g, '\\.') + '>', 'm');
                if (!re.test(editor.getValue())) added.push(h);
            });
            if (added.length) {
                let lastInclude = -1;
                for (let r = 0; r < session.getLength(); r++) {
                    if (/^\s*#\s*include\b/.test(session.getLine(r))) lastInclude = r;
                }
                const lines = added.map(h => `#include <${h}>`).join('\n');
                if (lastInclude >= 0) doc.insert({ row: lastInclude, column: session.getLine(lastInclude).length }, '\n' + lines);
                else doc.insert({ row: 0, column: 0 }, lines + '\n\n');
            }

            editor.clearSelection();
            const shift = added.length ? added.length + (/^\s*#\s*include\b/m.test(text) ? 0 : 1) : 0;
            editor.moveCursorTo(end.row + shift, end.column);
            editor.scrollToLine(pos.row + shift, true, true, () => {});
            editor.focus();
            activeInstance = inst;
            return { ok: true, where, added };
        }

        function onUnload() { closeDetached(); }
        window.addEventListener('beforeunload', onUnload);

        // ---- Teardown (Edgar+ switched off, or Angular removed the editor) ----
        function destroy(opts = {}) {
            if (destroyed) return;
            const connected = cmEl.isConnected;
            if (!opts.silent && connected) {
                try { syncToCM(); } catch (e) { /* ignore */ }
            }
            closeDetached();
            if (detached) onDetachedClosed();
            closeHistory();
            closeSnapshotModal();
            clearTimeout(runStateTimer);
            if (autoSnapTimer) {
                clearTimeout(autoSnapTimer);
                autoSnapTimer = null;
                if (connected) addSnapshot(currentKey, editor.getValue(), 'auto');
            }
            destroyed = true;
            window.removeEventListener('beforeunload', onUnload);
            clearTimeout(loadingTimer);
            clearTimeout(rainbowTimer);
            if (pendingRestoreToast) pendingRestoreToast();
            cm.off('change', onCMChange);
            editor.session.off('change', onEditorChange);
            try { editor.destroy(); } catch (e) { /* ignore */ }
            wrap.remove();
            styles.restore();
            scope.querySelectorAll('[data-edgar-plus-hidden]').forEach(b => delete b.dataset.edgarPlusHidden);
            if (connected) {
                try { cm.refresh(); } catch (e) { /* ignore */ }
            }
            delete textarea.dataset.edgarInitialized;
            instances.delete(inst);
            if (activeInstance === inst) activeInstance = null;
        }

        const inst = {
            id, editor, cm, scope,
            isConnected: () => !destroyed && cmEl.isConnected,
            run, pasteAndRun, save, checkOutput, destroy, insertSnippet, updateRunState, applyToolVisibility, formatCode,
            isReadOnly: () => readOnly,
            applyTheme, applyAllOptions, applyRainbow, paintDetached,
            get detachedWindow() { return detached && detached.win; }
        };

        // ---- Initial state ----
        applyAllOptions();
        applyTheme();
        applyRainbow();
        hideOriginalButtons();
        resolveIncoming(cm.getValue(), currentKey, { preferPage, initial: true });
        applyToolVisibility();
        editor.session.getUndoManager().reset();
        checkOutput();

        return inst;
    }

    function initEditor(textarea, preferPage) {
        if (!window.ace) return true; // nothing we can do; leave Edgar's editor alone
        const cmEl = textarea.closest('code-mirror') || textarea.parentElement;
        const oldUI = cmEl && cmEl.querySelector('.CodeMirror');
        const cm = oldUI && oldUI.CodeMirror;
        if (!cm) return false; // CodeMirror not created yet: retry on the next tick

        textarea.dataset.edgarInitialized = 'true';
        getExamId().then(examId => {
            if (!enabled || !cmEl.isConnected || textarea.dataset.edgarInitialized !== 'true') {
                delete textarea.dataset.edgarInitialized;
                return;
            }
            if (cmEl.querySelector('.edgar-plus-editor-wrap')) return;
            try {
                const inst = createInstance(textarea, cmEl, oldUI, cm, examId, preferPage);
                instances.add(inst);
                debugLog('Editor initialized', inst.id);
            } catch (err) {
                console.error('Edgar+: Failed to initialize the editor, falling back to Edgar\'s editor.', err);
                const partial = cmEl.querySelector('.edgar-plus-editor-wrap');
                if (partial) partial.remove();
                Array.from(cmEl.children).forEach(c => c.style.removeProperty('display'));
                findScope(cmEl).classList.add('edgar-plus-init-failed');
                try { cm.refresh(); } catch (e) { /* ignore */ }
            }
        });
        return true;
    }

    // ------------------------------------------------------------------
    // Sidebar (one per page, shared by all editors)
    // ------------------------------------------------------------------
    let sidebar = null;
    let sidebarOverlay = null;

    const EXAM_TOGGLES = [
        ['testDiff', 'Readable Test Diff', 'Line-by-line diff of expected vs. your output under Edgar\'s test results'],
        ['similarTasks', 'Similar Past Tasks', 'Suggests archived solutions that match the current exam task'],
        ['snapshots', 'Code History', 'Snapshots on Run, every 2 min of typing, and before code gets replaced'],
        ['runState', 'Run Status', 'Shows whether the code in the editor is the code you last ran'],
        ['questionTimer', 'Time per Question', 'Counts time spent on each exam question'],
        ['timeWarnings', 'Time Warnings', 'Notifies you at 15 and 5 minutes left']
    ];

    const TOGGLES = [
        ['vim', 'Vim Mode'],
        ['brackets', 'Auto-Close Brackets'],
        ['invisibles', 'Show Invisibles'],
        ['cleanOutput', 'Hide Output Marks'],
        ['hideTimer', 'Hide Timer'],
        ['rainbow', 'Rainbow Brackets'],
        ['highlightBrackets', 'Highlight Brackets']
    ];

    function ensureSidebar() {
        if (sidebar) return;
        sidebarOverlay = document.createElement('div');
        sidebarOverlay.className = 'edgar-plus-ui edgar-plus-sidebar-overlay';
        sidebar = document.createElement('div');
        sidebar.className = 'edgar-plus-ui';
        sidebar.id = 'edgar-plus-sidebar';
        const themeOptions = THEMES.map(([n, v]) => `<option value="${v}">${n}</option>`).join('');
        sidebar.innerHTML = `
            <div class="edgar-plus-sidebar-header">
                <span>Edgar+ Menu</span>
                <button type="button" class="edgar-plus-close-sidebar-btn">&times;</button>
            </div>
            <div class="edgar-plus-sidebar-content">
                <div class="edgar-plus-sidebar-section">Settings</div>
                <div class="edgar-plus-setting-item">
                    <span class="edgar-plus-setting-label">Theme</span>
                    <select class="edgar-plus-setting-theme">${themeOptions}</select>
                </div>
                ${TOGGLES.map(([name, label]) => `
                <div class="edgar-plus-setting-item">
                    <span class="edgar-plus-setting-label">${label}</span>
                    <label class="edgar-plus-switch">
                        <input type="checkbox" data-setting="${name}">
                        <span class="edgar-plus-slider"></span>
                    </label>
                </div>`).join('')}

                <div class="edgar-plus-sidebar-section">Exam Tools</div>
                ${EXAM_TOGGLES.map(([name, label, hint]) => `
                <div class="edgar-plus-setting-item" title="${hint}">
                    <span class="edgar-plus-setting-label">${label}</span>
                    <label class="edgar-plus-switch">
                        <input type="checkbox" data-setting="${name}">
                        <span class="edgar-plus-slider"></span>
                    </label>
                </div>`).join('')}

                <div class="edgar-plus-sidebar-section">Archive &amp; Cheat Sheet</div>
                <div class="edgar-plus-setting-item">
                    <button type="button" class="edgar-plus-sidebar-btn" data-action="archive">Search my past code <kbd>Ctrl+Shift+F</kbd></button>
                </div>
                <div class="edgar-plus-setting-item">
                    <button type="button" class="edgar-plus-sidebar-btn" data-action="cheatsheet">Cheat sheet (snippets, tables, terms)</button>
                </div>
                <div class="edgar-plus-setting-item">
                    <span class="edgar-plus-setting-label">Cheat Sheet Language</span>
                    <select class="edgar-plus-setting-lang">
                        <option value="hr">Hrvatski</option>
                        <option value="en">English</option>
                    </select>
                </div>

                <div class="edgar-plus-sidebar-section">Shortcuts</div>
                <div class="edgar-plus-shortcuts">
                    <div><kbd>F5</kbd> / <kbd>Ctrl+Enter</kbd> Run</div>
                    <div><kbd>F1</kbd> Paste &amp; Run</div>
                    <div><kbd>Ctrl+S</kbd> Save</div>
                    <div><kbd>Shift+Alt+F</kbd> Format code</div>
                    <div><kbd>Ctrl+P</kbd> Command palette</div>
                    <div><kbd>Ctrl+Shift+F</kbd> Archive / cheat sheet</div>
                </div>

                <div class="edgar-plus-sidebar-section">Links</div>
                <div class="edgar-plus-setting-item">
                    <a href="https://github.com/OctaNebula/edgar-plus" target="_blank" rel="noopener" class="edgar-plus-link">
                        <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
                        GitHub Repository
                    </a>
                </div>
            </div>`;
        document.body.appendChild(sidebarOverlay);
        document.body.appendChild(sidebar);

        const themeSelect = sidebar.querySelector('.edgar-plus-setting-theme');
        themeSelect.value = getSetting('theme');
        themeSelect.addEventListener('change', () => {
            setSetting('theme', themeSelect.value);
            applySetting('theme');
        });
        const langSelect = sidebar.querySelector('.edgar-plus-setting-lang');
        langSelect.value = getSetting('lang');
        langSelect.addEventListener('change', () => {
            setSetting('lang', langSelect.value);
            applySetting('lang');
        });
        sidebar.querySelectorAll('input[data-setting]').forEach(input => {
            input.checked = getSetting(input.dataset.setting);
            input.addEventListener('change', () => {
                setSetting(input.dataset.setting, input.checked);
                applySetting(input.dataset.setting);
            });
        });
        sidebar.querySelector('.edgar-plus-close-sidebar-btn').addEventListener('click', () => toggleSidebar(false));
        sidebarOverlay.addEventListener('click', () => toggleSidebar(false));
        sidebar.querySelectorAll('[data-action="archive"], [data-action="cheatsheet"]').forEach(btn => {
            btn.addEventListener('click', () => {
                toggleSidebar(false);
                if (EP.openArchive) EP.openArchive(btn.dataset.action === 'cheatsheet' ? 'cheat' : 'archive');
            });
        });
        paintSidebar();
    }

    function paintSidebar() {
        if (!sidebar) return;
        const p = uiPalette();
        sidebar.style.backgroundColor = p.bg;
        sidebar.style.color = p.fg;
        sidebar.style.borderLeftColor = p.border;
        sidebar.querySelectorAll('.edgar-plus-sidebar-header, .edgar-plus-setting-label, .edgar-plus-shortcuts').forEach(el => {
            el.style.setProperty('color', p.fg, 'important');
        });
        sidebar.querySelectorAll('.edgar-plus-sidebar-header, .edgar-plus-sidebar-section').forEach(el => {
            el.style.borderBottomColor = p.border;
        });
        sidebar.querySelectorAll('select').forEach(sel => {
            sel.style.backgroundColor = p.btnBg;
            sel.style.color = p.fg;
            sel.style.borderColor = p.btnBorder;
        });
    }

    function toggleSidebar(force) {
        ensureSidebar();
        const open = typeof force === 'boolean' ? force : !sidebar.classList.contains('open');
        if (open) {
            // Re-read settings in case they were changed in another tab
            sidebar.querySelector('.edgar-plus-setting-theme').value = getSetting('theme');
            sidebar.querySelector('.edgar-plus-setting-lang').value = getSetting('lang');
            sidebar.querySelectorAll('input[data-setting]').forEach(i => { i.checked = getSetting(i.dataset.setting); });
        }
        sidebar.classList.toggle('open', open);
        sidebarOverlay.classList.toggle('open', open);
    }

    function removeSidebar() {
        if (sidebar) sidebar.remove();
        if (sidebarOverlay) sidebarOverlay.remove();
        sidebar = null;
        sidebarOverlay = null;
    }

    function applySetting(name) {
        switch (name) {
            case 'theme':
                instances.forEach(i => { i.applyTheme(); i.paintDetached(); });
                paintSidebar();
                break;
            case 'fontSize':
            case 'vim':
            case 'brackets':
            case 'invisibles':
                instances.forEach(i => i.applyAllOptions());
                break;
            case 'rainbow':
                instances.forEach(i => i.applyRainbow());
                break;
            case 'highlightBrackets':
                applyHighlightBrackets();
                break;
            case 'cleanOutput':
                if (getSetting('cleanOutput')) cleanOutput();
                else restoreOutput();
                break;
            case 'hideTimer':
                updateTimer();
                break;
            case 'lang':
                if (EP.onLangChange) EP.onLangChange();
                break;
            case 'snapshots':
                instances.forEach(i => i.applyToolVisibility());
                break;
            case 'runState':
                instances.forEach(i => i.updateRunState());
                updateQuestionDots();
                break;
            case 'testDiff':
            case 'questionTimer':
            case 'timeWarnings':
                if (EP.onExamToolSetting) EP.onExamToolSetting(name);
                break;
            case 'similarTasks':
                if (EP.onSimilarSetting) EP.onSimilarSetting();
                break;
        }
    }

    function applyHighlightBrackets() {
        const hide = !getSetting('highlightBrackets');
        document.body.classList.toggle('edgar-hide-bracket-match', hide && enabled);
        instances.forEach(i => {
            const w = i.detachedWindow;
            if (w && !w.closed) w.document.body.classList.toggle('edgar-hide-bracket-match', hide);
        });
    }

    // ------------------------------------------------------------------
    // Output cleaning (replace · and ↵ markers in Edgar's output tables)
    // ------------------------------------------------------------------
    let isCleaning = false;
    const OUTPUT_SELECTOR = 'clang-result table.table-striped tr td:nth-child(3), table.code-results td.edgar-code';

    function getCleanedHtml(html) {
        return html ? html.replace(/·/g, ' ').replace(/↵/g, '') : html;
    }

    function cleanOutput() {
        if (isCleaning) return;
        isCleaning = true;
        try {
            document.querySelectorAll(OUTPUT_SELECTOR).forEach(cell => {
                const current = cell.innerHTML;
                if (cell.hasAttribute('data-original-html')) {
                    const expected = getCleanedHtml(cell.getAttribute('data-original-html'));
                    if (current !== expected) {
                        // Edgar replaced the content: clean the new content
                        cell.setAttribute('data-original-html', current);
                        cell.innerHTML = getCleanedHtml(current);
                    }
                } else {
                    const cleaned = getCleanedHtml(current);
                    if (cleaned !== current) {
                        cell.setAttribute('data-original-html', current);
                        cell.innerHTML = cleaned;
                    }
                }
            });
        } catch (e) {
            console.error('Edgar+: Clean output failed', e);
        } finally {
            isCleaning = false;
        }
    }

    function restoreOutput() {
        isCleaning = true;
        try {
            document.querySelectorAll('[data-original-html]').forEach(cell => {
                cell.innerHTML = cell.getAttribute('data-original-html');
                cell.removeAttribute('data-original-html');
            });
        } finally {
            isCleaning = false;
        }
    }

    // ------------------------------------------------------------------
    // Exam timer: progress bar + optional hiding
    // ------------------------------------------------------------------
    const timerStyles = createStyleLog();
    let styledTimer = null;

    function updateTimer() {
        const timer = document.getElementById('aii-countdown');
        if (!timer) return;
        if (!enabled) return;

        if (styledTimer !== timer) {
            timerStyles.restore();
            styledTimer = timer;
            timerStyles.set(timer, 'background-color', 'transparent');
            timerStyles.set(timer, 'color', '#000000');
            timerStyles.set(timer, 'border-radius', '4px');
            timerStyles.set(timer, 'padding', '5px 10px');
            timerStyles.set(timer, 'text-align', 'center');
            timerStyles.set(timer, 'min-width', '120px');
            timer.dataset.lastGradient = '';
        }

        const hide = getSetting('hideTimer');
        if (hide) {
            if (timer.style.display !== 'none') timerStyles.set(timer, 'display', 'none');
            return;
        } else if (timer.style.display === 'none') {
            timer.style.removeProperty('display');
        }

        const text = timer.textContent.trim();
        const timeMatch = text.match(/(?:(\d+):)?(\d+):(\d+)/);
        const dayMatch = text.match(/(\d+)\s+days?/i);
        let gradient = 'transparent';
        if (timeMatch) {
            let seconds = (timeMatch[1] ? parseInt(timeMatch[1], 10) : 0) * 3600 +
                parseInt(timeMatch[2], 10) * 60 + parseInt(timeMatch[3], 10);
            if (dayMatch) seconds += parseInt(dayMatch[1], 10) * 86400;

            let max;
            if (cachedExamId) {
                const key = 'edgar_timer_max_' + cachedExamId;
                max = parseInt(lsGet(key), 10);
                if (!max || seconds > max) {
                    max = seconds;
                    lsSet(key, String(max));
                }
            } else {
                if (!timer.dataset.maxSeconds || seconds > parseInt(timer.dataset.maxSeconds, 10)) {
                    timer.dataset.maxSeconds = String(seconds);
                }
                max = parseInt(timer.dataset.maxSeconds, 10);
            }
            const pct = max > 0 ? (seconds / max) * 100 : 0;
            const color = pct < 10 ? '#f92672' : (pct < 30 ? '#fd971f' : '#a6e22e');
            gradient = `linear-gradient(to right, ${color} ${pct}%, transparent ${pct}%) no-repeat bottom / 100% 4px`;
        }
        if (timer.dataset.lastGradient !== gradient) {
            timer.dataset.lastGradient = gradient;
            timerStyles.set(timer, 'background', gradient);
        }
    }

    function restoreTimer() {
        timerStyles.restore();
        if (styledTimer) {
            delete styledTimer.dataset.lastGradient;
            delete styledTimer.dataset.maxSeconds;
        }
        styledTimer = null;
    }

    // ------------------------------------------------------------------
    // Run status dots on Edgar's question chips (exam pages)
    // ------------------------------------------------------------------
    function updateQuestionDots() {
        const chips = document.querySelectorAll('question-navigation .aii-qn');
        if (!chips.length) return;
        const on = enabled && getSetting('runState') && cachedExamId && location.pathname.startsWith('/exam/run');
        chips.forEach(chip => {
            const m = chip.textContent.match(/\d+/);
            let state = null;
            if (on && m) {
                const d = readDraft(DRAFT_PREFIX + '/exam/run/' + m[0] + location.search + '_exam_' + cachedExamId);
                if (d && d.v === 2 && normalizeCode(d.code)) {
                    if (d.run == null) state = 'never';
                    else if (codeSignature(d.run) !== codeSignature(d.code)) state = 'dirty';
                }
            }
            const title = state === 'dirty' ? 'Edited since last run' : (state === 'never' ? 'Not run yet' : '');
            chip.classList.toggle('ep-qn-dirty', state === 'dirty');
            chip.classList.toggle('ep-qn-never', state === 'never');
            if ((chip.dataset.epRunTitle || '') !== title) {
                if (title) chip.dataset.epRunTitle = title;
                else delete chip.dataset.epRunTitle;
                if (EP.updateChipTitle) EP.updateChipTitle(chip);
                else if (title) chip.title = title;
            }
        });
    }

    // ------------------------------------------------------------------
    // Page watcher: one observer for new editors, output changes and the timer
    // ------------------------------------------------------------------
    let tickTimer = null;

    function tick() {
        tickTimer = null;
        if (!enabled) return;
        const prefer = preferPageCodeOnce;
        let pending = false;
        document.querySelectorAll('#codeMirrorEditor').forEach(ta => {
            if (ta.dataset.edgarInitialized) return;
            if (!initEditor(ta, prefer)) pending = true;
        });
        preferPageCodeOnce = false;
        instances.forEach(inst => {
            if (!inst.isConnected()) inst.destroy({ silent: true });
            else inst.checkOutput();
        });
        if (getSetting('cleanOutput')) cleanOutput();
        updateTimer();
        updateQuestionDots();
        if (pending) scheduleTick(200);
    }

    function scheduleTick(delay) {
        if (tickTimer) return;
        tickTimer = setTimeout(tick, delay == null ? 60 : delay);
    }

    const IGNORE_SELECTOR = '.ace_editor, .edgar-plus-ui, #edgar-plus-archive, #edgar-plus-toasts';
    const observer = new MutationObserver(records => {
        if (!enabled || tickTimer) return;
        for (const r of records) {
            const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
            if (!el || !el.closest(IGNORE_SELECTOR)) {
                scheduleTick();
                return;
            }
        }
    });

    function onGlobalKeydown(e) {
        if (!enabled || instances.size === 0) return;
        if (e.key === 'F5' && !e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
            e.preventDefault(); // don't reload the page by accident
            const a = getActive();
            if (a) a.run();
        } else if (e.key === 'F1') {
            e.preventDefault();
            const a = getActive();
            if (a) a.pasteAndRun();
        }
    }

    // ------------------------------------------------------------------
    // Live enable / disable (no page reload, no lost code)
    // ------------------------------------------------------------------
    function setStylesheetEnabled(on) {
        const link = document.getElementById('edgar-plus-styles');
        if (link) link.disabled = !on;
    }

    function disable() {
        if (!enabled) return;
        Array.from(instances).forEach(i => i.destroy());
        instances.clear();
        enabled = false;
        clearTimeout(tickTimer);
        tickTimer = null;
        removeSidebar();
        restoreTimer();
        restoreOutput();
        document.body.classList.remove('edgar-hide-bracket-match');
        document.querySelectorAll('.edgar-plus-init-failed').forEach(el => el.classList.remove('edgar-plus-init-failed'));
        updateQuestionDots(); // enabled is false now: clears the dots
        document.querySelectorAll('.edgar-plus-modal').forEach(m => m.remove());
        const toasts = document.getElementById('edgar-plus-toasts');
        if (toasts) toasts.remove();
        if (EP.archiveSetEnabled) EP.archiveSetEnabled(false);
        setStylesheetEnabled(false);
        debugLog('Disabled live.');
    }

    function enable() {
        if (enabled) return;
        enabled = true;
        setStylesheetEnabled(true);
        applyHighlightBrackets();
        preferPageCodeOnce = true;
        if (EP.archiveSetEnabled) EP.archiveSetEnabled(true);
        tick();
        debugLog('Enabled live.');
    }
    EP.isEnabled = () => enabled;

    window.addEventListener('message', (e) => {
        if (e.source !== window || !e.data || e.data.source !== 'edgar-plus-cs') return;
        switch (e.data.type) {
            case 'disable': disable(); break;
            case 'enable': enable(); break;
            case 'context-invalidated':
                if (enabled) toast('Edgar+ was updated or turned off in the browser. Reload the page when convenient.', { duration: 8000 });
                break;
        }
    });

    // ------------------------------------------------------------------
    // Start
    // ------------------------------------------------------------------
    try {
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            if ((localStorage.key(i) || '').startsWith(DRAFT_PREFIX)) count++;
        }
        if (count > MAX_DRAFTS) pruneDrafts(MAX_DRAFTS);
    } catch (e) { /* ignore */ }

    getExamId();
    applyHighlightBrackets();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('keydown', onGlobalKeydown);
    tick();
    debugLog('Main script running.');
})();
