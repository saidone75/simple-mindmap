/*
 * Alice's Simple Mind Maps
 * Copyright (C) 2026 Miss Alice & Saidone
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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
