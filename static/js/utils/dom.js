/**
 * DOM utilities: element creation, modals, toasts, confirm dialogs.
 */
const DOM = {
    /**
     * Create an element with attributes and children.
     */
    create(tag, attrs = {}, children = []) {
        const el = document.createElement(tag);
        for (const [key, val] of Object.entries(attrs)) {
            if (key === 'className') {
                el.className = val;
            } else if (key === 'textContent') {
                el.textContent = val;
            } else if (key === 'innerHTML') {
                el.innerHTML = val;
            } else if (key === 'style' && typeof val === 'object') {
                Object.assign(el.style, val);
            } else if (key.startsWith('on') && typeof val === 'function') {
                el.addEventListener(key.slice(2).toLowerCase(), val);
            } else if (key === 'dataset' && typeof val === 'object') {
                for (const [dk, dv] of Object.entries(val)) {
                    el.dataset[dk] = dv;
                }
            } else {
                el.setAttribute(key, val);
            }
        }
        for (const child of children) {
            if (typeof child === 'string') {
                el.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                el.appendChild(child);
            }
        }
        return el;
    },

    $(selector, parent = document) {
        return parent.querySelector(selector);
    },

    $$(selector, parent = document) {
        return [...parent.querySelectorAll(selector)];
    },

    /**
     * Clear an element's children.
     */
    clear(el) {
        while (el.firstChild) el.removeChild(el.firstChild);
    },

    // ===== MODAL SYSTEM =====
    _modalStack: [],

    showModal(contentEl) {
        const backdrop = this.create('div', { className: 'modal-backdrop' });
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) this.hideModal();
        });
        backdrop.appendChild(contentEl);
        document.body.appendChild(backdrop);
        this._modalStack.push(backdrop);

        // ESC to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.hideModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        backdrop._escHandler = escHandler;

        return backdrop;
    },

    hideModal() {
        const backdrop = this._modalStack.pop();
        if (backdrop) {
            if (backdrop._escHandler) {
                document.removeEventListener('keydown', backdrop._escHandler);
            }
            backdrop.style.animation = 'fadeOut var(--transition-normal) forwards';
            setTimeout(() => backdrop.remove(), 250);
        }
    },

    hideAllModals() {
        while (this._modalStack.length > 0) {
            this.hideModal();
        }
    },

    // ===== TOAST SYSTEM =====
    _toastContainer: null,

    _ensureToastContainer() {
        if (!this._toastContainer) {
            this._toastContainer = this.create('div', { className: 'toast-container' });
            document.body.appendChild(this._toastContainer);
        }
        return this._toastContainer;
    },

    toast(message, type = 'info', duration = 3000) {
        const container = this._ensureToastContainer();
        const toast = this.create('div', {
            className: `toast toast-${type}`,
            textContent: message
        });
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }, duration);

        return toast;
    },

    // ===== CONFIRM DIALOG =====
    confirm(message, title = 'Confirmation') {
        return new Promise((resolve) => {
            const dialog = this.create('div', { className: 'modal confirm-dialog' }, [
                this.create('h3', { textContent: title }),
                this.create('p', { textContent: message }),
                this.create('div', { className: 'btn-group' }, [
                    this.create('button', {
                        className: 'btn btn-outline',
                        textContent: 'Annuler',
                        onClick: () => { this.hideModal(); resolve(false); }
                    }),
                    this.create('button', {
                        className: 'btn btn-primary',
                        textContent: 'Confirmer',
                        onClick: () => { this.hideModal(); resolve(true); }
                    })
                ])
            ]);
            this.showModal(dialog);
        });
    },

    // ===== PROMPT DIALOG =====
    prompt(message, defaultValue = '', title = 'Saisie') {
        return new Promise((resolve) => {
            const input = this.create('input', {
                className: 'input',
                type: 'text',
                value: defaultValue,
                style: { marginBottom: '16px' }
            });

            const dialog = this.create('div', { className: 'modal confirm-dialog' }, [
                this.create('h3', { textContent: title }),
                this.create('p', { textContent: message }),
                input,
                this.create('div', { className: 'btn-group' }, [
                    this.create('button', {
                        className: 'btn btn-outline',
                        textContent: 'Annuler',
                        onClick: () => { this.hideModal(); resolve(null); }
                    }),
                    this.create('button', {
                        className: 'btn btn-primary',
                        textContent: 'OK',
                        onClick: () => { this.hideModal(); resolve(input.value); }
                    })
                ])
            ]);
            this.showModal(dialog);
            setTimeout(() => input.focus(), 100);
        });
    },

    /**
     * Format seconds to MM:SS.
     */
    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    },

    /**
     * Format seconds to SS.S (for audio editor).
     */
    formatTimeDecimal(seconds) {
        return seconds.toFixed(1) + 's';
    },

    /**
     * Debounce function.
     */
    debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }
};
