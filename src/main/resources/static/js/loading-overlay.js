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
        el.setAttribute('aria-busy', 'true');
    }

    function hideLoading() {
        const el = document.getElementById('loading-overlay');
        if (!el) return;
        el.style.display = 'none';
        el.setAttribute('aria-busy', 'false');
    }

    globalThis.showLoading = showLoading;
    globalThis.hideLoading = hideLoading;

    function resetLoadingOverlay() {
        hideLoading();
    }

    // Ensure overlays are hidden when a page is restored from browser history (bfcache)
    // or when the tab regains visibility after a navigation.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resetLoadingOverlay, { once: true });
    } else {
        resetLoadingOverlay();
    }

    window.addEventListener('pageshow', resetLoadingOverlay);
})();
