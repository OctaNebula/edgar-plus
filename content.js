// content.js
const DEBUG = false;
function debugLog(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

debugLog("Edgar+ Content Script Loaded");

function injectScript(file_path, tag, callback) {
    var node = document.getElementsByTagName(tag)[0] || document.documentElement;
    var script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', file_path);
    if (callback) {
        script.onload = callback;
    }
    node.appendChild(script);
}

const aceScriptUrl = chrome.runtime.getURL('lib/ace/ace.js');
const aceLangToolsUrl = chrome.runtime.getURL('lib/ace/ext-language_tools.js');
const aceSearchboxUrl = chrome.runtime.getURL('lib/ace/ext-searchbox.js');
const aceVimUrl = chrome.runtime.getURL('lib/ace/keybinding-vim.js');
const mainScriptUrl = chrome.runtime.getURL('edgar_main.js');
const aceBasePath = chrome.runtime.getURL('lib/ace/');

// Icons
const iconPlayUrl = chrome.runtime.getURL('icons/run.svg');
const iconPasteUrl = chrome.runtime.getURL('icons/paste_run.svg');
const iconSaveUrl = chrome.runtime.getURL('icons/save.svg');
const iconDetachUrl = chrome.runtime.getURL('icons/detach.svg');
const iconLoadUrl = chrome.runtime.getURL('icons/load.svg');
const styleUrl = chrome.runtime.getURL('styles.css');

// Helper to detect browser
function getBrowser() {
    if (typeof browser !== 'undefined') {
        return 'firefox';
    }
    return 'chrome';
}

// Check if enabled
chrome.storage.local.get(['edgarPlusEnabled'], function(result) {
    if (result.edgarPlusEnabled === false) {
        debugLog("Edgar+: Extension is disabled by user.");
        return;
    }

    // Inject CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = styleUrl;
    (document.head || document.documentElement).appendChild(link);

    // 1. Inject Ace Core
    const script = document.createElement('script');
    script.src = aceScriptUrl;
    script.onload = function() {
        debugLog("Edgar+: Ace library loaded.");
        
        // 3. Inject Language Tools (Wait for load)
        debugLog("Edgar+: Injecting language tools...");
        injectScript(aceLangToolsUrl, 'body', function() {
            debugLog("Edgar+: Language tools loaded.");

            // 3.5 Inject Searchbox (Required for Vim)
            debugLog("Edgar+: Injecting searchbox...");
            injectScript(aceSearchboxUrl, 'body', function() {
                debugLog("Edgar+: Searchbox loaded.");

                // 4. Inject Vim Keybindings (Wait for load)
                debugLog("Edgar+: Injecting Vim keybindings...");
                injectScript(aceVimUrl, 'body', function() {
                    debugLog("Edgar+: Vim keybindings loaded.");
                    
                    // 5. Inject Main Script (Only after tools are ready)
                    debugLog("Edgar+: Injecting main script...");
                    
                    // Manually inject main script to attach dataset
                    var mainScript = document.createElement('script');
                    mainScript.src = mainScriptUrl;
                    mainScript.dataset.aceBasePath = aceBasePath;
                    mainScript.dataset.browser = getBrowser(); // Pass browser info
                    mainScript.dataset.iconPlay = iconPlayUrl;
                    mainScript.dataset.iconPaste = iconPasteUrl;
                    mainScript.dataset.iconSave = iconSaveUrl;
                    mainScript.dataset.iconDetach = iconDetachUrl;
                    mainScript.dataset.iconLoad = iconLoadUrl;
                    mainScript.dataset.styleUrl = styleUrl;
                    mainScript.onload = function() {
                        debugLog("Edgar+: Main script injected.");
                    };
                    (document.body || document.documentElement).appendChild(mainScript);
                });
            });
        });
    };
    (document.head || document.documentElement).appendChild(script);
});
