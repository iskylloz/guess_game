/**
 * Preview — Full-screen modal that displays a question in game style.
 */
const Preview = {
    showingAnswer: false,

    show(questionData) {
        this.showingAnswer = false;
        this.questionData = questionData;
        this.renderModal();
    },

    renderModal() {
        const q = this.questionData;
        const cat = Media.getCategoryById(q.category);

        const modal = DOM.create('div', { className: 'modal preview-modal' });

        // Header
        const header = DOM.create('div', { className: 'preview-header' });
        header.appendChild(DOM.create('span', {
            className: `badge badge-${q.category}`,
            textContent: `${cat.emoji} ${cat.label}`
        }));
        header.appendChild(DOM.create('span', {
            className: 'text-muted',
            textContent: 'Prévisualisation'
        }));
        header.appendChild(DOM.create('button', {
            className: 'modal-close',
            textContent: '×',
            onClick: () => DOM.hideModal()
        }));
        modal.appendChild(header);

        // Body
        const body = DOM.create('div', { className: 'preview-body' });
        const data = this.showingAnswer ? q.answer : q.question;

        // Media
        if (data.image) {
            const mediaDiv = DOM.create('div', { className: 'question-media' });
            const imgEl = DOM.create('img', { src: `/media/${data.image}` });
            imgEl.addEventListener('load', () => {
                const rect = body.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                const size = Media.computeImageSize(imgEl, rect.width, rect.height);
                imgEl.style.width = size.width + 'px';
                imgEl.style.height = size.height + 'px';
            });
            mediaDiv.appendChild(imgEl);
            body.appendChild(mediaDiv);
        }
        if (data.audio) {
            body.appendChild(Media.createAudioPlayer(`/media/${data.audio}`));
        }
        if (data.youtube && navigator.onLine) {
            const videoId = Media.extractYouTubeId(data.youtube);
            if (videoId) {
                const ytDiv = DOM.create('div', { className: 'game-youtube' });
                ytDiv.appendChild(Media.createYouTubeEmbed(videoId));
                body.appendChild(ytDiv);
            }
        }

        // Text
        body.appendChild(DOM.create('div', {
            className: this.showingAnswer ? 'answer-text' : 'question-text',
            textContent: data.text || '(aucun texte)',
            style: { fontSize: this.showingAnswer ? '1.8rem' : '2rem' }
        }));

        modal.appendChild(body);

        // Actions
        const actions = DOM.create('div', { className: 'preview-actions' });

        if (!this.showingAnswer) {
            actions.appendChild(DOM.create('button', {
                className: 'btn btn-primary btn-lg',
                textContent: '👁️ Voir la réponse',
                onClick: () => {
                    this.showingAnswer = true;
                    DOM.hideModal();
                    this.renderModal();
                }
            }));
        } else {
            actions.appendChild(DOM.create('button', {
                className: 'btn btn-outline btn-lg',
                textContent: '❓ Voir la question',
                onClick: () => {
                    this.showingAnswer = false;
                    DOM.hideModal();
                    this.renderModal();
                }
            }));
        }

        // Validate/Refuse disabled (preview only)
        actions.appendChild(DOM.create('button', {
            className: 'btn btn-success btn-lg',
            textContent: '✅ Valider',
            disabled: 'disabled'
        }));
        actions.appendChild(DOM.create('button', {
            className: 'btn btn-danger btn-lg',
            textContent: '❌ Refuser',
            disabled: 'disabled'
        }));

        actions.appendChild(DOM.create('button', {
            className: 'btn btn-outline',
            textContent: 'Fermer',
            onClick: () => DOM.hideModal()
        }));

        modal.appendChild(actions);

        DOM.showModal(modal);
    }
};
