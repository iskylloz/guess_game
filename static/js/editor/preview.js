/**
 * Preview — Full-screen game-identical view for testing questions.
 * Validate/Refuse buttons trigger real animations and SFX.
 * Uses in-place DOM updates for smooth transitions (no screen recreation).
 */
const Preview = {
    showingAnswer: false,
    _backdrop: null,
    _qContainer: null,
    _actions: null,

    show(questionData) {
        this.showingAnswer = false;
        this.questionData = questionData;
        this._isBlack = questionData.category === 'black';
        this._backdrop = null;
        this._qContainer = null;
        this._actions = null;
        this._buildScreen();
    },

    /** Build the full screen structure once, then update content */
    _buildScreen() {
        const q = this.questionData;
        const cat = Media.getCategoryById(q.category);

        const screen = DOM.create('div', { className: 'game-play' });

        // Header (static — never changes)
        const header = DOM.create('div', { className: 'game-header' });
        const left = DOM.create('div', { className: 'game-header-left' });
        left.appendChild(DOM.create('button', {
            className: 'btn btn-ghost btn-sm',
            textContent: '← Fermer',
            onClick: () => { Media.destroyPlayersIn(this._qContainer); DOM.hideModal(); }
        }));
        header.appendChild(left);

        const center = DOM.create('div', { className: 'game-header-center' });
        center.textContent = 'Prévisualisation';
        header.appendChild(center);

        const right = DOM.create('div', { className: 'game-header-right' });
        right.appendChild(DOM.create('span', {
            className: `badge badge-${q.category}`,
            textContent: `${cat.emoji} ${cat.label}`
        }));
        header.appendChild(right);
        screen.appendChild(header);

        // Question container (content updated in-place)
        this._qContainer = DOM.create('div', { className: 'question-container' });
        if (this._isBlack) {
            this._qContainer.classList.add('question-black');
        }
        screen.appendChild(this._qContainer);

        // Actions bar (buttons updated in-place)
        this._actions = DOM.create('div', { className: 'game-actions' });
        screen.appendChild(this._actions);

        // Bottom bar (static)
        const bar = DOM.create('div', { className: 'score-bar' });
        bar.appendChild(DOM.create('div', { className: 'score-item active' }, [
            DOM.create('span', { className: 'score-name', textContent: 'Mode' }),
            DOM.create('span', { className: 'score-value', textContent: 'Test' })
        ]));
        screen.appendChild(bar);

        // Create modal
        const modal = DOM.create('div', { className: 'modal preview-fullscreen' });
        modal.appendChild(screen);
        this._backdrop = DOM.showModal(modal);

        // Fill content
        this._updateContent();

        // Play black type SFX on open
        if (this._isBlack && q.black_type) {
            GameAnimations.sfxBlackType(q.black_type);
        }
    },

    /** Update only the question container and actions — no screen rebuild */
    _updateContent() {
        const q = this.questionData;
        const cat = Media.getCategoryById(q.category);
        const data = this.showingAnswer ? q.answer : q.question;

        // Update question container
        Media.destroyPlayersIn(this._qContainer);
        DOM.clear(this._qContainer);

        // Category badge
        const blackTypeLabels = { bonus: '🎁 Bonus', malus: '💀 Malus', hard: '🔥 Difficile' };
        const blackTypeLabel = q.black_type ? ` — ${blackTypeLabels[q.black_type] || ''}` : '';
        this._qContainer.appendChild(DOM.create('span', {
            className: `badge badge-${q.category}`,
            textContent: `${cat.emoji} ${cat.label}${this._isBlack ? ' ×2' : ''}${blackTypeLabel}`
        }));

        // Media
        if (data.image) {
            this._qContainer.appendChild(Media.createAutoSizedImage(`/media/${data.image}`, this._qContainer));
        }
        if (data.audio) {
            this._qContainer.appendChild(Media.createAudioPlayer(`/media/${data.audio}`));
        }
        if (data.youtube && navigator.onLine) {
            const videoId = Media.extractYouTubeId(data.youtube);
            if (videoId) {
                const ytDiv = DOM.create('div', { className: 'game-youtube' });
                ytDiv.appendChild(Media.createYouTubeEmbed(videoId));
                this._qContainer.appendChild(ytDiv);
            }
        }

        // Text
        this._qContainer.appendChild(DOM.create('div', {
            className: this.showingAnswer ? 'answer-text' : 'question-text',
            textContent: data.text || '(aucun texte)'
        }));

        // Update actions
        DOM.clear(this._actions);

        if (!this.showingAnswer) {
            this._actions.appendChild(DOM.create('button', {
                className: 'btn btn-primary btn-lg',
                textContent: '👁️ Voir la réponse',
                onClick: () => { this.showingAnswer = true; this._updateContent(); }
            }));
        } else {
            this._actions.appendChild(DOM.create('button', {
                className: 'btn btn-outline btn-lg',
                textContent: '❓ Voir la question',
                onClick: () => { this.showingAnswer = false; this._updateContent(); }
            }));
            this._actions.appendChild(DOM.create('button', {
                className: 'btn btn-success btn-lg',
                textContent: '✅ Valider',
                onClick: () => this._onValidate()
            }));
            this._actions.appendChild(DOM.create('button', {
                className: 'btn btn-danger btn-lg',
                textContent: '❌ Refuser',
                onClick: () => this._onRefuse()
            }));
        }
    },

    _onValidate() {
        GameAnimations.flash(this._qContainer, this._isBlack ? 'correct-black' : 'correct');
        GameAnimations.confetti(this._qContainer, this._isBlack
            ? { count: 80, colors: ['#fbbf24', '#f59e0b', '#eab308', '#ffffff', '#fef3c7'], duration: 1500 }
            : { count: 40, colors: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#ffffff'], duration: 1200 }
        );
        setTimeout(() => { this.showingAnswer = false; this._updateContent(); }, 1000);
    },

    _onRefuse() {
        GameAnimations.flash(this._qContainer, this._isBlack ? 'wrong-black' : 'wrong');
        GameAnimations.shake(this._qContainer, this._isBlack ? 'intense' : 'normal');
        setTimeout(() => { this.showingAnswer = false; this._updateContent(); }, 1000);
    }
};
