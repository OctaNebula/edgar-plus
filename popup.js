document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('toggle-ext');
    const statusText = document.getElementById('status-text');
    const statusImg = document.getElementById('status-img');

    // Load saved state
    chrome.storage.local.get(['edgarPlusEnabled'], (result) => {
        const isEnabled = result.edgarPlusEnabled !== false; // Default true
        toggle.checked = isEnabled;
        updateStatus(isEnabled);
    });

    // Listen for changes
    toggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.local.set({ edgarPlusEnabled: isEnabled }, () => {
            updateStatus(isEnabled);
            
            // Update Icon (Browser Action)
            const iconPath = isEnabled ? "icons/placeholder.png" : "icons/placeholder2.png";
            chrome.action.setIcon({ path: iconPath });

            // No manual reload needed. content.js listens for storage changes.
        });
    });

    function updateStatus(enabled) {
        statusText.textContent = enabled ? 'Enabled' : 'Disabled';
        statusText.style.color = enabled ? '#a6e22e' : '#f92672';
        
        // Update Popup Image
        if (statusImg) {
            statusImg.src = enabled ? "icons/placeholder.png" : "icons/placeholder2.png";
        }
    }
});