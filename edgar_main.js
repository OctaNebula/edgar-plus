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

// --- EXAM ID FETCHING ---
const examIdPromise = new Promise((resolve) => {
    // Only attempt fetch if we look like we are in an exam or generic run context
    // We'll just try it. It's safer.
    fetch('/exam/run/instance')
        .then(res => {
            if (!res.ok) throw new Error(res.statusText);
            return res.json();
        })
        .then(data => {
            if (data && data.idTestInstance) {
                debugLog("Edgar+: Detected Exam ID:", data.idTestInstance);
                resolve(data.idTestInstance);
            } else {
                resolve(null);
            }
        })
        .catch(err => {
            // debugLog("Edgar+: Not an exam instance or fetch failed", err);
            resolve(null);
        });
});

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

function watchForElement(selector, callback) {
    // Check immediately
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
        if (!el.dataset.edgarInitialized) {
            el.dataset.edgarInitialized = 'true';
            callback(el);
        }
    });

    const observer = new MutationObserver((mutations) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (!el.dataset.edgarInitialized) {
                el.dataset.edgarInitialized = 'true';
                callback(el);
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

async function initAce(originalTextarea) {
    debugLog("Edgar+: Found original editor:", originalTextarea);

    // Wait for Exam ID to ensure correct storage key
    const examId = await examIdPromise;

    let isSyncing = false;

    function getStorageKey() {
        let key = 'edgar_plus_code_' + window.location.pathname + window.location.search;
        if (examId) {
            key += '_exam_' + examId;
        }
        return key;
    }

    // The structure is:
    // <code-mirror>
    //    <div><textarea id="codeMirrorEditor"></div>
    //    <div class="CodeMirror">...</div>
    // </code-mirror>

    // We want to hide the CodeMirror UI
    const codeMirrorElement = originalTextarea.closest('code-mirror');
    const oldUI = codeMirrorElement ? codeMirrorElement.querySelector('.CodeMirror') : null;

    // --- NEW EXTRACTION LOGIC ---
    let extractedInitialCode = "";
    if (oldUI && oldUI.CodeMirror) {
        extractedInitialCode = oldUI.CodeMirror.getValue();
        debugLog("Edgar+: Extracted code from CodeMirror instance.");
    } else if (oldUI) {
        const lines = oldUI.querySelectorAll('.CodeMirror-line');
        if (lines.length > 0) {
            extractedInitialCode = Array.from(lines).map(line => line.textContent).join('\n');
            // Remove zero-width spaces often used by CM
            extractedInitialCode = extractedInitialCode.replace(/\u200b/g, '');
            debugLog("Edgar+: Scraped code from DOM.");
        }
    }

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
    let cachedExamId = null;
    examIdPromise.then(id => cachedExamId = id);

    function enhanceTimer() {
        const timer = document.getElementById('aii-countdown');
        if (!timer) return;

        // Style for visibility (Black text as requested)
        timer.style.backgroundColor = 'transparent';
        timer.style.color = '#000000';
        timer.style.borderRadius = '4px';
        timer.style.padding = '5px 10px';
        timer.style.textAlign = 'center';
        timer.style.minWidth = '120px';

        // Parse time
        // Format: HH:MM:SS or D days HH:MM:SS
        // Use innerText to get visible text, ignoring HTML tags
        const text = timer.innerText.trim();

        // Regex to find time: HH:MM:SS or MM:SS
        // We look for at least one colon.
        // If 2 colons: HH:MM:SS
        // If 1 colon: MM:SS
        const timeMatch = text.match(/(?:(\d+):)?(\d+):(\d+)/);
        // Regex to find days: D days (optional)
        const dayMatch = text.match(/(\d+)\s+days?/i);

        if (timeMatch) {
            // timeMatch[1] is hours (undefined if MM:SS), [2] is minutes, [3] is seconds
            const h = timeMatch[1] ? parseInt(timeMatch[1]) : 0;
            const m = parseInt(timeMatch[2]);
            const s = parseInt(timeMatch[3]);

            let seconds = h * 3600 + m * 60 + s;

            if (dayMatch) {
                seconds += parseInt(dayMatch[1]) * 86400; // Add days in seconds
            }

            // Max Time Logic
            let max = 0;
            if (cachedExamId) {
                const key = 'edgar_timer_max_' + cachedExamId;
                const stored = localStorage.getItem(key);
                if (stored) {
                    max = parseInt(stored);
                } else {
                    // First time seeing this exam
                    max = seconds;
                    localStorage.setItem(key, max);
                }
            } else {
                // Fallback: use dataset on element (session based)
                if (!timer.dataset.maxSeconds) {
                    timer.dataset.maxSeconds = seconds;
                }
                max = parseInt(timer.dataset.maxSeconds);
            }

            // Prevent division by zero
            const pct = max > 0 ? (seconds / max) * 100 : 0;

            // Color change based on percentage
            let color = '#a6e22e'; // Green
            if (pct < 10) {
                color = '#f92672'; // Red
            } else if (pct < 30) {
                color = '#fd971f'; // Orange
            }

            // Apply Gradient Background
            // Background: [Progress Bar (Bottom 4px)] [Transparent (Rest)]
            // Use setProperty with 'important' to fight inline style overwrites
            const gradient = `linear-gradient(to right, ${color} ${pct}%, transparent ${pct}%) no-repeat bottom / 100% 4px`;

            // CRITICAL: Check if changed to prevent infinite loop with MutationObserver
            if (timer.dataset.lastGradient !== gradient) {
                timer.style.setProperty('background', gradient, 'important');
                timer.dataset.lastGradient = gradient;
            }
        } else {
            // Fallback if parsing fails
            if (timer.dataset.lastGradient !== 'transparent') {
                timer.style.setProperty('background', 'transparent', 'important');
                timer.dataset.lastGradient = 'transparent';
            }
        }
    }

    // Observe timer for changes to update bar
    waitForElement('#aii-countdown', (timer) => {
        enhanceTimer(); // Initial run
        updateTimerVisibility(); // Ensure visibility is correct

        // Use a flag to prevent recursive loops if we modify the DOM inside the callback
        let isUpdating = false;

        const timerObserver = new MutationObserver((mutations) => {
            if (isUpdating) return;
            isUpdating = true;

            try {
                enhanceTimer();
                updateTimerVisibility();
            } finally {
                isUpdating = false;
            }
        });

        // Added attributes: true to catch style changes
        timerObserver.observe(timer, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
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
            runBtnNew.id = 'edgar-plus-run-btn';

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
            pasteRunBtn.id = 'edgar-plus-paste-btn';

            const saveBtnNew = createBtn(iconSaveUrl, 'btn-warning', 'Save', (e) => {
                // Animation Start
                const btn = e.currentTarget;
                const img = btn.querySelector('img');

                // Prevent double clicks if already loading
                if (btn.classList.contains('edgar-loading')) return;

                btn.classList.add('edgar-loading');

                // Swap icon to spinner (Load icon - circular arrow)
                const originalSrc = img.src;
                img.src = iconLoadUrl;
                img.classList.add('edgar-spin');

                syncToCodeMirror();
                if (saveBtnOriginal) {
                    debugLog("Edgar+: Clicking original Save button.");
                    saveBtnOriginal.click();
                } else {
                    console.error("Edgar+: Original Save button not found during save!");
                }

                // Remove animation after 1 second
                setTimeout(() => {
                    btn.classList.remove('edgar-loading');
                    img.classList.remove('edgar-spin');
                    img.src = originalSrc;
                }, 1000);
            });
            saveBtnNew.id = 'edgar-plus-save-btn';

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
    editor.setTheme("ace/theme/edgar_plus");

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
        { name: "Edgar+ (Default)", value: "ace/theme/edgar_plus" },
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

    // --- SIDEBAR MENU ---
    const sidebarOverlay = document.createElement('div');
    sidebarOverlay.className = 'edgar-plus-sidebar-overlay';
    document.body.appendChild(sidebarOverlay);

    const sidebar = document.createElement('div');
    sidebar.id = 'edgar-plus-sidebar';
    sidebar.innerHTML = `
        <div class="edgar-plus-sidebar-header">
            <span>Edgar+ Menu</span>
            <button class="edgar-plus-close-sidebar-btn">&times;</button>
        </div>
        <div class="edgar-plus-sidebar-content">
            <div class="edgar-plus-sidebar-section">Settings</div>
            
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
            <div class="edgar-plus-setting-item">
                <span class="edgar-plus-setting-label">Rainbow Brackets</span>
                <label class="edgar-plus-switch">
                    <input type="checkbox" id="edgar-plus-setting-rainbow-brackets" checked>
                    <span class="edgar-plus-slider"></span>
                </label>
            </div>
            <div class="edgar-plus-setting-item">
                <span class="edgar-plus-setting-label">Highlight Brackets</span>
                <label class="edgar-plus-switch">
                    <input type="checkbox" id="edgar-plus-setting-highlight-brackets">
                    <span class="edgar-plus-slider"></span>
                </label>
            </div>

            <div class="edgar-plus-sidebar-section">Links</div>
            <div class="edgar-plus-setting-item">
                <a href="https://github.com/OctaNebula/EdgarPlus" target="_blank" style="color: #66d9ef; text-decoration: none; display: flex; align-items: center; gap: 10px;">
                    <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                    </svg>
                    GitHub Repository
                </a>
            </div>
        </div>
    `;
    document.body.appendChild(sidebar);

    const settingsBtn = toolbar.querySelector('#edgar-plus-settings-btn');
    const closeBtn = sidebar.querySelector('.edgar-plus-close-sidebar-btn');
    const themeSelect = sidebar.querySelector('#edgar-plus-setting-theme');
    const vimToggle = sidebar.querySelector('#edgar-plus-setting-vim');
    const bracketsToggle = sidebar.querySelector('#edgar-plus-setting-brackets');
    const invisiblesToggle = sidebar.querySelector('#edgar-plus-setting-invisibles');
    const cleanOutputToggle = sidebar.querySelector('#edgar-plus-setting-clean-output');
    const hideTimerToggle = sidebar.querySelector('#edgar-plus-setting-hide-timer');
    const rainbowBracketsToggle = sidebar.querySelector('#edgar-plus-setting-rainbow-brackets');
    const highlightBracketsToggle = sidebar.querySelector('#edgar-plus-setting-highlight-brackets');
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
            const currentTheme = localStorage.getItem('edgar_plus_theme') || 'ace/theme/edgar_plus';
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
            doc.addEventListener('keydown', function (e) {
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
                bindKey: { win: "Ctrl-P", mac: "Command-P" },
                exec: function (editor) {
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

    // Toggle Sidebar
    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('open');
    }

    settingsBtn.addEventListener('click', toggleSidebar);
    closeBtn.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

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
    const savedTheme = localStorage.getItem('edgar_plus_theme') || 'ace/theme/edgar_plus';
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

    // Zoom Buttons
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            const current = getZoomPercentage();
            setZoom(current + 10);
        });
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            const current = getZoomPercentage();
            setZoom(current - 10);
        });
    }

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

        updateUITheme(theme);

        // Sync to detached window if open
        if (detachedWindow && !detachedWindow.closed && detachedWindow.edgarEditor) {
            detachedWindow.edgarEditor.setTheme(theme);
        }
    });

    // --- UI THEME SYNC ---
    function updateUITheme(themePath) {
        // Simple heuristic: Most Ace themes have "dark" or "light" in name, 
        // or we check specific known dark themes.
        // Default to dark for "safe" themes (Monokai, Twilight, etc.)
        const knownLightThemes = [
            "ace/theme/chrome", "ace/theme/clouds", "ace/theme/crimson_editor",
            "ace/theme/dawn", "ace/theme/dreamweaver", "ace/theme/eclipse",
            "ace/theme/github", "ace/theme/iplastic", "ace/theme/katzenmilch",
            "ace/theme/kuroir", "ace/theme/solarized_light", "ace/theme/sqlserver",
            "ace/theme/textmate", "ace/theme/tomorrow", "ace/theme/xcode"
        ];

        const isLight = knownLightThemes.includes(themePath);

        // Colors
        const bg = isLight ? '#f0f0f0' : '#2F3129';
        const fg = isLight ? '#333' : '#f8f8f2';
        const border = isLight ? '#ccc' : '#444';
        const btnBg = isLight ? '#e0e0e0' : '#444';
        const btnHover = isLight ? '#d0d0d0' : '#555';

        // Apply to Toolbar
        if (toolbar) {
            toolbar.style.backgroundColor = bg;
            toolbar.style.color = fg;
            toolbar.style.borderColor = border;

            // Toolbar buttons
            const buttons = toolbar.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.style.backgroundColor = btnBg;
                btn.style.color = fg;
                btn.style.borderColor = isLight ? '#bbb' : '#555';
            });

            // Language Select
            const select = toolbar.querySelector('select');
            if (select) {
                select.style.backgroundColor = btnBg;
                select.style.color = fg;
                select.style.borderColor = isLight ? '#bbb' : '#555';
            }
        }

        // Apply to Footer
        if (footer) {
            footer.style.backgroundColor = bg;
            footer.style.color = fg;
            footer.style.borderColor = border;
        }

        // Apply to Sidebar
        if (sidebar) {
            sidebar.style.backgroundColor = bg;
            sidebar.style.color = fg;
            sidebar.style.borderLeftColor = border;

            sidebar.querySelectorAll('.edgar-plus-sidebar-header').forEach(el => {
                el.style.borderBottomColor = border;
                el.style.color = fg;
            });
            sidebar.querySelectorAll('.edgar-plus-sidebar-section').forEach(el => {
                el.style.borderBottomColor = border;
            });
            sidebar.querySelectorAll('.edgar-plus-setting-label').forEach(el => {
                el.style.color = fg; // Update label color
            });
        }
    }

    // Initialize UI Theme
    setTimeout(() => updateUITheme(localStorage.getItem('edgar_plus_theme') || 'ace/theme/edgar_plus'), 500);

    // --- RAINBOW BRACKETS ---
    let rainbowEnabled = false;

    function applyRainbowColors() {
        if (!rainbowEnabled) return;

        const session = editor.session;
        const len = session.getLength();

        // Performance safety: Limit to reasonable file size
        if (len > 5000) return;

        let depth = 0;

        // Full scan to ensure accurate depth
        // Full scan to ensure accurate depth

        for (let r = 0; r < len; r++) {
            // Use cached tokens directly if possible to persist our changes against bgTokenizer updates
            let tokens = session.bgTokenizer.lines[r];
            if (!tokens) {
                tokens = session.getTokens(r);
            }
            if (!tokens) continue;

            let newTokens = [];
            let lineModified = false;

            // Pass 1: Split merged bracket tokens if necessary
            for (let i = 0; i < tokens.length; i++) {
                const t = tokens[i];
                const isParen = t.type.indexOf('paren.lparen') > -1 || t.type.indexOf('paren.rparen') > -1;

                // If token contains multiple logic characters, we must split it
                if (isParen && t.value.length > 1) {
                    const chars = t.value.split('');
                    chars.forEach(char => {
                        newTokens.push({
                            type: t.type, // Inherit base style
                            value: char
                        });
                    });
                    lineModified = true;
                } else {
                    newTokens.push(t);
                }
            }

            // Pass 2: Apply depth classes to the (potentially new) token list
            newTokens.forEach(t => {
                if (t.type.indexOf('paren.lparen') > -1) {
                    let newType = t.type.replace(/ ?edgar-depth-\d+/g, '');
                    newType = `${newType} edgar-depth-${depth % 3}`;
                    if (t.type !== newType) {
                        t.type = newType;
                        lineModified = true;
                    }
                    depth++;
                } else if (t.type.indexOf('paren.rparen') > -1) {
                    depth--;
                    if (depth < 0) depth = 0;
                    let newType = t.type.replace(/ ?edgar-depth-\d+/g, '');
                    newType = `${newType} edgar-depth-${depth % 3}`;
                    if (t.type !== newType) {
                        t.type = newType;
                        lineModified = true;
                    }
                }
            });

            // Update cache if we modified structure or classes
            if (lineModified) {
                session.bgTokenizer.lines[r] = newTokens;
            }
        }

        // Force redraw of text layer to pick up new classes
        editor.renderer.updateText();
    }

    const debouncedRainbowUpdate = (() => {
        let timer;
        return () => {
            clearTimeout(timer);
            // Wait for Ace's internal tokenizer to finish
            timer = setTimeout(() => {
                applyRainbowColors();
            }, 50);
        };
    })();

    function enableRainbowBrackets() {
        if (rainbowEnabled) return;
        rainbowEnabled = true;

        // Initial apply
        applyRainbowColors();

        // Hook into changes and updates
        editor.session.bgTokenizer.on('update', debouncedRainbowUpdate);
        editor.session.on('change', debouncedRainbowUpdate);
    }

    function disableRainbowBrackets() {
        rainbowEnabled = false;
        editor.session.bgTokenizer.removeListener('update', debouncedRainbowUpdate);
        editor.session.removeListener('change', debouncedRainbowUpdate);

        // Clean up
        const session = editor.session;
        const len = session.getLength();
        for (let r = 0; r < len; r++) {
            const tokens = session.getTokens(r);
            tokens.forEach(t => {
                t.type = t.type.replace(/ ?edgar-depth-\d+/g, '');
            });
        }
        editor.renderer.updateText();
    }

    // Init Rainbow
    if (localStorage.getItem('edgar_plus_rainbow_brackets') !== 'false') {
        try {
            enableRainbowBrackets();
        } catch (err) {
            console.error("Edgar+: Rainbow Init Error:", err);
        }
    }

    langSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        editor.session.setMode(mode);
        localStorage.setItem('edgar_plus_mode', mode);
    });

    hideTimerToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        localStorage.setItem('edgar_plus_hide_timer', isEnabled);
        updateTimerVisibility();
    });

    rainbowBracketsToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        localStorage.setItem('edgar_plus_rainbow_brackets', isEnabled);
        try {
            if (isEnabled) enableRainbowBrackets();
            else disableRainbowBrackets();
        } catch (err) {
            console.error("Edgar+: Rainbow Brackets Error:", err);
        }
    });

    highlightBracketsToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        localStorage.setItem('edgar_plus_highlight_brackets', isEnabled);
        // Force via class on body to ensure global coverage
        if (isEnabled) document.body.classList.remove('edgar-hide-bracket-match');
        else document.body.classList.add('edgar-hide-bracket-match');
    });

    // --- PERSISTENCE ---
    // Initial Load
    const initialKey = getStorageKey();

    // Init Highlight Brackets (Default Off)
    const highlightBrackets = localStorage.getItem('edgar_plus_highlight_brackets') === 'true';
    if (highlightBrackets) document.body.classList.remove('edgar-hide-bracket-match');
    else document.body.classList.add('edgar-hide-bracket-match');
    highlightBracketsToggle.checked = highlightBrackets;

    let savedCode = localStorage.getItem(initialKey);
    const isTutorial = window.location.href.includes('/tutorial/');

    // Fix: If saved code is just whitespace (e.g. the 13 newlines), treat it as empty string
    if (typeof savedCode === 'string' && savedCode.trim().length === 0) {
        savedCode = "";
        localStorage.setItem(initialKey, ""); // Clean up storage
    }

    if (savedCode !== null && savedCode !== "") {
        editor.setValue(savedCode.trim(), -1);
        debugLog("Edgar+: Restored unsaved code from local storage.");
        setTimeout(syncToCodeMirror, 0);
    } else {
        // Use extracted code if available, else textarea value
        let cleanCode = "";
        if (extractedInitialCode && extractedInitialCode.trim().length > 0) {
            cleanCode = extractedInitialCode.trim();
            debugLog("Edgar+: Initialized with code from page (Tutorial/Exam).");
        } else {
            cleanCode = originalTextarea.value ? originalTextarea.value.trim() : "";
        }
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
            // FORCE SAVE to textarea (Critical for form submission/validation)
            if (typeof oldUI.CodeMirror.save === 'function') {
                oldUI.CodeMirror.save();
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
    editor.session.on('change', function () {
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
    document.addEventListener('keydown', function (e) {
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
    document.addEventListener('keydown', function (e) {
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
watchForElement('#codeMirrorEditor', initAce);

