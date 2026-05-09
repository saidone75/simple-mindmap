(function () {
    function showLoading(msg) {
        let el = document.getElementById('loading-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'loading-overlay';
            el.innerHTML = '<div class="loading-icon" aria-hidden="true">🐇</div><p></p>';
            document.body.appendChild(el);
        }
        el.querySelector('p').textContent = msg || 'Caricamento...';
        el.style.display = 'flex';
    }

    function hideLoading() {
        const el = document.getElementById('loading-overlay');
        if (el) el.style.display = 'none';
    }

    globalThis.showLoading = showLoading;
    globalThis.hideLoading = hideLoading;
})();
