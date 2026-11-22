document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('toggle-ext');
    const statusText = document.getElementById('status-text');
    const statusImg = document.getElementById('status-img');
    const archiveBtns = [document.getElementById('open-archive'), document.getElementById('open-cheatsheet')];
    const versionEl = document.getElementById('version');

    if (versionEl) versionEl.textContent = 'v' + chrome.runtime.getManifest().version;

    // Load saved state
    chrome.storage.local.get(['edgarPlusEnabled'], (result) => {
        const isEnabled = result.edgarPlusEnabled !== false; // Default true
        toggle.checked = isEnabled;
        updateStatus(isEnabled);
    });

    // Edgar tabs pick the change up through chrome.storage.onChanged and apply it live.
    toggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.local.set({ edgarPlusEnabled: isEnabled }, () => {
            updateStatus(isEnabled);
            chrome.action.setIcon({ path: isEnabled ? 'icons/placeholder.png' : 'icons/placeholder2.png' });
        });
    });

    archiveBtns.forEach(btn => btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const current = tabs && tabs[0];
            const openNew = () => {
                chrome.tabs.create({ url: 'https://edgar.fer.hr/#' + (tab === 'cheat' ? 'edgar-plus-cheatsheet' : 'edgar-plus-archive') });
                window.close();
            };
            if (!current || !current.id || !/^https?:\/\/([^/]+\.)?fer\.hr\//.test(current.url || '')) {
                openNew();
                return;
            }
            chrome.tabs.sendMessage(current.id, { type: 'edgar-plus-open-archive', tab }, (res) => {
                if (chrome.runtime.lastError || !res || !res.ok) openNew();
                else window.close();
            });
        });
    }));

    function updateStatus(enabled) {
        statusText.textContent = enabled ? 'Enabled' : 'Disabled';
        statusText.style.color = enabled ? '#a6e22e' : '#f92672';
        archiveBtns.forEach(b => { b.disabled = !enabled; });
        if (statusImg) {
            statusImg.src = enabled ? 'icons/placeholder.png' : 'icons/placeholder2.png';
        }
    }
});
