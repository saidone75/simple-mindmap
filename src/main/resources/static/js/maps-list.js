(function () {
    const appDialog = document.getElementById("app-dialog");
    const appDialogTitle = document.getElementById("app-dialog-title");
    const appDialogMessage = document.getElementById("app-dialog-message");
    const appDialogInput = document.getElementById("app-dialog-input");
    const appDialogCancel = document.getElementById("app-dialog-cancel");
    const appDialogConfirm = document.getElementById("app-dialog-confirm");

    function openDialog({ title, message, mode = "alert" }) {
        if (!appDialog || !appDialogTitle || !appDialogMessage || !appDialogConfirm || !appDialogCancel) {
            return Promise.resolve(mode === "confirm" ? false : true);
        }
        return new Promise((resolve) => {
            appDialogTitle.textContent = title ?? "";
            appDialogMessage.textContent = message ?? "";
            appDialogConfirm.textContent = mode === "alert" ? "Ok" : "Conferma";
            appDialogCancel.classList.toggle("hidden", mode === "alert");
            if (appDialogInput) appDialogInput.classList.add("hidden");

            const cleanup = () => {
                if (appDialog.open && typeof appDialog.close === "function") appDialog.close();
                else appDialog.removeAttribute("open");
                appDialogConfirm.removeEventListener("click", onConfirm);
                appDialogCancel.removeEventListener("click", onCancel);
                appDialog.removeEventListener("click", onOverlayClick);
                document.removeEventListener("keydown", onEscape);
            };
            const onConfirm = () => {
                cleanup();
                resolve(true);
            };
            const onCancel = () => {
                cleanup();
                resolve(false);
            };
            const onOverlayClick = (event) => {
                if (event.target === appDialog) onCancel();
            };
            const onEscape = (event) => {
                if (event.key === "Escape") onCancel();
            };

            appDialogConfirm.addEventListener("click", onConfirm);
            appDialogCancel.addEventListener("click", onCancel);
            appDialog.addEventListener("click", onOverlayClick);
            document.addEventListener("keydown", onEscape);
            if (typeof appDialog.showModal === "function") appDialog.showModal();
            else appDialog.setAttribute("open", "open");
        });
    }

    const bindAiGenerateLoading = function () {
        const form = document.getElementById('ai-generate-form');
        if (!form) return;
        form.addEventListener('submit', (event) => {
            if (typeof globalThis.showLoading !== 'function') return;

            event.preventDefault();
            globalThis.showLoading('Generazione mappa con AI in corso...');

            setTimeout(() => {
                form.submit();
            }, 80);
        });
    };


    const bindCloneMapConfirm = function () {
        const forms = document.querySelectorAll(".clone-map-form");
        forms.forEach((form) => {
            form.addEventListener("submit", async (event) => {
                event.preventDefault();
                const confirmed = await openDialog({
                    title: "Clonare la mappa?",
                    message: "Verrà creata una copia completa della mappa.",
                    mode: "confirm"
                });
                if (confirmed) form.submit();
            });
        });
    };

    const bindDeleteMapConfirm = function () {
        const forms = document.querySelectorAll(".delete-map-form");
        forms.forEach((form) => {
            form.addEventListener("submit", async (event) => {
                event.preventDefault();
                const confirmed = await openDialog({
                    title: "Eliminare la mappa?",
                    message: "Questa azione non può essere annullata.",
                    mode: "confirm"
                });
                if (confirmed) form.submit();
            });
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            bindAiGenerateLoading();
            bindCloneMapConfirm();
            bindDeleteMapConfirm();
        }, { once: true });
    } else {
        bindAiGenerateLoading();
        bindCloneMapConfirm();
        bindDeleteMapConfirm();
    }
})();
