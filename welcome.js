document.addEventListener('DOMContentLoaded', () => {
    const letter = document.getElementById('letter');

    // Opened after an update (not a fresh install): greet returning users and point them to the letter.
    if (new URLSearchParams(location.search).get('from') === 'update') {
        document.getElementById('returning').classList.add('show');
    }

    document.getElementById('read-letter').addEventListener('click', () => {
        letter.open = true;
        letter.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('action-btn').addEventListener('click', () => {
        window.location.href = 'https://edgar.fer.hr';
    });
});
