// content.js — Edgar+ content script (isolated world).
// Injects Ace + Edgar+ into the page and relays enable/disable/archive requests to it.
const DEBUG = false;
function debugLog(...args) {
    if (DEBUG) console.log('Edgar+:', ...args);
}

const url = (p) => chrome.runtime.getURL(p);
let injected = false;
let active = false;

function post(type, extra) {
    window.postMessage(Object.assign({ source: 'edgar-plus-cs', type }, extra || {}), location.origin);
}

function loadScript(src, attrs) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        if (attrs) Object.entries(attrs).forEach(([k, v]) => { s.dataset[k] = v; });
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load ' + src));
        (document.body || document.head || document.documentElement).appendChild(s);
    });
}

async function inject(preferPageCode) {
    if (injected) return;
    injected = true;

    const link = document.createElement('link');
    link.id = 'edgar-plus-styles';
    link.rel = 'stylesheet';
    link.href = url('styles.css');
    (document.head || document.documentElement).appendChild(link);

    try {
        // Order matters: Ace core, then extensions, then Edgar+ itself.
        await loadScript(url('lib/ace/ace.js'));
        await loadScript(url('lib/ace/ext-language_tools.js'));
        await loadScript(url('lib/ace/ext-searchbox.js')); // required by Vim mode
        await loadScript(url('lib/ace/keybinding-vim.js'));
        await loadScript(url('lib/ace/theme-edgar_plus.js'));
    } catch (e) {
        console.error('Edgar+: Could not load the Ace editor.', e);
    }

    try {
        await loadScript(url('edgar_main.js'), {
            aceBasePath: url('lib/ace/'),
            iconPlay: url('icons/run.svg'),
            iconPaste: url('icons/paste_run.svg'),
            iconSave: url('icons/save.svg'),
            iconDetach: url('icons/detach.svg'),
            iconLoad: url('icons/load.svg'),
            styleUrl: url('styles.css'),
            preferPageCode: preferPageCode ? '1' : '0'
        });
        await loadScript(url('formatter.js'));
        await loadScript(url('exam_tools.js'));
        await loadScript(url('cheatsheet.js'));
        await loadScript(url('archive.js'));
        debugLog('Injected.');
    } catch (e) {
        console.error('Edgar+: Injection failed.', e);
    }
}

// Switching Edgar+ on/off from the popup applies immediately, without reloading the page,
// so nothing typed in the editor can be lost.
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local' || !changes.edgarPlusEnabled) return;
    const on = changes.edgarPlusEnabled.newValue !== false;
    if (on === active) return;
    active = on;
    if (on) {
        if (!injected) inject(true);
        else post('enable');
    } else if (injected) {
        post('disable');
    }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'edgar-plus-open-archive') {
        if (active && injected) post('open-archive', { tab: msg.tab === 'cheat' ? 'cheat' : 'archive' });
        sendResponse({ ok: active && injected });
    }
});

chrome.storage.local.get(['edgarPlusEnabled'], (result) => {
    if (result.edgarPlusEnabled === false) {
        debugLog('Extension is disabled by user.');
        return;
    }
    active = true;
    inject(false);
});

// When the extension is updated or removed, this content script is orphaned. Edgar+ keeps working
// in the page; just let the user know a reload will pick up the change. Never reload by force:
// that could happen in the middle of an exam.
const lifecycleInterval = setInterval(() => {
    let invalidated = false;
    try {
        invalidated = !chrome.runtime || !chrome.runtime.id;
    } catch (e) {
        invalidated = true;
    }
    if (invalidated) {
        clearInterval(lifecycleInterval);
        if (injected) post('context-invalidated');
    }
}, 2000);
