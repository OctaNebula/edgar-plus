// background.js
function updateIcon(isEnabled) {
    const iconPath = isEnabled ? "icons/placeholder.png" : "icons/placeholder2.png";
    chrome.action.setIcon({ path: iconPath });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['edgarPlusEnabled'], (result) => {
        const isEnabled = result.edgarPlusEnabled !== false;
        updateIcon(isEnabled);
    });
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['edgarPlusEnabled'], (result) => {
        const isEnabled = result.edgarPlusEnabled !== false;
        updateIcon(isEnabled);
    });
});
