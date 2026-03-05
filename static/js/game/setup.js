/**
 * Game Setup Screen — Mode, teams, black chance, timer config.
 */
App.pages.game = {
    render(container, params) {
        const subPage = params[0] || 'setup';
        if (subPage === 'setup') {
            this.renderSetup(container);
        } else if (subPage === 'play') {
            GameUI.render(container);
        } else if (subPage === 'end') {
            GameEnd.render(container);
        }
    },

    state: {
        mode: 'classic',
        teamCount: 2,
        teamNames: ['Équipe 1', 'Équipe 2', 'Équipe 3', 'Équipe 4'],
        teamIcons: ['belier', 'balance', 'leo', 'cancer'],
        blackChance: 5,
        adminMode: false,
        timerDuration: 60,
        customTimer: ''
    },

    renderSetup(container) {
        const s = this.state;

        // Reuse outer shell to avoid full-page flash
        let screen = container.querySelector('.game-setup');
        const isFirstRender = !screen;

        if (isFirstRender) {
            screen = DOM.create('div', { className: 'game-setup' });
            screen.appendChild(DOM.create('button', {
                className: 'btn btn-ghost back-btn',
                textContent: '← Accueil',
                onClick: () => App.navigate('#/home')
            }));
            DOM.clear(container);
            container.appendChild(screen);
        }

        // Save scroll position before replacing content
        const scrollTop = screen.scrollTop;

        // Build new content
        const content = DOM.create('div', { className: 'game-setup-content' });
        if (isFirstRender) content.classList.add('animate-in');

        content.appendChild(DOM.create('h1', { textContent: '⚙️ Configuration de la partie' }));

        // Admin mode
        const adminSection = DOM.create('div', { className: 'setup-section' });
        const adminLabel = DOM.create('label', { className: 'checkbox-wrapper' });
        const adminCheck = DOM.create('input', {
            type: 'checkbox',
            ...(s.adminMode ? { checked: '' } : {})
        });
        adminCheck.checked = s.adminMode;
        adminCheck.addEventListener('change', () => {
            s.adminMode = adminCheck.checked;
            this.renderSetup(container);
        });
        adminLabel.appendChild(adminCheck);
        adminLabel.appendChild(DOM.create('span', { textContent: '🔧 Mode Admin (test des questions)' }));
        adminSection.appendChild(adminLabel);
        content.appendChild(adminSection);

        if (!s.adminMode) {
            // Mode selector
            content.appendChild(this._buildModeSelector(container));

            // Teams (only for classic/timer, not random)
            if (s.mode !== 'random') {
                content.appendChild(this._buildTeamSection(container));
            }
        }

        // Black chance
        if (!s.adminMode) {
            content.appendChild(this._buildBlackChance());
        }

        // Timer options (only for timer mode)
        if (s.mode === 'timer' && !s.adminMode) {
            content.appendChild(this._buildTimerOptions(container));
        }

        // Start button
        content.appendChild(DOM.create('button', {
            className: 'btn btn-success start-game-btn',
            textContent: '🚀 Lancer la partie',
            onClick: () => this.startGame()
        }));

        // Replace only the content, keeping the shell stable
        const oldContent = screen.querySelector('.game-setup-content');
        if (oldContent) {
            screen.replaceChild(content, oldContent);
        } else {
            screen.appendChild(content);
        }

        // Restore scroll position
        screen.scrollTop = scrollTop;
    },

    // ===== Section builders =====

    _buildModeSelector(container) {
        const s = this.state;
        const section = DOM.create('div', { className: 'setup-section' });
        section.appendChild(DOM.create('h3', { textContent: 'Mode de jeu' }));
        const selector = DOM.create('div', { className: 'mode-selector' });

        const modes = [
            { id: 'random', label: '🎲 Aléatoire', desc: 'Tous ensemble, questions au hasard' },
            { id: 'classic', label: '🎯 Classique', desc: 'Équipes, choix par catégorie' },
            { id: 'timer', label: '⏱️ Chronomètre', desc: 'Équipes, temps limité par question' }
        ];

        for (const mode of modes) {
            selector.appendChild(DOM.create('button', {
                className: `mode-btn ${s.mode === mode.id ? 'active' : ''}`,
                onClick: () => { s.mode = mode.id; this.renderSetup(container); }
            }, [
                DOM.create('div', { textContent: mode.label }),
                DOM.create('div', { className: 'text-sm text-muted', textContent: mode.desc })
            ]));
        }

        section.appendChild(selector);
        return section;
    },

    _buildTeamSection(container) {
        const s = this.state;
        const ICONS = ['belier', 'balance', 'cancer', 'capricorne', 'leo', 'poissons', 'sagittaire', 'taureau', 'verseau'];
        const section = DOM.create('div', { className: 'setup-section' });
        section.appendChild(DOM.create('h3', { textContent: 'Équipes' }));

        const controls = DOM.create('div', { className: 'team-count-controls' });
        controls.appendChild(DOM.create('button', {
            className: 'btn btn-outline btn-sm',
            textContent: '−',
            onClick: () => {
                if (s.teamCount > 2) { s.teamCount--; this.renderSetup(container); }
            }
        }));
        controls.appendChild(DOM.create('span', {
            className: 'team-count-display',
            textContent: s.teamCount.toString()
        }));
        controls.appendChild(DOM.create('button', {
            className: 'btn btn-outline btn-sm',
            textContent: '+',
            onClick: () => {
                if (s.teamCount < 4) { s.teamCount++; this.renderSetup(container); }
            }
        }));
        section.appendChild(controls);

        const teamInputs = DOM.create('div', { className: 'team-inputs' });
        for (let i = 0; i < s.teamCount; i++) {
            const block = DOM.create('div', { className: 'team-block' });

            // Row: number + icon preview + name input
            const row = DOM.create('div', { className: 'team-input-row' });
            row.appendChild(DOM.create('span', { className: 'team-number', textContent: `#${i + 1}` }));
            row.appendChild(DOM.create('img', {
                className: 'team-icon-preview',
                src: `/static/assets/teams/${s.teamIcons[i]}.png`
            }));
            const input = DOM.create('input', {
                className: 'input',
                type: 'text',
                value: s.teamNames[i],
                placeholder: `Équipe ${i + 1}`
            });
            input.addEventListener('input', (e) => { s.teamNames[i] = e.target.value; });
            row.appendChild(input);
            block.appendChild(row);

            // Icon picker row
            const picker = DOM.create('div', { className: 'team-icon-picker' });
            for (const iconId of ICONS) {
                const isSelected = s.teamIcons[i] === iconId;
                const usedByOther = s.teamIcons.slice(0, s.teamCount).some((ic, idx) => ic === iconId && idx !== i);
                const option = DOM.create('img', {
                    className: `team-icon-option ${isSelected ? 'selected' : ''} ${usedByOther ? 'used' : ''}`,
                    src: `/static/assets/teams/${iconId}.png`,
                    title: iconId.charAt(0).toUpperCase() + iconId.slice(1),
                    onClick: () => {
                        s.teamIcons[i] = iconId;
                        this.renderSetup(container);
                    }
                });
                picker.appendChild(option);
            }
            block.appendChild(picker);

            teamInputs.appendChild(block);
        }
        section.appendChild(teamInputs);
        return section;
    },

    _buildBlackChance() {
        const s = this.state;
        const section = DOM.create('div', { className: 'setup-section' });
        section.appendChild(DOM.create('h3', { textContent: '⚫ Chance Questions Noires' }));
        const sliderContainer = DOM.create('div', { className: 'slider-container' });
        const slider = DOM.create('input', {
            className: 'range',
            type: 'range',
            min: '0',
            max: '20',
            value: s.blackChance.toString()
        });
        const sliderVal = DOM.create('span', {
            className: 'slider-value',
            textContent: s.blackChance + '%'
        });
        slider.addEventListener('input', (e) => {
            s.blackChance = parseInt(e.target.value);
            sliderVal.textContent = s.blackChance + '%';
        });
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(sliderVal);
        section.appendChild(sliderContainer);
        return section;
    },

    _buildTimerOptions(container) {
        const s = this.state;
        const section = DOM.create('div', { className: 'setup-section' });
        section.appendChild(DOM.create('h3', { textContent: 'Temps par question' }));
        const timerOpts = DOM.create('div', { className: 'timer-options' });

        const presets = [30, 60, 120, 300];
        const isCustom = s.customTimer !== '' && !presets.includes(s.timerDuration);

        const durations = [
            { value: 30, label: '30s' },
            { value: 60, label: '1 min' },
            { value: 120, label: '2 min' },
            { value: 300, label: '5 min' }
        ];

        for (const d of durations) {
            timerOpts.appendChild(DOM.create('button', {
                className: `timer-btn ${s.timerDuration === d.value && !isCustom ? 'active' : ''}`,
                textContent: d.label,
                onClick: () => { s.timerDuration = d.value; s.customTimer = ''; this.renderSetup(container); }
            }));
        }

        // Custom — highlighted like a preset when active
        const customWrap = DOM.create('div', {
            className: `timer-custom ${isCustom ? 'active' : ''}`
        });
        const customInput = DOM.create('input', {
            className: 'input',
            type: 'number',
            min: '10',
            max: '3600',
            placeholder: 'sec',
            value: s.customTimer
        });
        customInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (val > 0) {
                s.timerDuration = val;
                s.customTimer = e.target.value;
                // Update visuals without re-render to keep input focus
                timerOpts.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active'));
                customWrap.classList.add('active');
            }
        });
        customWrap.appendChild(customInput);
        customWrap.appendChild(DOM.create('span', { textContent: 's', className: 'text-muted' }));
        timerOpts.appendChild(customWrap);

        section.appendChild(timerOpts);
        return section;
    },

    async startGame() {
        const s = this.state;

        // Build config
        let teams;
        if (s.adminMode) {
            teams = [{ name: 'Admin' }];
        } else if (s.mode === 'random') {
            teams = [{ name: 'Joueurs' }];
        } else {
            teams = [];
            for (let i = 0; i < s.teamCount; i++) {
                teams.push({ name: s.teamNames[i] || `Équipe ${i + 1}`, icon: s.teamIcons[i] });
            }
        }

        const config = {
            mode: s.adminMode ? 'classic' : s.mode,
            teams: teams,
            blackChance: s.adminMode ? 0 : s.blackChance,
            adminMode: s.adminMode,
            timerDuration: (s.mode === 'timer' && !s.adminMode) ? s.timerDuration : 0
        };

        // Check we have questions
        try {
            const stats = await API.get('/api/questions/stats');
            if (stats.total === 0) {
                DOM.toast('Aucune question disponible ! Créez des questions dans l\'éditeur.', 'error', 5000);
                return;
            }
        } catch (e) {
            DOM.toast('Erreur de chargement des questions.', 'error');
            return;
        }

        App.gameConfig = config;
        App.navigate('#/game/play');
    }
};
