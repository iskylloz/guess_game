/**
 * Settings Page — Application preferences.
 * Persists all settings to data/settings.json via API.
 * Can render as a full page (#/settings) or as an overlay modal (Escape key).
 */
App.pages.settings = {
    _settings: null,
    _overlayOpen: false,

    async render(container) {
        await this._loadSettings();

        const page = DOM.create('div', { className: 'settings-page' }, [
            // Header
            DOM.create('div', { className: 'settings-header' }, [
                DOM.create('button', {
                    className: 'btn btn-ghost',
                    innerHTML: '← Retour',
                    onClick: () => window.history.back()
                }),
                DOM.create('h1', { textContent: 'Paramètres' })
            ]),
            this._buildContent()
        ]);

        container.appendChild(page);
    },

    /** Open settings as a modal overlay (usable from anywhere, including game). */
    async openOverlay() {
        if (this._overlayOpen) return;
        this._overlayOpen = true;

        await this._loadSettings();

        const panel = DOM.create('div', { className: 'settings-overlay' }, [
            DOM.create('div', { className: 'settings-overlay-header' }, [
                DOM.create('h2', { textContent: 'Paramètres' }),
                DOM.create('button', {
                    className: 'btn btn-ghost btn-sm',
                    textContent: '✕',
                    onClick: () => this.closeOverlay()
                })
            ]),
            this._buildContent()
        ]);

        const backdrop = DOM.showModal(panel);

        // Override backdrop click to also reset our flag
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) this._overlayOpen = false;
        });
    },

    closeOverlay() {
        if (!this._overlayOpen) return;
        this._overlayOpen = false;
        DOM.hideModal();
    },

    async _loadSettings() {
        try {
            this._settings = await API.get('/api/settings');
        } catch (e) {
            this._settings = { fullscreen: true, volumes: { master: 1, notifications: 1, animations: 1, questions: 1, ambiance: 1 } };
        }

        // Sync volumes from backend to Media
        if (this._settings.volumes) {
            for (const [ch, val] of Object.entries(this._settings.volumes)) {
                Media.setVolume(val, ch);
            }
        }
    },

    _buildContent() {
        return DOM.create('div', { className: 'settings-content' }, [
            // Display section
            DOM.create('div', { className: 'settings-section' }, [
                DOM.create('h2', { className: 'settings-section-title', textContent: 'Affichage' }),
                this._createFullscreenToggle()
            ]),
            // Audio section
            DOM.create('div', { className: 'settings-section' }, [
                DOM.create('h2', { className: 'settings-section-title', textContent: 'Audio' }),
                ...this._createVolumeSliders()
            ])
        ]);
    },

    async _saveSettings() {
        try {
            await API.put('/api/settings', this._settings);
        } catch (e) {
            // Silent fail — localStorage remains as fallback
        }
    },

    _createFullscreenToggle() {
        const row = DOM.create('div', { className: 'settings-toggle' });

        const info = DOM.create('div', { className: 'toggle-info' }, [
            DOM.create('span', { className: 'toggle-label', textContent: 'Plein écran' }),
            DOM.create('span', { className: 'toggle-desc', textContent: 'Afficher l\'application en mode plein écran' })
        ]);

        const isFs = this._settings.fullscreen !== false;
        const switchEl = DOM.create('div', {
            className: 'toggle-switch' + (isFs ? ' active' : '')
        });

        row.addEventListener('click', async () => {
            const newState = !this._settings.fullscreen;
            try {
                const result = await API.post('/api/toggle-fullscreen', { fullscreen: newState });
                this._settings.fullscreen = result.fullscreen;
                switchEl.classList.toggle('active', this._settings.fullscreen);
                DOM.toast(
                    this._settings.fullscreen ? 'Plein écran activé' : 'Plein écran désactivé',
                    'success'
                );
            } catch (e) {
                DOM.toast('Erreur lors du changement de mode', 'error');
            }
        });

        row.appendChild(info);
        row.appendChild(switchEl);
        return row;
    },

    _volumeChannels: [
        { key: 'master',        icon: '🔊', label: 'Volume global',         desc: 'Volume principal de l\'application' },
        { key: 'notifications', icon: '🔔', label: 'Notifications',         desc: 'Validation, refus, compte à rebours…' },
        { key: 'animations',    icon: '✨', label: 'Animations',            desc: 'Effets sonores des animations de jeu' },
        { key: 'questions',     icon: '🎵', label: 'Questions',             desc: 'Audio et vidéos des questions' },
    ],

    _createVolumeSliders() {
        return this._volumeChannels.map(ch => this._createVolumeSlider(ch));
    },

    _createVolumeSlider(channel) {
        const row = DOM.create('div', { className: 'settings-slider-row' });

        const info = DOM.create('div', { className: 'toggle-info' }, [
            DOM.create('span', { className: 'toggle-label', textContent: `${channel.icon}  ${channel.label}` }),
            DOM.create('span', { className: 'toggle-desc', textContent: channel.desc })
        ]);

        const controls = DOM.create('div', { className: 'volume-controls' });
        const currentVol = Math.round(Media.getVolume(channel.key) * 100);

        const valueLabel = DOM.create('span', {
            className: 'volume-value',
            textContent: currentVol + '%'
        });

        const slider = DOM.create('input', {
            type: 'range',
            className: 'volume-slider',
            min: '0',
            max: '100',
            value: currentVol.toString()
        });

        // Debounce save to avoid hammering the API on rapid slider moves
        let saveTimer = null;
        slider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            Media.setVolume(val / 100, channel.key);
            valueLabel.textContent = val + '%';

            // Update local settings object
            this._settings.volumes = this._settings.volumes || {};
            this._settings.volumes[channel.key] = val / 100;

            // Debounced save to backend
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => this._saveSettings(), 500);
        });

        controls.appendChild(slider);
        controls.appendChild(valueLabel);

        row.appendChild(info);
        row.appendChild(controls);
        return row;
    }
};
