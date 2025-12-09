// edgar_main.js
const DEBUG = false;
function debugLog(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

debugLog("Edgar+ Main Script Running (v2)");

// Capture dataset params immediately at top level
const myScript = document.currentScript;
const aceBasePath = myScript && myScript.dataset.aceBasePath;
const browserType = myScript && myScript.dataset.browser;
const iconPlayUrl = myScript && myScript.dataset.iconPlay;
const iconPasteUrl = myScript && myScript.dataset.iconPaste;
const iconSaveUrl = myScript && myScript.dataset.iconSave;
const iconDetachUrl = myScript && myScript.dataset.iconDetach;
const iconLoadUrl = myScript && myScript.dataset.iconLoad;
const styleUrl = myScript && myScript.dataset.styleUrl;

debugLog("Edgar+ Params:", { aceBasePath, browserType, iconPlayUrl, iconPasteUrl, iconSaveUrl, iconDetachUrl, iconLoadUrl, styleUrl });

function waitForElement(selector, callback) {
    const element = document.querySelector(selector);
    if (element) {
        callback(element);
        return;
    }

    const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
            obs.disconnect();
            callback(element);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function initAce(originalTextarea) {
    debugLog("Edgar+: Found original editor:", originalTextarea);

    let isSyncing = false;

    function getStorageKey() {
        return 'edgar_plus_code_' + window.location.pathname + window.location.search;
    }

    // The structure is:
    // <code-mirror>
    //    <div><textarea id="codeMirrorEditor"></div>
    //    <div class="CodeMirror">...</div>
    // </code-mirror>
    
    // We want to hide the CodeMirror UI
    const codeMirrorElement = originalTextarea.closest('code-mirror');
    const oldUI = codeMirrorElement ? codeMirrorElement.querySelector('.CodeMirror') : null;

    // Remove border/outline from the original container
    if (codeMirrorElement) {
        codeMirrorElement.style.setProperty('border', 'none', 'important');
        codeMirrorElement.style.setProperty('box-shadow', 'none', 'important');
        codeMirrorElement.style.setProperty('outline', 'none', 'important');
        codeMirrorElement.style.setProperty('padding', '0', 'important');
        codeMirrorElement.style.setProperty('background', 'transparent', 'important');

        // Hide ALL children except our new ones
        Array.from(codeMirrorElement.children).forEach(child => {
            if (child.id !== 'edgar-plus-toolbar' && 
                child.id !== 'edgar-plus-ace-editor' && 
                child.id !== 'edgar-plus-footer') {
                child.style.display = 'none';
            }
        });
    }

    // Also try the direct parent of the old UI, just in case it's an inner wrapper
    if (oldUI && oldUI.parentNode) {
         oldUI.parentNode.style.setProperty('border', 'none', 'important');
         oldUI.parentNode.style.setProperty('box-shadow', 'none', 'important');
         oldUI.parentNode.style.setProperty('background', 'transparent', 'important');
         oldUI.parentNode.style.setProperty('padding', '0', 'important');
    }

    // Capture height BEFORE hiding
    let editorHeight = '500px'; // Default fallback
    if (oldUI && oldUI.offsetHeight > 0) {
        editorHeight = oldUI.offsetHeight + 'px';
    }

    if (oldUI) {
        oldUI.style.display = 'none';
    } else {
        console.warn("Edgar+: Could not find .CodeMirror UI to hide.");
    }

    // Create the container for Ace
    const aceContainer = document.createElement('div');
    aceContainer.id = 'edgar-plus-ace-editor';
    
    // Style it to match the container
    aceContainer.style.width = '100%';
    // Height is handled by minLines/maxLines in Ace options
    aceContainer.style.fontSize = '14px';

    // --- TOOLBAR CREATION ---
    const toolbar = document.createElement('div');
    toolbar.id = 'edgar-plus-toolbar';
    toolbar.innerHTML = `
        <span>Language:</span>
        <select id="edgar-plus-lang-select">
            <option value="ace/mode/c_cpp">C / C++</option>
            <option value="ace/mode/java">Java</option>
            <option value="ace/mode/sql">SQL</option>
        </select>
        <span style="margin-left: auto;">Zoom:</span>
        <button id="edgar-plus-zoom-out" class="edgar-plus-square-btn edgar-plus-sm-btn" data-tooltip="Zoom Out">-</button>
        <span id="edgar-plus-zoom-level">100%</span>
        <button id="edgar-plus-zoom-in" class="edgar-plus-square-btn edgar-plus-sm-btn" data-tooltip="Zoom In">+</button>
        <button id="edgar-plus-detach-btn" class="edgar-plus-square-btn" data-tooltip="Detach Editor">
            <img src="${iconDetachUrl}" width="16" height="16" style="display: block;">
        </button>
        <button id="edgar-plus-settings-btn" class="edgar-plus-square-btn" data-tooltip="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
        </button>
    `;

    // Insert Toolbar AND Ace
    if (oldUI) {
        oldUI.parentNode.insertBefore(toolbar, oldUI);
        oldUI.parentNode.insertBefore(aceContainer, oldUI);
    } else {
        originalTextarea.parentNode.appendChild(toolbar);
        originalTextarea.parentNode.appendChild(aceContainer);
    }

    // --- TIMER ENHANCEMENT ---
    function enhanceTimer() {
        const timer = document.getElementById('aii-countdown');
        if (!timer) return;

        // Ensure we have our progress bar
        let progressBar = timer.querySelector('.edgar-timer-progress');
        if (!progressBar) {
            // Create container for text and bar if needed, or just append bar
            // The timer usually contains just text.
            // Let's make the timer position relative so we can place the bar absolutely at bottom
            timer.style.position = 'relative';
            timer.style.overflow = 'hidden'; // To clip the bar
            
            progressBar = document.createElement('div');
            progressBar.className = 'edgar-timer-progress';
            timer.appendChild(progressBar);
        }

        // Parse time
        // Format: HH:MM:SS
        // The text node is usually the first child, but let's be safe
        const textNode = Array.from(timer.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim().length > 0);
        if (!textNode) return;

        const text = textNode.nodeValue.trim();
        const parts = text.split(':').map(Number);
        if (parts.length === 3) {
            const seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            
            // Store max time if not set
            // We assume the first time we see is the max (or close to it)
            // If the user refreshes, it resets to "full" relative to that moment.
            if (!timer.dataset.maxSeconds) {
                 timer.dataset.maxSeconds = seconds;
            }

            const max = parseInt(timer.dataset.maxSeconds);
            // Prevent division by zero
            const pct = max > 0 ? (seconds / max) * 100 : 0;
            
            progressBar.style.width = pct + '%';
            
            // Color change based on percentage
            if (pct < 10) {
                progressBar.style.backgroundColor = '#f92672'; // Red
            } else if (pct < 30) {
                progressBar.style.backgroundColor = '#fd971f'; // Orange
            } else {
                progressBar.style.backgroundColor = '#a6e22e'; // Green
            }
        }
    }

    // Observe timer for changes to update bar
    waitForElement('#aii-countdown', (timer) => {
        enhanceTimer(); // Initial run
        updateTimerVisibility(); // Ensure visibility is correct
        const timerObserver = new MutationObserver(() => {
            enhanceTimer();
            // We don't need to call updateTimerVisibility here constantly unless the app resets style
            // But enhanceTimer doesn't touch display.
            // However, if the app re-renders the timer, it might lose the display:none style.
            // So let's enforce it.
            updateTimerVisibility();
        });
        timerObserver.observe(timer, { childList: true, characterData: true, subtree: true });
    });

    // --- FOOTER & BUTTON MIGRATION ---
    const footer = document.createElement('div');
    footer.id = 'edgar-plus-footer';
    
    // Insert footer after Ace container
    aceContainer.parentNode.insertBefore(footer, aceContainer.nextSibling);

    // Create Button Group
    const btnGroup = document.createElement('div');
    btnGroup.className = 'edgar-plus-btn-group';
    footer.appendChild(btnGroup);

    // Helper to create button
    function createBtn(iconUrl, colorClass, title, onClick) {
        const btn = document.createElement('button');
        // Use Bootstrap classes + our custom class
        btn.className = `btn ${colorClass} edgar-plus-square-btn`;
        // Use data-tooltip instead of title to prevent default browser tooltip
        btn.setAttribute('data-tooltip', title);
        // Use img tag for SVG icons
        const img = document.createElement('img');
        img.src = iconUrl;
        img.style.width = '24px';
        img.style.height = '24px';
        
        btn.appendChild(img);
        btn.addEventListener('click', onClick);
        return btn;
    }

    // Move/Hide buttons and create new ones
    
    // Refactored replacement logic
    function replaceButtons() {
        const runBtnOriginal = document.querySelector('button[title="Ctrl+Enter"]');
        const allButtons = Array.from(document.querySelectorAll('button'));
        const saveBtnOriginal = allButtons.find(b => b.textContent.trim() === 'Save');

        if (runBtnOriginal || saveBtnOriginal) {
            debugLog("Edgar+: Replacing buttons immediately.");
            if (runBtnOriginal) runBtnOriginal.style.display = 'none';
            if (saveBtnOriginal) saveBtnOriginal.style.display = 'none';

            // Clear existing to prevent duplicates if called multiple times
            btnGroup.innerHTML = '';

            const runBtnNew = createBtn(iconPlayUrl, 'btn-success', 'Run (F5)', () => {
                 syncToCodeMirror();
                 clearAllAnnotations();
                 if (runBtnOriginal) runBtnOriginal.click();
            });

            const pasteRunBtn = createBtn(iconPasteUrl, 'btn-primary', 'Paste & Run (F1)', () => {
                 if (navigator.clipboard && navigator.clipboard.readText) {
                    navigator.clipboard.readText().then(text => {
                        if (text) {
                            editor.setValue(text, -1);
                            syncToCodeMirror();
                            clearAllAnnotations();
                            if (runBtnOriginal) runBtnOriginal.click();
                        }
                    }).catch(err => {
                        console.error("Edgar+: Clipboard error:", err);
                        alert("Edgar+: Please allow clipboard access.");
                    });
                 }
            });

            const saveBtnNew = createBtn(iconSaveUrl, 'btn-warning', 'Save', () => {
                 syncToCodeMirror();
                 if (saveBtnOriginal) saveBtnOriginal.click();
            });

            btnGroup.appendChild(runBtnNew);
            btnGroup.appendChild(pasteRunBtn);
            btnGroup.appendChild(saveBtnNew);
            
            return true; // Success
        }
        return false;
    }

    // Try immediately
    if (!replaceButtons()) {
        // If not found, observe
        const buttonObserver = new MutationObserver((mutations, obs) => {
            if (replaceButtons()) {
                obs.disconnect();
            }
        });
        buttonObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Initialize Ace
    if (aceBasePath) {
        debugLog("Edgar+: Setting Ace base path to:", aceBasePath);
        ace.config.set('basePath', aceBasePath);
        ace.config.set('modePath', aceBasePath);
        ace.config.set('themePath', aceBasePath);
        ace.config.set('workerPath', aceBasePath);
    } else {
        console.warn("Edgar+: Base path not set. Autocomplete might fail.");
    }

    const langTools = ace.require("ace/ext/language_tools");
    if (!langTools) {
        console.error("Edgar+: Language tools module not found! Autocomplete will not work.");
    } else {
        debugLog("Edgar+: Language tools loaded successfully.");
    }

    const editor = ace.edit("edgar-plus-ace-editor");
    editor.setTheme("ace/theme/monokai");
    
    // Enable Autocompletion & Auto-sizing
    editor.setOptions({
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        enableSnippets: true,
        minLines: 15,
        maxLines: Infinity,
        showPrintMargin: false,
        fontFamily: "Consolas, 'Courier New', monospace" // Force Consolas
    });

    // --- SETTINGS MODAL ---
    const themes = [
        { name: "Ambiance", value: "ace/theme/ambiance" },
        { name: "Chaos", value: "ace/theme/chaos" },
        { name: "Chrome", value: "ace/theme/chrome" },
        { name: "Clouds", value: "ace/theme/clouds" },
        { name: "Clouds Midnight", value: "ace/theme/clouds_midnight" },
        { name: "Cobalt", value: "ace/theme/cobalt" },
        { name: "Crimson Editor", value: "ace/theme/crimson_editor" },
        { name: "Dawn", value: "ace/theme/dawn" },
        { name: "Dracula", value: "ace/theme/dracula" },
        { name: "Dreamweaver", value: "ace/theme/dreamweaver" },
        { name: "Eclipse", value: "ace/theme/eclipse" },
        { name: "GitHub", value: "ace/theme/github" },
        { name: "Gob", value: "ace/theme/gob" },
        { name: "Gruvbox", value: "ace/theme/gruvbox" },
        { name: "Idle Fingers", value: "ace/theme/idle_fingers" },
        { name: "IPlastic", value: "ace/theme/iplastic" },
        { name: "Katzenmilch", value: "ace/theme/katzenmilch" },
        { name: "KR Theme", value: "ace/theme/kr_theme" },
        { name: "Kuroir", value: "ace/theme/kuroir" },
        { name: "Merbivore", value: "ace/theme/merbivore" },
        { name: "Merbivore Soft", value: "ace/theme/merbivore_soft" },
        { name: "Monokai", value: "ace/theme/monokai" },
        { name: "Mono Industrial", value: "ace/theme/mono_industrial" },
        { name: "Pastel on dark", value: "ace/theme/pastel_on_dark" },
        { name: "Solarized Dark", value: "ace/theme/solarized_dark" },
        { name: "Solarized Light", value: "ace/theme/solarized_light" },
        { name: "SQL Server", value: "ace/theme/sqlserver" },
        { name: "Terminal", value: "ace/theme/terminal" },
        { name: "TextMate", value: "ace/theme/textmate" },
        { name: "Tomorrow", value: "ace/theme/tomorrow" },
        { name: "Tomorrow Night", value: "ace/theme/tomorrow_night" },
        { name: "Tomorrow Night Blue", value: "ace/theme/tomorrow_night_blue" },
        { name: "Tomorrow Night Bright", value: "ace/theme/tomorrow_night_bright" },
        { name: "Tomorrow Night 80s", value: "ace/theme/tomorrow_night_eighties" },
        { name: "Twilight", value: "ace/theme/twilight" },
        { name: "Vibrant Ink", value: "ace/theme/vibrant_ink" },
        { name: "Xcode", value: "ace/theme/xcode" }
    ];

    const themeOptions = themes.map(t => `<option value="${t.value}">${t.name}</option>`).join('');

    const modal = document.createElement('div');
    modal.id = 'edgar-plus-settings-modal';
    modal.innerHTML = `
        <div class="edgar-plus-modal-content">
            <div class="edgar-plus-modal-header">
                <span class="edgar-plus-modal-title">Edgar+ Settings</span>
                <button class="edgar-plus-close-btn">&times;</button>
            </div>
            <div class="edgar-plus-modal-body">
                <div class="edgar-plus-setting-item">
                    <span class="edgar-plus-setting-label">Theme</span>
                    <select id="edgar-plus-setting-theme" style="background: #444; color: #fff; border: 1px solid #555; border-radius: 3px; padding: 2px 5px;">
                        ${themeOptions}
                    </select>
                </div>
                <div class="edgar-plus-setting-item">
                    <span class="edgar-plus-setting-label">Vim Mode</span>
                    <label class="edgar-plus-switch">
                        <input type="checkbox" id="edgar-plus-setting-vim">
                        <span class="edgar-plus-slider"></span>
                    </label>
                </div>
                <div class="edgar-plus-setting-item">
                    <span class="edgar-plus-setting-label">Auto-Close Brackets</span>
                    <label class="edgar-plus-switch">
                        <input type="checkbox" id="edgar-plus-setting-brackets" checked>
                        <span class="edgar-plus-slider"></span>
                    </label>
                </div>
                 <div class="edgar-plus-setting-item">
                    <span class="edgar-plus-setting-label">Show Invisibles</span>
                    <label class="edgar-plus-switch">
                        <input type="checkbox" id="edgar-plus-setting-invisibles">
                        <span class="edgar-plus-slider"></span>
                    </label>
                </div>
                <div class="edgar-plus-setting-item">
                    <span class="edgar-plus-setting-label">Hide Output Marks</span>
                    <label class="edgar-plus-switch">
                        <input type="checkbox" id="edgar-plus-setting-clean-output">
                        <span class="edgar-plus-slider"></span>
                    </label>
                </div>
                <div class="edgar-plus-setting-item">
                    <span class="edgar-plus-setting-label">Hide Timer</span>
                    <label class="edgar-plus-switch">
                        <input type="checkbox" id="edgar-plus-setting-hide-timer">
                        <span class="edgar-plus-slider"></span>
                    </label>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const settingsBtn = toolbar.querySelector('#edgar-plus-settings-btn');
    const closeBtn = modal.querySelector('.edgar-plus-close-btn');
    const themeSelect = modal.querySelector('#edgar-plus-setting-theme');
    const vimToggle = modal.querySelector('#edgar-plus-setting-vim');
    const bracketsToggle = modal.querySelector('#edgar-plus-setting-brackets');
    const invisiblesToggle = modal.querySelector('#edgar-plus-setting-invisibles');
    const cleanOutputToggle = modal.querySelector('#edgar-plus-setting-clean-output');
    const hideTimerToggle = modal.querySelector('#edgar-plus-setting-hide-timer');
    const langSelect = toolbar.querySelector('#edgar-plus-lang-select');
    const zoomInBtn = toolbar.querySelector('#edgar-plus-zoom-in');
    const zoomOutBtn = toolbar.querySelector('#edgar-plus-zoom-out');
    const zoomLevelSpan = toolbar.querySelector('#edgar-plus-zoom-level');
    const detachBtn = toolbar.querySelector('#edgar-plus-detach-btn');

    // --- DETACH LOGIC ---
    let detachedWindow = null;
    let isUpdatingFromPopup = false;
    let isUpdatingFromMain = false;

    detachBtn.addEventListener('click', () => {
        if (detachedWindow && !detachedWindow.closed) {
            detachedWindow.focus();
            return;
        }

        const width = 800;
        const height = 600;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;

        // Gather all stylesheets from the main page to ensure consistent styling (Bootstrap, fonts, etc.)
        const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .map(link => `<link rel="stylesheet" href="${link.href}">`)
            .join('\n');

        // Capture fonts from main window
        const mainBodyFont = window.getComputedStyle(document.body).fontFamily;
        const mainAceFont = window.getComputedStyle(editor.container).fontFamily;

        // Hide the overlap border in main window
        const overlapContainer = document.querySelector('.edgar-overlap');
        if (overlapContainer) {
            overlapContainer.style.display = 'none';
        }

        detachedWindow = window.open("", "EdgarPlusDetached", `width=${width},height=${height},left=${left},top=${top}`);
        
        if (!detachedWindow) {
            // If popup blocked, restore
            if (overlapContainer) overlapContainer.style.display = '';
            return;
        }

        // Build Popup Content
        const doc = detachedWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Edgar+ Editor</title>
                ${cssLinks}
                <link rel="stylesheet" href="${styleUrl}">
                <style>
                    body { 
                        margin: 0; 
                        padding: 0; 
                        background-color: #272822; 
                        display: flex; 
                        flex-direction: column; 
                        height: 100vh; 
                        overflow: hidden;
                        font-family: ${mainBodyFont}; 
                    }
                    #edgar-plus-ace-editor { flex: 1; }
                    #edgar-plus-toolbar { 
                        display: flex; 
                        align-items: center; 
                        padding: 8px 10px; 
                        background-color: #2f3129; 
                        border-bottom: 1px solid #444; 
                        box-sizing: border-box;
                        gap: 10px;
                        position: relative;
                        z-index: 10;
                    }
                    #edgar-plus-footer { 
                        display: flex; 
                        justify-content: flex-end; 
                        align-items: center;
                        padding: 10px; 
                        background-color: #2f3129; 
                        border-top: 1px solid #444; 
                        min-height: 50px;
                        box-sizing: border-box;
                    }
                    .toolbar-label { color: #ccc; margin-right: 10px; font-size: 14px; }
                    .toolbar-spacer { flex: 1; }
                    
                    /* --- INLINED STYLES FROM styles.css --- */
                    
                    /* Toolbar Buttons */
                    #edgar-plus-toolbar button {
                        padding: 2px 8px;
                        cursor: pointer;
                        border: 1px solid #555;
                        border-radius: 3px;
                        background-color: #444;
                        color: #f8f8f2;
                        font-weight: bold;
                    }
                    #edgar-plus-toolbar button:hover {
                        background-color: #555;
                    }

                    /* Square Buttons (Toolbar & Footer) */
                    .edgar-plus-square-btn {
                        width: 40px;
                        height: 40px;
                        padding: 0 !important;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 4px;
                        font-size: 18px;
                        transition: opacity 0.2s;
                        margin-left: 0;
                    }

                    #edgar-plus-reattach-btn {
                        margin-left: 10px;
                    }
                    .edgar-plus-square-btn:hover {
                        opacity: 0.9;
                    }
                    .edgar-plus-square-btn i {
                        pointer-events: none;
                    }

                    /* Small Buttons (Zoom) */
                    .edgar-plus-sm-btn {
                        width: auto;
                        min-width: 30px;
                        height: 30px;
                        font-size: 16px;
                        padding: 0 8px !important;
                    }

                    /* Loading State */
                    .edgar-plus-square-btn.edgar-loading {
                        opacity: 0.7;
                        cursor: wait;
                    }
                    @keyframes edgar-spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(-360deg); }
                    }
                    .edgar-spin {
                        animation: edgar-spin 1s linear infinite;
                    }

                    /* Fix Autocomplete Font in Detached Window */
                    .ace_editor.ace_autocomplete {
                        font-family: "Consolas", "Courier New", monospace !important;
                    }

                    /* Tooltips */
                    .edgar-plus-square-btn {
                        position: relative;
                    }
                    .edgar-plus-square-btn::after {
                        content: attr(data-tooltip);
                        position: absolute;
                        bottom: 120%;
                        left: 50%;
                        transform: translateX(-50%) translateY(10px);
                        background-color: #2F3129;
                        color: #f8f8f2;
                        padding: 6px 10px;
                        border-radius: 4px;
                        font-size: 12px;
                        white-space: nowrap;
                        opacity: 0;
                        visibility: hidden;
                        transition: all 0.2s ease;
                        pointer-events: none;
                        z-index: 1000;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                        border: 1px solid #444;
                    }
                    .edgar-plus-square-btn::before {
                        content: '';
                        position: absolute;
                        bottom: 120%;
                        left: 50%;
                        transform: translateX(-50%) translateY(10px);
                        border: 6px solid transparent;
                        border-top-color: #2F3129;
                        opacity: 0;
                        visibility: hidden;
                        transition: all 0.2s ease;
                        pointer-events: none;
                        z-index: 1000;
                        margin-bottom: -11px;
                    }
                    .edgar-plus-square-btn:hover::after,
                    .edgar-plus-square-btn:hover::before {
                        opacity: 1;
                        visibility: visible;
                        transform: translateX(-50%) translateY(0);
                    }

                    /* Toolbar Tooltips (Below) to prevent clipping */
                    #edgar-plus-toolbar .edgar-plus-square-btn::after {
                        bottom: auto;
                        top: 120%;
                        transform: translateX(-50%) translateY(-10px);
                    }
                    #edgar-plus-toolbar .edgar-plus-square-btn::before {
                        bottom: auto;
                        top: 120%;
                        transform: translateX(-50%) translateY(-10px);
                        border-top-color: transparent;
                        border-bottom-color: #2F3129;
                        margin-bottom: 0;
                        margin-top: -11px;
                    }
                    #edgar-plus-toolbar .edgar-plus-square-btn:hover::after,
                    #edgar-plus-toolbar .edgar-plus-square-btn:hover::before {
                        transform: translateX(-50%) translateY(0);
                    }
                    
                    /* Select styling */
                    #edgar-plus-lang-select {
                        background-color: #444;
                        color: #fff;
                        border: 1px solid #555;
                        border-radius: 3px;
                        padding: 2px 5px;
                        height: 26px;
                    }

                    .reattach-icon { transform: rotate(180deg); display: block; filter: brightness(0) invert(1); }
                    
                    /* Footer button group spacing */
                    .edgar-plus-btn-group {
                        display: flex;
                        gap: 10px;
                    }
                </style>
            </head>
            <body>
                <!-- Toolbar -->
                <div id="edgar-plus-toolbar">
                    <span class="toolbar-label">Language:</span>
                    <select id="edgar-plus-lang-select">
                        <option value="ace/mode/c_cpp">C / C++</option>
                        <option value="ace/mode/java">Java</option>
                        <option value="ace/mode/sql">SQL</option>
                    </select>
                    
                    <div class="toolbar-spacer"></div>
                    
                    <span class="toolbar-label">Zoom:</span>
                    <button id="edgar-plus-zoom-out" class="edgar-plus-square-btn edgar-plus-sm-btn" data-tooltip="Zoom Out">-</button>
                    <span id="edgar-plus-zoom-level">100%</span>
                    <button id="edgar-plus-zoom-in" class="edgar-plus-square-btn edgar-plus-sm-btn" data-tooltip="Zoom In">+</button>
                    <button id="edgar-plus-reattach-btn" class="edgar-plus-square-btn edgar-plus-sm-btn" data-tooltip="Reattach" style="margin-left: 15px;">
                        <img src="${iconDetachUrl}" class="reattach-icon" width="16" height="16">
                    </button>
                </div>
                
                <!-- Editor -->
                <div id="edgar-plus-ace-editor"></div>

                <!-- Footer (Buttons) -->
                <div id="edgar-plus-footer">
                    <div class="edgar-plus-btn-group">
                        <!-- Buttons will be added by JS -->
                    </div>
                </div>

                <!-- Scripts -->
                <script src="${aceBasePath}ace.js"></script>
                <script src="${aceBasePath}ext-language_tools.js"></script>
                <script src="${aceBasePath}ext-searchbox.js"></script>
                <script src="${aceBasePath}keybinding-vim.js"></script>
            </body>
            </html>
        `);
        doc.close();

        // Wait for scripts to load in popup
        detachedWindow.onload = () => {
            const popupAce = detachedWindow.ace;
            const popupEditor = popupAce.edit("edgar-plus-ace-editor");
            detachedWindow.edgarEditor = popupEditor; // Expose for main window
            
            // Sync Theme
            const currentTheme = localStorage.getItem('edgar_plus_theme') || 'ace/theme/monokai';
            popupEditor.setTheme(currentTheme);
            
            // Sync mode
            const currentMode = langSelect.value;
            popupEditor.session.setMode(currentMode); 
            popupEditor.setValue(editor.getValue(), -1); // Sync content
            
            // Sync Settings
            popupEditor.setOptions({
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true,
                enableSnippets: true,
                fontSize: editor.getFontSize(),
                showPrintMargin: false,
                fontFamily: "Consolas, 'Courier New', monospace" // Force Consolas
            });
            
            if (editor.getKeyboardHandler() === "ace/keyboard/vim") {
                popupEditor.setKeyboardHandler("ace/keyboard/vim");
            }

            // --- WIRE UP POPUP UI ---
            const pDoc = detachedWindow.document;
            const pLangSelect = pDoc.getElementById('edgar-plus-lang-select');
            const pZoomIn = pDoc.getElementById('edgar-plus-zoom-in');
            const pZoomOut = pDoc.getElementById('edgar-plus-zoom-out');
            const pZoomLevel = pDoc.getElementById('edgar-plus-zoom-level');
            
            const BASE_FONT_SIZE = 14;

            function getPopupZoomPercentage() {
                const size = parseFloat(popupEditor.getFontSize()) || BASE_FONT_SIZE;
                return Math.round((size / BASE_FONT_SIZE) * 100);
            }

            function setPopupZoom(percentage) {
                if (percentage < 10) percentage = 10; // Minimum safety
                const newSize = (percentage / 100) * BASE_FONT_SIZE;
                popupEditor.setFontSize(newSize);
                editor.setFontSize(newSize); // Sync to main
                localStorage.setItem('edgar_plus_fontsize', newSize);
                updatePopupZoomDisplay();
                if (typeof updateZoomDisplay === 'function') updateZoomDisplay();
            }

            function updatePopupZoomDisplay() {
                const percentage = getPopupZoomPercentage();
                if (pZoomLevel) pZoomLevel.textContent = `${percentage}%`;
            }
            updatePopupZoomDisplay();

            // Make zoom span interactive
            if (pZoomLevel) {
                pZoomLevel.style.cursor = 'pointer';
                pZoomLevel.title = 'Click to set custom zoom';
                pZoomLevel.style.minWidth = '40px';
                pZoomLevel.style.textAlign = 'center';
                pZoomLevel.style.fontFamily = 'monospace';
                pZoomLevel.style.color = '#fff';
                
                pZoomLevel.addEventListener('click', () => {
                    if (pZoomLevel.querySelector('input')) return; // Already editing

                    const currentPct = getPopupZoomPercentage();
                    const input = pDoc.createElement('input');
                    input.type = 'text';
                    input.value = currentPct;
                    // Style to match toolbar
                    input.style.width = '40px';
                    input.style.background = '#2F3129';
                    input.style.color = '#fff';
                    input.style.border = '1px solid #555';
                    input.style.borderRadius = '3px';
                    input.style.textAlign = 'center';
                    input.style.fontSize = '12px';
                    input.style.padding = '0';
                    input.style.height = '18px';

                    pZoomLevel.textContent = '';
                    pZoomLevel.appendChild(input);
                    input.focus();
                    input.select();

                    const finish = () => {
                        let val = input.value.trim();
                        // Remove % if present
                        val = val.replace('%', '');
                        let num = parseInt(val, 10);
                        
                        if (!isNaN(num)) {
                            setPopupZoom(num);
                        } else {
                            updatePopupZoomDisplay(); // Revert
                        }
                    };

                    input.addEventListener('blur', finish);
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            input.blur();
                        } else if (e.key === 'Escape') {
                            updatePopupZoomDisplay();
                        }
                    });
                });
            }

            // Sync Language
            pLangSelect.value = langSelect.value;
            pLangSelect.addEventListener('change', (e) => {
                const mode = e.target.value;
                popupEditor.session.setMode(mode);
                // Sync back to main
                langSelect.value = mode;
                editor.session.setMode(mode);
                localStorage.setItem('edgar_plus_mode', mode);
            });

            // Zoom Buttons
            pZoomIn.addEventListener('click', () => {
                const currentPct = getPopupZoomPercentage();
                setPopupZoom(currentPct + 5);
            });
            pZoomOut.addEventListener('click', () => {
                const currentPct = getPopupZoomPercentage();
                setPopupZoom(currentPct - 5);
            });

            // Sync Back to Main
            popupEditor.session.on('change', () => {
                if (isUpdatingFromMain) return; // Don't reflect back if main caused it
                
                isUpdatingFromPopup = true;
                const val = popupEditor.getValue();
                if (editor.getValue() !== val) {
                    editor.setValue(val, 1); // Update main, cursor pos doesn't matter as it's hidden
                    // Trigger sync to textarea
                    syncToCodeMirror(); 
                }
                isUpdatingFromPopup = false;
            });

            // Sync Main to Popup (if main changes for some reason)
            const mainChangeListener = () => {
                 if (isUpdatingFromPopup) return; // Don't reflect back if popup caused it
                 
                 if (detachedWindow && !detachedWindow.closed) {
                     isUpdatingFromMain = true;
                     const val = editor.getValue();
                     if (popupEditor.getValue() !== val) {
                         // Preserve cursor if possible
                         const cursor = popupEditor.getCursorPosition();
                         popupEditor.setValue(val, -1);
                         popupEditor.moveCursorToPosition(cursor);
                     }
                     isUpdatingFromMain = false;
                 }
            };
            editor.session.on('change', mainChangeListener);

            // Reattach Button
            const reattachBtn = doc.getElementById('edgar-plus-reattach-btn');
            reattachBtn.addEventListener('click', () => {
                detachedWindow.close();
            });

            // Handle Close
            detachedWindow.onbeforeunload = () => {
                // Ensure final sync
                editor.setValue(popupEditor.getValue(), -1);
                syncToCodeMirror();
                
                // Restore Main Editor Interaction
                aceContainer.style.display = 'block';
                toolbar.style.display = 'flex';
                footer.style.display = 'flex';

                // Restore overlap border
                const overlapContainer = document.querySelector('.edgar-overlap');
                if (overlapContainer) {
                    overlapContainer.style.display = '';
                }
                
                // Remove listener
                // editor.session.removeListener('change', mainChangeListener); // Ace doesn't have removeListener easily exposed like this usually, but it's fine for now.
            };

            // Add Footer Buttons to Popup
            const btnGroup = doc.querySelector('.edgar-plus-btn-group');
            
            // Helper for popup buttons
            function createPopupBtn(iconUrl, colorClass, title, onClick) {
                 const btn = doc.createElement('button');
                 btn.className = `btn ${colorClass} edgar-plus-square-btn`;
                 btn.setAttribute('data-tooltip', title);
                 const img = doc.createElement('img');
                 img.src = iconUrl;
                 img.style.width = '24px';
                 img.style.height = '24px';
                 btn.appendChild(img);
                 btn.addEventListener('click', onClick);
                 return btn;
            }

            // Run
            btnGroup.appendChild(createPopupBtn(iconPlayUrl, 'btn-success', 'Run (F5)', () => {
                clearAllAnnotations();
                // Trigger main window run
                const runBtnOriginal = document.querySelector('button[title="Ctrl+Enter"]');
                if (runBtnOriginal) runBtnOriginal.click();
                
                // Manually trigger loading state in popup immediately (main window will sync it shortly, but this feels faster)
                const popupRunBtn = pDoc.querySelector('button[data-tooltip="Run (F5)"]');
                if (popupRunBtn) {
                    popupRunBtn.classList.add('edgar-loading');
                    const img = popupRunBtn.querySelector('img');
                    if (img) {
                        img.src = iconLoadUrl;
                        img.classList.add('edgar-spin');
                    }
                }
            }));

            // Paste & Run (Popup clipboard)
            btnGroup.appendChild(createPopupBtn(iconPasteUrl, 'btn-primary', 'Paste & Run (F1)', () => {
                 if (detachedWindow.navigator.clipboard) {
                     detachedWindow.navigator.clipboard.readText().then(text => {
                         if (text) {
                             popupEditor.setValue(text, -1);
                             // Sync happens automatically via change listener
                             // Trigger run
                             setTimeout(() => {
                                 clearAllAnnotations();
                                 const runBtnOriginal = document.querySelector('button[title="Ctrl+Enter"]');
                                 if (runBtnOriginal) runBtnOriginal.click();
                             }, 100);
                         }
                     });
                 }
            }));

            // Save
            btnGroup.appendChild(createPopupBtn(iconSaveUrl, 'btn-warning', 'Save', () => {
                 const allButtons = Array.from(document.querySelectorAll('button'));
                 const saveBtnOriginal = allButtons.find(b => b.textContent.trim() === 'Save');
                 if (saveBtnOriginal) saveBtnOriginal.click();
            }));
            
            // Hotkeys in Popup
            doc.addEventListener('keydown', function(e) {
                if (e.key === 'F5') {
                    e.preventDefault();
                    clearAllAnnotations();
                    const runBtnOriginal = document.querySelector('button[title="Ctrl+Enter"]');
                    if (runBtnOriginal) runBtnOriginal.click();
                }
                if (e.key === 'F1') {
                    e.preventDefault();
                    // Paste & Run logic
                     if (detachedWindow.navigator.clipboard) {
                         detachedWindow.navigator.clipboard.readText().then(text => {
                             if (text) {
                                 popupEditor.setValue(text, -1);
                                 setTimeout(() => {
                                     clearAllAnnotations();
                                     const runBtnOriginal = document.querySelector('button[title="Ctrl+Enter"]');
                                     if (runBtnOriginal) runBtnOriginal.click();
                                 }, 100);
                             }
                         });
                     }
                }
            });

            // Rebind F1 to Ctrl+P (Command Palette) in Popup
            popupEditor.commands.addCommand({
                name: "openCommandPalette",
                bindKey: {win: "Ctrl-P", mac: "Command-P"},
                exec: function(editor) {
                    editor.execCommand("openCommandPalette");
                }
            });
            popupEditor.commands.bindKey("F1", null);

            // Hide Main Editor Interaction
            aceContainer.style.display = 'none';
            toolbar.style.display = 'none';
            footer.style.display = 'none';
        };
    });

    // Open Modal
    settingsBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        // Force reflow to enable transition
        void modal.offsetWidth;
        modal.classList.add('show');
    });

    // Close Modal Helper
    function closeModal() {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 200); // Match CSS transition
    }

    // Close Modal
    closeBtn.addEventListener('click', closeModal);

    // Close on click outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // --- SETTINGS LOGIC ---
    // Load Settings
    const savedVim = localStorage.getItem('edgar_plus_vim') === 'true';
    const savedBrackets = localStorage.getItem('edgar_plus_brackets') !== 'false'; // Default true
    const savedInvisibles = localStorage.getItem('edgar_plus_invisibles') === 'true';

    // Apply Initial Settings
    vimToggle.checked = savedVim;
    bracketsToggle.checked = savedBrackets;
    invisiblesToggle.checked = savedInvisibles;
    cleanOutputToggle.checked = localStorage.getItem('edgar_plus_clean_output') === 'true';
    hideTimerToggle.checked = localStorage.getItem('edgar_plus_hide_timer') === 'true';

    if (savedVim) {
        editor.setKeyboardHandler("ace/keyboard/vim");
    }
    editor.setBehavioursEnabled(savedBrackets);
    editor.setShowInvisibles(savedInvisibles);

    // Timer Visibility Logic
    function updateTimerVisibility() {
        const shouldHide = localStorage.getItem('edgar_plus_hide_timer') === 'true';
        const timer = document.getElementById('aii-countdown');
        if (timer) {
            timer.style.display = shouldHide ? 'none' : '';
        }
    }
    // Run initially
    updateTimerVisibility();

    // Load saved settings
    const savedMode = localStorage.getItem('edgar_plus_mode') || 'ace/mode/c_cpp';
    const savedTheme = localStorage.getItem('edgar_plus_theme') || 'ace/theme/monokai';
    const savedFontSize = parseInt(localStorage.getItem('edgar_plus_fontsize')) || 14;

    // Apply settings
    editor.session.setMode(savedMode);
    editor.setTheme(savedTheme);
    editor.setFontSize(savedFontSize);
    langSelect.value = savedMode;
    themeSelect.value = savedTheme;
    
    const BASE_FONT_SIZE = 14;

    function getZoomPercentage() {
        const size = parseFloat(editor.getFontSize()) || BASE_FONT_SIZE;
        return Math.round((size / BASE_FONT_SIZE) * 100);
    }

    function setZoom(percentage) {
        if (percentage < 10) percentage = 10; // Minimum safety
        const newSize = (percentage / 100) * BASE_FONT_SIZE;
        editor.setFontSize(newSize);
        localStorage.setItem('edgar_plus_fontsize', newSize);
        updateZoomDisplay();
        editor.resize();
    }

    function updateZoomDisplay() {
        const percentage = getZoomPercentage();
        if (zoomLevelSpan) zoomLevelSpan.textContent = `${percentage}%`;
    }
    updateZoomDisplay();

    // Make zoom span interactive
    if (zoomLevelSpan) {
        zoomLevelSpan.style.cursor = 'pointer';
        zoomLevelSpan.title = 'Click to set custom zoom';
        
        zoomLevelSpan.addEventListener('click', () => {
            if (zoomLevelSpan.querySelector('input')) return; // Already editing

            const currentPct = getZoomPercentage();
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentPct;
            // Style to match toolbar
            input.style.width = '40px';
            input.style.background = '#2F3129';
            input.style.color = '#fff';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.textAlign = 'center';
            input.style.fontSize = '12px';
            input.style.padding = '0';
            input.style.height = '18px';

            zoomLevelSpan.textContent = '';
            zoomLevelSpan.appendChild(input);
            input.focus();
            input.select();

            const finish = () => {
                let val = input.value.trim();
                // Remove % if present
                val = val.replace('%', '');
                let num = parseInt(val, 10);
                
                if (!isNaN(num)) {
                    setZoom(num);
                } else {
                    updateZoomDisplay(); // Revert
                }
            };

            input.addEventListener('blur', finish);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                } else if (e.key === 'Escape') {
                    updateZoomDisplay();
                }
            });
        });
    }

    // Event Listeners
    themeSelect.addEventListener('change', (e) => {
        const theme = e.target.value;
        editor.setTheme(theme);
        localStorage.setItem('edgar_plus_theme', theme);
        
        // Sync to detached window if open
        if (detachedWindow && !detachedWindow.closed && detachedWindow.edgarEditor) {
            detachedWindow.edgarEditor.setTheme(theme);
        }
    });

    langSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        editor.session.setMode(mode);
        localStorage.setItem('edgar_plus_mode', mode);
    });

    zoomInBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const currentPct = getZoomPercentage();
        setZoom(currentPct + 5);
    });

    zoomOutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const currentPct = getZoomPercentage();
        setZoom(currentPct - 5);
    });

    // Event Listeners for Toggles
    vimToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        if (isEnabled) {
            editor.setKeyboardHandler("ace/keyboard/vim");
        } else {
            editor.setKeyboardHandler(null);
        }
        localStorage.setItem('edgar_plus_vim', isEnabled);
    });

    bracketsToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        editor.setBehavioursEnabled(isEnabled);
        localStorage.setItem('edgar_plus_brackets', isEnabled);
    });

    invisiblesToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        editor.setShowInvisibles(isEnabled);
        localStorage.setItem('edgar_plus_invisibles', isEnabled);
    });

    cleanOutputToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        localStorage.setItem('edgar_plus_clean_output', isEnabled);
        if (isEnabled) {
            cleanOutput();
        } else {
            restoreOutput();
        }
    });

    hideTimerToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        localStorage.setItem('edgar_plus_hide_timer', isEnabled);
        updateTimerVisibility();
    });

    // --- PERSISTENCE ---
    // Initial Load
    const initialKey = getStorageKey();
    let savedCode = localStorage.getItem(initialKey);

    // Fix: If saved code is just whitespace (e.g. the 13 newlines), treat it as empty string
    if (typeof savedCode === 'string' && savedCode.trim().length === 0) {
        savedCode = "";
        localStorage.setItem(initialKey, ""); // Clean up storage
    }

    if (savedCode !== null) {
        editor.setValue(savedCode.trim(), -1);
        debugLog("Edgar+: Restored unsaved code from local storage.");
        setTimeout(syncToCodeMirror, 0);
    } else {
        // Remove Edgar's default 13 newlines
        const cleanCode = originalTextarea.value ? originalTextarea.value.trim() : "";
        editor.setValue(cleanCode, -1);
    }

    // --- SYNC LOGIC ---
    function syncToCodeMirror() {
        const newValue = editor.getValue();
        
        // 1. Try to update the CodeMirror instance directly (Most reliable)
        if (oldUI && oldUI.CodeMirror) {
            const currentCMValue = oldUI.CodeMirror.getValue();
            if (currentCMValue !== newValue) {
                isSyncing = true;
                oldUI.CodeMirror.setValue(newValue);
                isSyncing = false;
            }
        }

        // 2. Update the textarea (Fallback)
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeInputValueSetter.call(originalTextarea, newValue);
        originalTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        originalTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // --- LOADING STATE LOGIC ---
    let lastOutputElement = null;
    let lastOutputText = "";

    function setRunLoading(isLoading) {
        const runBtn = document.querySelector('button[data-tooltip="Run (F5)"]');
        
        // Helper to update a specific button
        const updateBtn = (btn) => {
            if (!btn) return;
            const img = btn.querySelector('img');
            if (isLoading) {
                btn.classList.add('edgar-loading');
                if (img) {
                    img.src = iconLoadUrl;
                    img.classList.add('edgar-spin');
                }
            } else {
                btn.classList.remove('edgar-loading');
                if (img) {
                    img.src = iconPlayUrl;
                    img.classList.remove('edgar-spin');
                }
            }
        };

        // Update Main Button
        if (runBtn) {
            if (isLoading) {
                // Capture current state before starting
                const outputCell = document.querySelector('clang-result table.table-striped tr td:nth-child(3)');
                lastOutputElement = outputCell;
                lastOutputText = outputCell ? outputCell.innerText : "";
            }
            updateBtn(runBtn);
        }

        // Update Detached Button (if open)
        if (detachedWindow && !detachedWindow.closed) {
            const popupRunBtn = detachedWindow.document.querySelector('button[data-tooltip="Run (F5)"]');
            updateBtn(popupRunBtn);
        }
    }

    // --- ERROR PARSING ---
    function clearAllAnnotations() {
        editor.getSession().clearAnnotations();
        if (detachedWindow && !detachedWindow.closed && detachedWindow.edgarEditor) {
            detachedWindow.edgarEditor.getSession().clearAnnotations();
        }
    }

    function parseCompilerErrors(text) {
        const annotations = [];
        // Regex for GCC/Clang style errors: main.c:4:24: error: ...
        // Also handle: main.c:4: error: ...
        const regex = /main\.c:(\d+)(?::(\d+))?:\s*(error|warning|note):\s*(.*)/g;
        
        let match;
        while ((match = regex.exec(text)) !== null) {
            const line = parseInt(match[1], 10) - 1; // Ace is 0-indexed
            const column = match[2] ? parseInt(match[2], 10) : 0;
            const type = match[3]; // error, warning, note
            const text = match[4];

            annotations.push({
                row: line,
                column: column,
                text: text,
                type: type === 'error' ? 'error' : (type === 'warning' ? 'warning' : 'info')
            });
        }
        return annotations;
    }

    let isCleaning = false;

    function getCleanedHtml(html) {
        if (!html) return html;
        let newHtml = html;
        // Replace Middle Dot (·) with Space
        if (/[\u00B7·]/.test(newHtml)) {
            newHtml = newHtml.replace(/[\u00B7·]/g, ' ');
        }
        // Remove Return Symbol (↵)
        if (/[\u21B5↵]/.test(newHtml)) {
            newHtml = newHtml.replace(/[\u21B5↵]/g, '');
        }
        return newHtml;
    }

    function restoreOutput() {
        if (isCleaning) return;
        isCleaning = true;
        try {
            const compilerOutput = document.querySelectorAll('clang-result table.table-striped tr td:nth-child(3)');
            const testResults = document.querySelectorAll('table.code-results td.edgar-code');
            const allTargets = [...compilerOutput, ...testResults];

            allTargets.forEach(cell => {
                if (cell.hasAttribute('data-original-html')) {
                    cell.innerHTML = cell.getAttribute('data-original-html');
                    cell.removeAttribute('data-original-html');
                }
            });
        } catch (e) {
            console.error("Edgar+: Restore output failed", e);
        } finally {
            isCleaning = false;
        }
    }

    function cleanOutput() {
        if (isCleaning) return;
        // Only run if setting is enabled
        if (localStorage.getItem('edgar_plus_clean_output') !== 'true') return;

        isCleaning = true;
        try {
            // Target Compiler Output
            const compilerOutput = document.querySelectorAll('clang-result table.table-striped tr td:nth-child(3)');
            
            // Target Test Results (stdin, stdout, expected)
            const testResults = document.querySelectorAll('table.code-results td.edgar-code');

            const allTargets = [...compilerOutput, ...testResults];

            allTargets.forEach(cell => {
                const currentHtml = cell.innerHTML;
                
                if (cell.hasAttribute('data-original-html')) {
                    const original = cell.getAttribute('data-original-html');
                    const expectedClean = getCleanedHtml(original);
                    
                    // If current HTML matches what we expect it to be (cleaned), do nothing
                    // If it doesn't match, the content must have changed externally.
                    if (currentHtml !== expectedClean) {
                        cell.setAttribute('data-original-html', currentHtml);
                        cell.innerHTML = getCleanedHtml(currentHtml);
                    }
                } else {
                    // First time cleaning this cell
                    const cleaned = getCleanedHtml(currentHtml);
                    if (cleaned !== currentHtml) {
                        cell.setAttribute('data-original-html', currentHtml);
                        cell.innerHTML = cleaned;
                    }
                }
            });
        } catch (e) {
            console.error("Edgar+: Clean output failed", e);
        } finally {
            isCleaning = false;
        }
    }

    function checkOutputForErrors() {
        // The output is usually in the 3rd column of the table inside clang-result
        // Selector: clang-result table.table-striped tr td:nth-child(3)
        const outputCell = document.querySelector('clang-result table.table-striped tr td:nth-child(3)');
        
        if (outputCell) {
            const currentText = outputCell.innerText;
            
            // Check if we are loading and if the result is new
            const runBtn = document.querySelector('button[data-tooltip="Run (F5)"]');
            const isSpinnerActive = runBtn && runBtn.classList.contains('edgar-loading');

            if (isSpinnerActive) {
                // Stop if element reference changed (DOM rebuild) OR text changed
                if (outputCell !== lastOutputElement || currentText !== lastOutputText) {
                    setRunLoading(false);
                }
            }

            const annotations = parseCompilerErrors(currentText);
            if (annotations.length > 0) {
                debugLog("Edgar+: Found errors:", annotations);
                editor.getSession().setAnnotations(annotations);

                if (detachedWindow && !detachedWindow.closed && detachedWindow.edgarEditor) {
                    detachedWindow.edgarEditor.getSession().setAnnotations(annotations);
                }
            }
        }
    }

    // Observer for the result container
    const resultObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                checkOutputForErrors();
                if (localStorage.getItem('edgar_plus_clean_output') === 'true') {
                    cleanOutput();
                }
            }
        }
    });
    
    // Observe the body for changes (to catch when the result table is inserted)
    resultObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Clear annotations on change
    editor.session.on('change', function() {
        // Optional: Clear annotations when user starts typing?
        // editor.getSession().clearAnnotations(); 
        // Actually, standard behavior is to keep them until next run or manual clear.
        // But we definitely want to sync.
        const key = getStorageKey();
        localStorage.setItem(key, editor.getValue());
        syncToCodeMirror();
    });

    // --- REVERSE SYNC (App -> Edgar) ---
    // Detect when the app changes the question (and thus the code)
    if (oldUI && oldUI.CodeMirror) {
        oldUI.CodeMirror.on('change', (instance, changeObj) => {
            if (!isSyncing) {
                debugLog("Edgar+: Detected external change (Question switch?)");
                
                const appCode = instance.getValue();
                const currentKey = getStorageKey();
                let savedLocal = localStorage.getItem(currentKey);

                // Fix: If saved code is just whitespace, treat it as empty string
                if (typeof savedLocal === 'string' && savedLocal.trim().length === 0) {
                    savedLocal = "";
                }

                // If we have saved code for this specific question/URL, prefer it
                if (savedLocal !== null) {
                    const cleanSavedLocal = savedLocal.trim();
                    if (editor.getValue() !== cleanSavedLocal) {
                        debugLog("Edgar+: Restoring saved code for this question.");
                        editor.setValue(cleanSavedLocal, -1);
                    }
                } else {
                    // Otherwise, accept the app's new code
                    // Remove Edgar's default 13 newlines
                    const cleanAppCode = appCode ? appCode.trim() : "";

                    if (editor.getValue() !== cleanAppCode) {
                        debugLog("Edgar+: Loading new question code from App.");
                        editor.setValue(cleanAppCode, -1);
                    }
                }
            }
        });
    }

    // --- BUTTON INTERCEPTION & HOTKEYS ---
    const runBtn = document.querySelector('button[title="Ctrl+Enter"]'); // Based on your HTML
    
    if (runBtn) {
        // Force sync before click
        runBtn.addEventListener('mousedown', () => {
            syncToCodeMirror();
            clearAllAnnotations(); // Clear old errors on run
        });
        runBtn.addEventListener('click', () => {
            syncToCodeMirror();
            setRunLoading(true);
        });
        debugLog("Edgar+: Hooked into Run button");
    }

    // Hotkeys: F1 to Paste & Run
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F1') {
            e.preventDefault();
            debugLog("Edgar+: F1 pressed, triggering Paste & Run");
            
            if (navigator.clipboard && navigator.clipboard.readText) {
                navigator.clipboard.readText().then(text => {
                    if (text) {
                        editor.setValue(text, -1); // Paste and move cursor to start
                        syncToCodeMirror();
                        clearAllAnnotations();
                        if (runBtn) {
                            debugLog("Edgar+: Auto-running...");
                            runBtn.click();
                        }
                    }
                }).catch(err => {
                    console.error("Edgar+: Clipboard error:", err);
                    alert("Edgar+: Please allow clipboard access to use Paste & Run.");
                });
            }
        }
    });

    // Hotkeys: F5 to Run
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F5') {
            e.preventDefault(); // Stop browser refresh
            debugLog("Edgar+: F5 pressed, triggering Run");
            syncToCodeMirror(); // Ensure code is synced
            clearAllAnnotations(); // Clear old errors
            if (runBtn) runBtn.click();
        }
    });

    debugLog("Edgar+: Ace Editor initialized successfully.");
}

// Start looking for the editor
waitForElement('#codeMirrorEditor', initAce);
