/**
 * Game UI — Renders category grid, question/answer display, score bar.
 */
const GameUI = {
    engine: null,
    container: null,
    showingAnswer: false,

    async render(container) {
        this.container = container;
        this.showingAnswer = false;

        if (!App.gameConfig) {
            App.navigate('#/game/setup');
            return;
        }

        // Initialize engine
        this.engine = new GameEngine(App.gameConfig);
        await this.engine.init();

        // Preload SFX for instant playback
        Media.preloadSFX();
        Media.playSFX('game_start');

        // Bind timer callbacks
        if (this.engine.timer) {
            this.engine.onTimerTick = () => this.updateTimerDisplay();
            this.engine.onTimerEnd = () => this.onTimerEnd();
        }

        if (this.engine.allQuestions.length === 0) {
            DOM.toast('Aucune question disponible !', 'error');
            App.navigate('#/game/setup');
            return;
        }

        if (this.engine.mode === 'random') {
            // Auto-pick first question
            const q = this.engine.getNextQuestion();
            if (q) this.renderQuestion();
            else this.renderCategoryGrid();
        } else {
            this.renderCategoryGrid();
        }
    },

    destroy() {
        if (this.engine && this.engine.timer) {
            this.engine.timer.stop();
        }
        Media.stopAllAudio();
    },

    // ===== CATEGORY GRID =====

    renderCategoryGrid() {
        this.showingAnswer = false;
        DOM.clear(this.container);

        const screen = DOM.create('div', { className: 'game-play' });

        // Header
        screen.appendChild(this.buildHeader());

        // Grid
        const gridContainer = DOM.create('div', { className: 'category-grid-container' });
        const remaining = this.engine.getRemainingByCategory();

        // Determine categories to show
        let cats = Media.CATEGORIES.filter(c => c.id !== 'black');
        if (this.engine.adminMode) {
            cats = Media.CATEGORIES; // Include black
        }

        const grid = DOM.create('div', { className: 'category-grid' });

        for (const cat of cats) {
            const count = remaining[cat.id] || 0;
            const tile = DOM.create('div', {
                className: `category-tile ${count === 0 ? 'disabled' : ''}`,
                style: {
                    backgroundColor: cat.color,
                    color: cat.textColor,
                    borderColor: count > 0 ? 'rgba(255,255,255,0.2)' : 'transparent'
                },
                onClick: () => {
                    if (count > 0) this.selectCategory(cat.id);
                }
            }, [
                DOM.create('span', { className: 'category-tile-emoji', textContent: cat.emoji }),
                DOM.create('span', { textContent: cat.label }),
                DOM.create('span', { className: 'category-tile-count', textContent: `${count} restante${count > 1 ? 's' : ''}` })
            ]);
            grid.appendChild(tile);
        }

        gridContainer.appendChild(grid);
        screen.appendChild(gridContainer);

        // Score bar
        screen.appendChild(this.buildScoreBar());

        this.container.appendChild(screen);
    },

    selectCategory(categoryId) {
        Media.playSFX('click');
        const q = this.engine.getNextQuestion(categoryId);
        if (!q) {
            DOM.toast('Plus de questions dans cette catégorie !', 'warning');
            return;
        }

        // If black override happened, show dramatic reveal
        if (this.engine.currentIsBlack && q.category === 'black' && categoryId !== 'black') {
            Media.playSFX('black_reveal');
            DOM.toast('⚫ Question NOIRE ! Points x2 !', 'warning', 3000);
        }

        this.renderQuestion();
    },

    // ===== QUESTION DISPLAY =====

    renderQuestion() {
        this.showingAnswer = false;
        DOM.clear(this.container);
        Media.stopChannel('questions');

        const q = this.engine.currentQuestion;
        if (!q) return;

        const cat = Media.getCategoryById(q.category);
        const screen = DOM.create('div', { className: 'game-play' });

        // Header
        screen.appendChild(this.buildHeader());

        // Question container
        const qContainer = DOM.create('div', { className: 'question-container' });

        // Category badge
        qContainer.appendChild(DOM.create('span', {
            className: `badge badge-${q.category}`,
            textContent: `${cat.emoji} ${cat.label}${this.engine.currentIsBlack ? ' ×2' : ''}`
        }));

        // Media
        if (q.question.image) {
            qContainer.appendChild(this._createAutoSizedImage(`/media/${q.question.image}`, qContainer));
        }
        if (q.question.audio) {
            qContainer.appendChild(Media.createAudioPlayer(`/media/${q.question.audio}`));
        }
        if (q.question.youtube && navigator.onLine) {
            const videoId = Media.extractYouTubeId(q.question.youtube);
            if (videoId) {
                const ytDiv = DOM.create('div', { className: 'game-youtube' });
                ytDiv.appendChild(Media.createYouTubeEmbed(videoId));
                qContainer.appendChild(ytDiv);
            }
        }

        // Question text
        qContainer.appendChild(DOM.create('div', {
            className: 'question-text',
            textContent: q.question.text
        }));

        screen.appendChild(qContainer);

        // Actions
        const actions = DOM.create('div', { className: 'game-actions' });
        actions.appendChild(DOM.create('button', {
            className: 'btn btn-primary btn-lg',
            textContent: '👁️ Voir la réponse',
            onClick: () => this.renderAnswer()
        }));
        screen.appendChild(actions);

        // Score bar
        screen.appendChild(this.buildScoreBar());

        this.container.appendChild(screen);
    },

    // ===== ANSWER DISPLAY =====

    renderAnswer() {
        this.showingAnswer = true;
        DOM.clear(this.container);
        Media.stopChannel('questions');

        // Pause per-question timer while reviewing answer
        if (this.engine.timer) {
            this.engine.pauseTimer();
        }

        const q = this.engine.currentQuestion;
        if (!q) return;

        const cat = Media.getCategoryById(q.category);
        const screen = DOM.create('div', { className: 'game-play' });

        // Header
        screen.appendChild(this.buildHeader());

        // Answer container
        const aContainer = DOM.create('div', { className: 'question-container' });

        // Category badge
        aContainer.appendChild(DOM.create('span', {
            className: `badge badge-${q.category}`,
            textContent: `${cat.emoji} ${cat.label}${this.engine.currentIsBlack ? ' ×2' : ''}`
        }));

        // Answer media
        if (q.answer.image) {
            aContainer.appendChild(this._createAutoSizedImage(`/media/${q.answer.image}`, aContainer));
        }
        if (q.answer.audio) {
            aContainer.appendChild(Media.createAudioPlayer(`/media/${q.answer.audio}`));
        }
        if (q.answer.youtube && navigator.onLine) {
            const videoId = Media.extractYouTubeId(q.answer.youtube);
            if (videoId) {
                const ytDiv = DOM.create('div', { className: 'game-youtube' });
                ytDiv.appendChild(Media.createYouTubeEmbed(videoId));
                aContainer.appendChild(ytDiv);
            }
        }

        // Answer text
        aContainer.appendChild(DOM.create('div', {
            className: 'answer-text',
            textContent: q.answer.text
        }));

        screen.appendChild(aContainer);

        // Action buttons
        const actions = DOM.create('div', { className: 'game-actions' });
        actions.appendChild(DOM.create('button', {
            className: 'btn btn-outline btn-lg',
            textContent: '❓ Voir la question',
            onClick: () => this.renderQuestion()
        }));
        actions.appendChild(DOM.create('button', {
            className: 'btn btn-success btn-lg',
            textContent: '✅ Valider',
            onClick: () => this.onValidate()
        }));
        actions.appendChild(DOM.create('button', {
            className: 'btn btn-danger btn-lg',
            textContent: '❌ Refuser',
            onClick: () => this.onRefuse()
        }));
        actions.appendChild(DOM.create('button', {
            className: 'btn btn-outline btn-lg',
            textContent: '🚫 Annuler',
            onClick: () => this.onCancel()
        }));
        screen.appendChild(actions);

        // Score bar
        screen.appendChild(this.buildScoreBar());

        this.container.appendChild(screen);
    },

    // ===== ACTIONS =====

    onValidate() {
        Media.stopChannel('questions');
        Media.playSFX('correct');
        this.engine.validate();
        if (this.engine.isFinished) {
            App.navigate('#/game/end');
        } else if (this.engine.mode === 'random') {
            const q = this.engine.getNextQuestion();
            if (q) this.renderQuestion();
            else App.navigate('#/game/end');
        } else {
            this.renderCategoryGrid();
        }
    },

    onRefuse() {
        Media.stopChannel('questions');
        Media.playSFX('wrong');
        this.engine.refuse();
        if (this.engine.isFinished) {
            App.navigate('#/game/end');
        } else if (this.engine.mode === 'random') {
            const q = this.engine.getNextQuestion();
            if (q) this.renderQuestion();
            else App.navigate('#/game/end');
        } else {
            this.renderCategoryGrid();
        }
    },

    onCancel() {
        Media.stopChannel('questions');
        Media.playSFX('cancel');
        this.engine.cancel();
        if (this.engine.mode === 'random') {
            const q = this.engine.getNextQuestion();
            if (q) this.renderQuestion();
            else App.navigate('#/game/end');
        } else {
            this.renderCategoryGrid();
        }
    },

    onTimerEnd() {
        // Per-question timer expired — show popup, user still decides outcome
        if (this.showingAnswer) return; // Already reviewing answer, ignore

        Media.playSFX('timer_end');
        DOM.hideAllModals();
        const modal = DOM.create('div', { className: 'modal confirm-dialog' }, [
            DOM.create('h3', { textContent: '⏱️ Temps écoulé !' }),
            DOM.create('p', { textContent: 'Le temps pour cette question est écoulé.' }),
            DOM.create('div', { className: 'btn-group' }, [
                DOM.create('button', {
                    className: 'btn btn-primary',
                    textContent: '👁️ Voir la réponse',
                    onClick: () => { DOM.hideModal(); this.renderAnswer(); }
                })
            ])
        ]);
        DOM.showModal(modal);
    },

    // ===== IMAGE AUTO-SIZING =====

    _createAutoSizedImage(src, container) {
        const mediaDiv = DOM.create('div', { className: 'question-media' });
        const imgEl = DOM.create('img', { src });
        imgEl.addEventListener('load', () => {
            const rect = container.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            // Reserve space for badge (~36px), text (~50px), gaps (~48px)
            const reservedH = 140;
            const availH = Math.max(rect.height - reservedH, 100);
            const size = Media.computeImageSize(imgEl, rect.width, availH);
            imgEl.style.width = size.width + 'px';
            imgEl.style.height = size.height + 'px';
        });
        mediaDiv.appendChild(imgEl);
        return mediaDiv;
    },

    // ===== UI HELPERS =====

    buildHeader() {
        const header = DOM.create('div', { className: 'game-header' });

        const left = DOM.create('div', { className: 'game-header-left' });
        left.appendChild(DOM.create('button', {
            className: 'btn btn-ghost btn-sm',
            textContent: '← Quitter',
            onClick: async () => {
                const confirmed = await DOM.confirm('Quitter la partie en cours ?');
                if (confirmed) App.navigate('#/home');
            }
        }));
        header.appendChild(left);

        // Center: question counter
        const center = DOM.create('div', { className: 'game-header-center' });
        const used = this.engine.usedQuestionIds.size;
        const total = this.engine.allQuestions.length;
        center.textContent = `Question ${used} / ${total}`;
        header.appendChild(center);

        // Right: current team + timer + end button
        const right = DOM.create('div', { className: 'game-header-right' });

        // Show timer only during active question (not on category grid)
        if (this.engine.timer && this.engine.currentQuestion) {
            const timerEl = DOM.create('div', {
                className: `timer-display ${this.engine.timer.getColorClass()}`,
                textContent: this.engine.timer.getFormattedTime(),
                id: 'game-timer'
            });
            right.appendChild(timerEl);
        }

        // Show team name only in multi-team modes
        if (this.engine.mode !== 'random') {
            const currentTeam = this.engine.getCurrentTeam();
            const teamDisplay = DOM.create('div', { className: 'current-team' });
            if (currentTeam.icon) {
                teamDisplay.appendChild(DOM.create('img', {
                    className: 'current-team-icon',
                    src: `/static/assets/teams/${currentTeam.icon}.png`
                }));
            }
            teamDisplay.appendChild(DOM.create('span', { textContent: currentTeam.name }));
            right.appendChild(teamDisplay);
        }

        // End game button
        right.appendChild(DOM.create('button', {
            className: 'btn btn-outline btn-sm',
            textContent: 'Terminer',
            onClick: async () => {
                const confirmed = await DOM.confirm('Terminer la partie maintenant ?');
                if (confirmed) {
                    this.engine.endGame();
                    App.navigate('#/game/end');
                }
            }
        }));

        header.appendChild(right);
        return header;
    },

    updateTimerDisplay() {
        const timerEl = document.getElementById('game-timer');
        if (timerEl && this.engine.timer) {
            timerEl.textContent = this.engine.timer.getFormattedTime();
            timerEl.className = `timer-display ${this.engine.timer.getColorClass()}`;
        }
    },

    buildScoreBar() {
        const bar = DOM.create('div', { className: 'score-bar' });

        if (this.engine.mode === 'random') {
            // Single team: show score + stats inline
            const team = this.engine.teams[0];
            bar.appendChild(DOM.create('div', { className: 'score-item active' }, [
                DOM.create('span', { className: 'score-name', textContent: 'Score' }),
                DOM.create('span', { className: 'score-value', textContent: team.score.toString() })
            ]));
            bar.appendChild(DOM.create('div', { className: 'score-item' }, [
                DOM.create('span', { className: 'score-name', textContent: `✅ ${team.correct}` }),
                DOM.create('span', { className: 'score-name', textContent: `❌ ${team.incorrect}` })
            ]));
        } else {
            for (let i = 0; i < this.engine.teams.length; i++) {
                const team = this.engine.teams[i];
                const isActive = i === this.engine.currentTeamIndex;
                const widget = DOM.create('div', {
                    className: `score-widget ${isActive ? 'active' : ''}`
                });

                // Col 1: Icon + Name
                const colMain = DOM.create('div', { className: 'sw-col sw-col-main' });
                if (team.icon) {
                    colMain.appendChild(DOM.create('img', {
                        className: 'score-widget-icon',
                        src: `/static/assets/teams/${team.icon}.png`
                    }));
                }
                colMain.appendChild(DOM.create('div', { className: 'score-widget-name', textContent: team.name }));
                widget.appendChild(colMain);

                // Col 2: Correct / Incorrect
                widget.appendChild(DOM.create('div', { className: 'sw-col sw-col-stats' }, [
                    DOM.create('span', { className: 'sw-stat sw-correct', textContent: `✅ ${team.correct}` }),
                    DOM.create('span', { className: 'sw-stat sw-incorrect', textContent: `❌ ${team.incorrect}` })
                ]));

                // Col 3: Black drawn / Black correct
                widget.appendChild(DOM.create('div', { className: 'sw-col sw-col-stats' }, [
                    DOM.create('span', { className: 'sw-stat sw-black', textContent: `💀 ${team.blackDrawn}` }),
                    DOM.create('span', { className: 'sw-stat sw-black-ok', textContent: `⭐ ${team.blackCorrect}` })
                ]));

                bar.appendChild(widget);
            }
        }

        return bar;
    }
};
