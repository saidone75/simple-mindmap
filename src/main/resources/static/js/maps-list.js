(function () {
    const bindAiGenerateLoading = function () {
        const form = document.getElementById('ai-generate-form');
        if (!form) return;
        form.addEventListener('submit', (event) => {
            if (typeof globalThis.showLoading !== 'function') return;

            event.preventDefault();
            globalThis.showLoading('Generazione mappa con AI in corso...');

            requestAnimationFrame(() => {
                form.submit();
            });
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindAiGenerateLoading, { once: true });
    } else {
        bindAiGenerateLoading();
    }
})();
