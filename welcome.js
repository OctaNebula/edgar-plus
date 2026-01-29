document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('action-btn');
    const blogSection = document.getElementById('blog-section');
    const changelogSection = document.getElementById('changelog-section');
    let isChangelogView = false;

    if (btn) {
        btn.addEventListener('click', () => {
            if (!isChangelogView) {
                // Transition to Changelog
                blogSection.classList.add('fade-out');

                setTimeout(() => {
                    blogSection.classList.add('hidden');
                    blogSection.classList.remove('fade-out');

                    changelogSection.classList.remove('hidden');
                    // Force reflow
                    void changelogSection.offsetWidth;
                    changelogSection.classList.add('fade-in');

                    btn.textContent = "Odvedi me na Edgar...";
                    isChangelogView = true;
                }, 500); // Match CSS transition time
            } else {
                // Navigate to Edgar
                // Use chrome.tabs.update to redirect the current tab or just window.location
                // Window.location works in extension pages
                window.location.href = "https://edgar.fer.hr";
            }
        });
    }
});
