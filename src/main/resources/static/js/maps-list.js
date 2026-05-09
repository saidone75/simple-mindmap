(function () {
    const bindAiGenerateLoading = function () {
        const form = document.getElementById('ai-generate-form');
        if (!form) return;
        form.addEventListener('submit', () => {
            if (typeof globalThis.showLoading === 'function') {
                globalThis.showLoading('Generazione mappa con AI in corso...');
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindAiGenerateLoading, { once: true });
    } else {
        bindAiGenerateLoading();
    }
})();
