// background.js
function updateIcon(isEnabled) {
    const iconPath = isEnabled ? "icons/placeholder.png" : "icons/placeholder2.png";
    chrome.action.setIcon({ path: iconPath });
}

chrome.runtime.onInstalled.addListener((details) => {
    chrome.storage.local.get(['edgarPlusEnabled'], (result) => {
        const isEnabled = result.edgarPlusEnabled !== false;
        updateIcon(isEnabled);
    });

    // Open Welcome Page on Install or Update
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL || details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
        chrome.tabs.create({ url: "welcome.html" });
    }
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['edgarPlusEnabled'], (result) => {
        const isEnabled = result.edgarPlusEnabled !== false;
        updateIcon(isEnabled);
    });
});
