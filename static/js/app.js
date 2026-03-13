/**
 * SPA Router and Page Manager.
 * Each page module registers itself via App.pages[name] = { render(container, params) }.
 */
const App = {
    currentPage: null,
    currentPageName: null,
    pages: {},

    init() {
        window.addEventListener('hashchange', () => this.route());

        // Right-click context menu for text inputs
        DOM.initContextMenu();

        // Global Escape keybind — opens/closes settings overlay from anywhere
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;

            const settings = App.pages.settings;

            // If settings overlay is open and it's the only modal (top of stack), close it
            if (settings._overlayOpen && DOM._modalStack.length === 1) {
                settings.closeOverlay();
                e.stopImmediatePropagation();
                return;
            }

            // If any other modal is open, let the modal system handle ESC
            if (DOM._modalStack.length > 0) return;

            // No modals open — open settings overlay (unless already on settings page)
            if (App.currentPageName === 'settings') return;
            settings.openOverlay();
            e.stopImmediatePropagation();
        });

        // Global UI click sound on buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('button, .btn')) {
                GameAnimations.sfxClick();
            }
        });

        // Offline detection
        window.addEventListener('online', () => {
            document.body.classList.remove('offline');
            DOM.toast('Connexion rétablie', 'success');
        });
        window.addEventListener('offline', () => {
            document.body.classList.add('offline');
            DOM.toast('Mode hors-ligne : les questions YouTube seront masquées.', 'warning', 5000);
        });
        if (!navigator.onLine) {
            document.body.classList.add('offline');
        }

        // Load persisted settings (volumes) from backend
        this._loadSettings();

        // Check for updates after 3s
        this._checkForUpdate();

        // Global settings gear button (persistent across pages)
        this._createSettingsButton();

        this.route();
    },

    async _loadSettings() {
        try {
            const settings = await API.get('/api/settings');
            if (settings.volumes) {
                for (const [ch, val] of Object.entries(settings.volumes)) {
                    Media.setVolume(val, ch);
                }
            }
        } catch (e) {
            // Fallback to localStorage values (already loaded by Media)
        }
    },

    _checkForUpdate() {
        setTimeout(async () => {
            try {
                const info = await API.get('/api/update-check');
                if (info && info.available) {
                    DOM.toast(
                        `Nouvelle version v${info.latest} disponible !`,
                        'info', 0,
                        { label: 'Télécharger', onClick: () => window.open(info.url) }
                    );
                }
            } catch (_) {}
        }, 3000);
    },

    _createSettingsButton() {
        const btn = DOM.create('button', {
            className: 'global-settings-btn',
            innerHTML: '⚙',
            title: 'Paramètres (Échap)',
            onClick: () => {
                if (App.pages.settings._overlayOpen) {
                    App.pages.settings.closeOverlay();
                } else {
                    App.pages.settings.openOverlay();
                }
            }
        });
        document.body.appendChild(btn);
    },

    route() {
        const hash = location.hash.slice(1) || '/home';
        const parts = hash.split('/').filter(Boolean);
        const pageName = parts[0];
        const params = parts.slice(1);

        // Cleanup previous page
        if (this.currentPage && this.currentPage.destroy) {
            this.currentPage.destroy();
        }
        Media.stopAllAudio();

        const container = document.getElementById('app');
        DOM.clear(container);

        // Hide settings button during active game play (keybind still works)
        const settingsBtn = document.querySelector('.global-settings-btn');
        if (settingsBtn) {
            const isGamePlay = pageName === 'game' && (params[0] === 'play' || params[0] === 'end');
            settingsBtn.style.display = isGamePlay ? 'none' : '';
        }

        if (this.pages[pageName]) {
            this.currentPageName = pageName;
            this.currentPage = this.pages[pageName];
            this.currentPage.render(container, params);
        } else {
            location.hash = '#/home';
        }
    },

    navigate(hash) {
        location.hash = hash;
    },

    /**
     * Store shared game state between setup and play pages.
     */
    gameConfig: null
};

document.addEventListener('DOMContentLoaded', () => App.init());
