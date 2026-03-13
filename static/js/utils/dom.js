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

    toast(message, type = 'info', duration = 3000, action = null) {
        const container = this._ensureToastContainer();

        // Notification SFX
        if (typeof GameAnimations !== 'undefined') {
            const sfxMap = { success: 'sfxSuccess', error: 'sfxError', warning: 'sfxWarning', info: 'sfxInfo' };
            const fn = sfxMap[type];
            if (fn && GameAnimations[fn]) GameAnimations[fn]();
        }

        const toast = this.create('div', {
            className: `toast toast-${type}`
        });
        toast.appendChild(this.create('span', { textContent: message }));

        if (action) {
            toast.appendChild(this.create('button', {
                className: 'toast-action',
                textContent: action.label,
                onClick: () => {
                    if (action.onClick) action.onClick();
                    toast.remove();
                }
            }));
        }

        container.appendChild(toast);

        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('toast-exit');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

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
    },

    // ===== CONTEXT MENU (right-click) =====
    _contextMenu: null,

    initContextMenu() {
        document.addEventListener('contextmenu', (e) => {
            const target = e.target;
            const isEditable = target.matches('input[type="text"], input[type="url"], input[type="search"], input:not([type]), textarea, [contenteditable="true"]');
            if (!isEditable) return;

            e.preventDefault();
            this._showContextMenu(e.clientX, e.clientY, target);
        });

        document.addEventListener('click', () => this._hideContextMenu());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this._hideContextMenu();
        });
    },

    _showContextMenu(x, y, target) {
        this._hideContextMenu();

        const hasSelection = target.selectionStart !== target.selectionEnd;

        const items = [
            { label: '✂️ Couper', action: () => document.execCommand('cut'), enabled: hasSelection },
            { label: '📋 Copier', action: () => document.execCommand('copy'), enabled: hasSelection },
            { label: '📌 Coller', action: async () => {
                try {
                    const res = await API.get('/api/clipboard');
                    if (res && res.text) {
                        const start = target.selectionStart;
                        const end = target.selectionEnd;
                        const val = target.value;
                        target.value = val.slice(0, start) + res.text + val.slice(end);
                        target.selectionStart = target.selectionEnd = start + res.text.length;
                        target.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } catch (_) {}
            }, enabled: true },
            { label: '🔘 Tout sélectionner', action: () => target.select(), enabled: true },
        ];

        const menu = this.create('div', { className: 'context-menu' },
            items.map(item => this.create('div', {
                className: `context-menu-item ${item.enabled ? '' : 'disabled'}`,
                textContent: item.label,
                onClick: (e) => {
                    e.stopPropagation();
                    if (!item.enabled) return;
                    target.focus();
                    item.action();
                    this._hideContextMenu();
                }
            }))
        );

        document.body.appendChild(menu);

        // Keep menu within viewport
        const rect = menu.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 5;
        if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 5;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        this._contextMenu = menu;
    },

    _hideContextMenu() {
        if (this._contextMenu) {
            this._contextMenu.remove();
            this._contextMenu = null;
        }
    }
};
