/**
 * Editor — Create Tab: Category selector, question/answer form with media uploads.
 */
const EditorCreate = {
    state: {
        category: '',
        question: { text: '', image: null, audio: null, youtube: '' },
        answer: { text: '', image: null, audio: null, youtube: '' },
        editingId: null  // null = creating, string = editing existing
    },

    render(container) {
        const form = DOM.create('div', { className: 'create-form' });

        // Category selector
        form.appendChild(this.buildCategorySelector());

        // Two-column layout: Question | Answer
        const columns = DOM.create('div', { className: 'create-columns' });
        columns.appendChild(this.buildMediaSection('question', '❓ Question'));
        columns.appendChild(this.buildMediaSection('answer', '✅ Réponse'));
        form.appendChild(columns);

        // Actions
        const actions = DOM.create('div', { className: 'form-actions' });
        actions.appendChild(DOM.create('button', {
            className: 'btn btn-success btn-lg',
            textContent: this.state.editingId ? '💾 Enregistrer' : '➕ Ajouter',
            onClick: () => this.submit()
        }));
        actions.appendChild(DOM.create('button', {
            className: 'btn btn-primary btn-lg',
            textContent: '👁️ Prévisualiser',
            onClick: () => this.preview()
        }));
        actions.appendChild(DOM.create('button', {
            className: 'btn btn-outline btn-lg',
            textContent: '🔄 Effacer',
            onClick: () => this.clear()
        }));
        form.appendChild(actions);

        container.appendChild(form);
    },

    buildCategorySelector() {
        const section = DOM.create('div', { className: 'category-selector' });
        section.appendChild(DOM.create('h2', { textContent: 'Catégorie' }));

        const grid = DOM.create('div', { className: 'category-grid-editor' });

        for (const cat of Media.CATEGORIES) {
            const isSelected = this.state.category === cat.id;
            const isDark = ['blue', 'green', 'red', 'pink', 'black'].includes(cat.id);
            const checkColor = (cat.id === 'white' || cat.id === 'yellow') ? '#1F2937' : cat.color;

            const btn = DOM.create('div', {
                className: `cat-btn ${isSelected ? 'selected' : ''} ${cat.id === 'black' ? 'cat-btn-black' : ''}`,
                style: {
                    borderColor: isSelected ? cat.color : 'transparent',
                    boxShadow: isSelected ? `0 0 20px ${cat.color}40, 0 0 0 3px white, 0 0 0 6px ${cat.color}` : 'none'
                },
                onClick: () => {
                    this.state.category = cat.id;
                    this.refresh();
                }
            }, [
                DOM.create('div', {
                    className: 'cat-btn-circle',
                    style: { backgroundColor: cat.color },
                    textContent: cat.emoji
                }),
                DOM.create('span', { className: 'cat-btn-label', textContent: cat.label }),
                DOM.create('div', {
                    className: 'cat-btn-check',
                    style: { backgroundColor: isDark ? cat.color : checkColor, color: isDark ? 'white' : 'white' },
                    textContent: '✓'
                })
            ]);
            grid.appendChild(btn);
        }

        section.appendChild(grid);
        return section;
    },

    buildMediaSection(type, title) {
        const data = this.state[type];
        const section = DOM.create('div', { className: 'form-section' });
        section.appendChild(DOM.create('h2', { textContent: title }));

        // Text
        const textGroup = DOM.create('div', { className: 'form-group' });
        textGroup.appendChild(DOM.create('label', { className: 'label', textContent: 'Texte *' }));
        const textarea = DOM.create('textarea', {
            className: 'textarea',
            placeholder: type === 'question' ? 'Entrez votre question...' : 'Entrez la réponse...',
            value: data.text
        });
        textarea.value = data.text;
        textarea.addEventListener('input', (e) => { data.text = e.target.value; });
        textGroup.appendChild(textarea);
        section.appendChild(textGroup);

        // Image
        const imgGroup = DOM.create('div', { className: 'form-group' });
        imgGroup.appendChild(DOM.create('label', { className: 'label', textContent: '📸 Image (optionnel)' }));

        if (data.image) {
            imgGroup.appendChild(Media.createImagePreview(
                `/media/${data.image}`,
                () => ImageEditor.open(`/media/${data.image}`, (newPath) => { data.image = newPath; this.refresh(); }),
                () => { data.image = null; this.refresh(); }
            ));
        } else {
            imgGroup.appendChild(this.buildUploadZone(type, 'image'));
        }
        section.appendChild(imgGroup);

        // Audio
        const audioGroup = DOM.create('div', { className: 'form-group' });
        audioGroup.appendChild(DOM.create('label', { className: 'label', textContent: '🎵 Audio (optionnel)' }));

        if (data.audio) {
            audioGroup.appendChild(Media.createAudioPreview(
                `/media/${data.audio}`,
                () => AudioEditor.open(`/media/${data.audio}`, (newPath) => { data.audio = newPath; this.refresh(); }),
                () => { data.audio = null; this.refresh(); }
            ));
        } else {
            const audioControls = DOM.create('div');
            audioControls.appendChild(this.buildUploadZone(type, 'audio'));
            audioControls.appendChild(this.buildRecordButton(type));
            audioGroup.appendChild(audioControls);
        }
        section.appendChild(audioGroup);

        // YouTube
        const ytGroup = DOM.create('div', { className: 'form-group' });
        ytGroup.appendChild(DOM.create('label', { className: 'label', textContent: '📺 YouTube (optionnel)' }));

        const ytInput = DOM.create('input', {
            className: `input ${data.youtube ? (Media.isYouTubeUrl(data.youtube) ? 'youtube-valid' : 'youtube-invalid') : ''}`,
            type: 'text',
            placeholder: 'https://www.youtube.com/watch?v=...',
            value: data.youtube || ''
        });
        ytInput.addEventListener('input', (e) => {
            data.youtube = e.target.value || null;
            const isValid = !data.youtube || Media.isYouTubeUrl(data.youtube);
            ytInput.className = `input ${data.youtube ? (isValid ? 'youtube-valid' : 'youtube-invalid') : ''}`;
            // Update preview
            const previewContainer = ytInput.parentElement.querySelector('.youtube-preview');
            if (previewContainer) {
                DOM.clear(previewContainer);
                if (data.youtube && isValid) {
                    const videoId = Media.extractYouTubeId(data.youtube);
                    previewContainer.appendChild(Media.createYouTubeEmbed(videoId));
                }
            }
        });
        ytGroup.appendChild(ytInput);

        // YouTube preview
        if (data.youtube && Media.isYouTubeUrl(data.youtube)) {
            const ytPreview = DOM.create('div', { className: 'youtube-preview' });
            const videoId = Media.extractYouTubeId(data.youtube);
            ytPreview.appendChild(Media.createYouTubeEmbed(videoId));
            ytGroup.appendChild(ytPreview);
        } else {
            ytGroup.appendChild(DOM.create('div', { className: 'youtube-preview' }));
        }
        section.appendChild(ytGroup);

        return section;
    },

    buildUploadZone(type, mediaType) {
        const accept = mediaType === 'image' ? 'image/*' : 'audio/*';
        const icon = mediaType === 'image' ? '📸' : '🎵';
        const text = mediaType === 'image' ? 'Cliquez ou glissez une image' : 'Cliquez ou glissez un fichier audio';

        const fileInput = DOM.create('input', { type: 'file', accept: accept, style: { display: 'none' } });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) this.uploadFile(type, mediaType, e.target.files[0]);
        });

        const zone = DOM.create('div', { className: 'upload-zone', onClick: () => fileInput.click() }, [
            DOM.create('span', { className: 'upload-zone-icon', textContent: icon }),
            DOM.create('span', { className: 'upload-zone-text', textContent: text }),
            DOM.create('span', { className: 'upload-zone-hint', textContent: 'ou glissez-déposez ici' }),
            fileInput
        ]);

        // Drag & drop
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) this.uploadFile(type, mediaType, e.dataTransfer.files[0]);
        });

        // Add URL import button for images
        if (mediaType === 'image') {
            const urlBtn = DOM.create('button', {
                className: 'btn btn-ghost btn-sm mt-sm',
                textContent: '🔗 Importer depuis URL',
                onClick: async (e) => {
                    e.stopPropagation();
                    const url = await DOM.prompt('URL de l\'image :', '', 'Importer une image');
                    if (url) this.importImageUrl(type, url);
                }
            });
            zone.appendChild(urlBtn);
        }

        return zone;
    },

    buildRecordButton(type) {
        const controls = DOM.create('div', { className: 'record-controls', style: { marginTop: '8px' } });
        let isRecording = false;
        let mediaRecorder = null;
        let chunks = [];

        const startBtn = DOM.create('button', {
            className: 'record-btn record-btn-start',
            textContent: '🎤',
            onClick: async () => {
                if (isRecording) return;
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    chunks = [];
                    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
                    mediaRecorder.onstop = async () => {
                        stream.getTracks().forEach(t => t.stop());
                        const blob = new Blob(chunks, { type: 'audio/webm' });
                        // Upload as webm
                        const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
                        await this.uploadFile(type, 'audio', file);
                        isRecording = false;
                        indicator.style.display = 'none';
                        startBtn.style.display = '';
                        stopBtn.style.display = 'none';
                    };
                    mediaRecorder.start();
                    isRecording = true;
                    indicator.style.display = 'flex';
                    startBtn.style.display = 'none';
                    stopBtn.style.display = '';
                } catch (err) {
                    DOM.toast('Accès au microphone refusé.', 'error');
                }
            }
        });

        const stopBtn = DOM.create('button', {
            className: 'record-btn record-btn-stop',
            textContent: '⏹️',
            style: { display: 'none' },
            onClick: () => {
                if (mediaRecorder && isRecording) {
                    mediaRecorder.stop();
                }
            }
        });

        const indicator = DOM.create('div', {
            className: 'recording-indicator',
            style: { display: 'none' }
        }, [
            DOM.create('span', { className: 'recording-dot' }),
            DOM.create('span', { textContent: 'Enregistrement...' })
        ]);

        controls.appendChild(startBtn);
        controls.appendChild(stopBtn);
        controls.appendChild(indicator);

        return controls;
    },

    async uploadFile(type, mediaType, file) {
        try {
            const endpoint = mediaType === 'image' ? '/api/upload/image' : '/api/upload/audio';
            const result = await API.uploadFile(endpoint, file);
            this.state[type][mediaType] = result.path;
            DOM.toast(`${mediaType === 'image' ? 'Image' : 'Audio'} ajouté(e) !`, 'success');
            this.refresh();
        } catch (err) {
            DOM.toast(`Erreur d'upload : ${err.message}`, 'error');
        }
    },

    async importImageUrl(type, url) {
        try {
            const result = await API.post('/api/fetch-image-url', { url });
            this.state[type].image = result.path;
            DOM.toast('Image importée !', 'success');
            this.refresh();
        } catch (err) {
            DOM.toast(`Erreur d'import : ${err.message}`, 'error');
        }
    },

    async submit() {
        Media.stopAllAudio();
        const s = this.state;

        // Validation
        if (!s.category) {
            DOM.toast('Sélectionnez une catégorie.', 'warning');
            return;
        }
        if (!s.question.text.trim()) {
            DOM.toast('Le texte de la question est requis.', 'warning');
            return;
        }
        if (!s.answer.text.trim()) {
            DOM.toast('Le texte de la réponse est requis.', 'warning');
            return;
        }

        const data = {
            category: s.category,
            question: {
                text: s.question.text,
                image: s.question.image,
                audio: s.question.audio,
                youtube: s.question.youtube || null
            },
            answer: {
                text: s.answer.text,
                image: s.answer.image,
                audio: s.answer.audio,
                youtube: s.answer.youtube || null
            }
        };

        try {
            if (s.editingId) {
                await API.put(`/api/questions/${s.editingId}`, data);
                DOM.toast('Question mise à jour !', 'success');
            } else {
                // Check duplicates first
                const dupResult = await API.post('/api/questions/check-duplicate', {
                    answer_text: s.answer.text
                });
                if (dupResult.similar && dupResult.similar.length > 0) {
                    const proceed = await this.showDuplicateModal(dupResult.similar);
                    if (!proceed) return;
                }

                await API.post('/api/questions', data);
                DOM.toast('Question ajoutée !', 'success');
            }
            this.clear();
            // Refresh manage tab stats if visible
            if (typeof EditorManage !== 'undefined') EditorManage.needsRefresh = true;
        } catch (err) {
            DOM.toast(`Erreur : ${err.message}`, 'error');
        }
    },

    showDuplicateModal(similar) {
        return new Promise((resolve) => {
            const list = DOM.create('div', { className: 'duplicate-list' });
            for (const dup of similar) {
                list.appendChild(DOM.create('div', { className: 'duplicate-item' }, [
                    DOM.create('span', { className: 'duplicate-similarity', textContent: dup.similarity + '%' }),
                    DOM.create('div', { className: 'duplicate-text' }, [
                        DOM.create('div', { textContent: `Q: ${dup.question.question.text}` }),
                        DOM.create('div', {
                            textContent: `R: ${dup.question.answer.text}`,
                            style: { color: 'var(--success)', fontSize: '0.85rem' }
                        })
                    ])
                ]));
            }

            const modal = DOM.create('div', { className: 'modal duplicate-modal' }, [
                DOM.create('div', { className: 'modal-header' }, [
                    DOM.create('h3', { textContent: '⚠️ Questions similaires détectées' }),
                    DOM.create('button', {
                        className: 'modal-close',
                        textContent: '×',
                        onClick: () => { DOM.hideModal(); resolve(false); }
                    })
                ]),
                DOM.create('div', { className: 'modal-body' }, [
                    DOM.create('p', { textContent: 'Votre question ressemble à une ou plusieurs questions existantes :' }),
                    list
                ]),
                DOM.create('div', { className: 'modal-footer' }, [
                    DOM.create('button', {
                        className: 'btn btn-outline',
                        textContent: '✗ Annuler',
                        onClick: () => { DOM.hideModal(); resolve(false); }
                    }),
                    DOM.create('button', {
                        className: 'btn btn-success',
                        textContent: '✓ Créer quand même',
                        onClick: () => { DOM.hideModal(); resolve(true); }
                    })
                ])
            ]);
            DOM.showModal(modal);
        });
    },

    preview() {
        const s = this.state;
        if (!s.question.text.trim()) {
            DOM.toast('Ajoutez du texte à la question pour prévisualiser.', 'warning');
            return;
        }

        Preview.show({
            category: s.category || 'blue',
            question: { ...s.question },
            answer: { ...s.answer }
        });
    },

    clear() {
        this.state = {
            category: '',
            question: { text: '', image: null, audio: null, youtube: '' },
            answer: { text: '', image: null, audio: null, youtube: '' },
            editingId: null
        };
        this.refresh();
    },

    loadForEdit(question) {
        this.state = {
            category: question.category,
            question: {
                text: question.question.text,
                image: question.question.image,
                audio: question.question.audio,
                youtube: question.question.youtube || ''
            },
            answer: {
                text: question.answer.text,
                image: question.answer.image,
                audio: question.answer.audio,
                youtube: question.answer.youtube || ''
            },
            editingId: question.id
        };
    },

    refresh() {
        // Re-render the editor page
        if (App.currentPageName === 'editor') {
            const container = document.getElementById('app');
            App.pages.editor.render(container);
        }
    }
};

/**
 * Editor Page — Container with tabs (Create / Manage).
 */
App.pages.editor = {
    activeTab: 'create',

    render(container) {
        DOM.clear(container);
        const screen = DOM.create('div', { className: 'editor-screen' });

        // Header
        const header = DOM.create('div', { className: 'editor-header' });

        const left = DOM.create('div', { className: 'editor-header-left' });
        left.appendChild(DOM.create('button', {
            className: 'btn btn-ghost editor-back-btn',
            textContent: '← Accueil',
            onClick: () => App.navigate('#/home')
        }));
        left.appendChild(DOM.create('span', { className: 'editor-title', textContent: '✏️ Éditeur de questions' }));
        header.appendChild(left);

        // Tabs
        const tabs = DOM.create('div', { className: 'editor-tabs' });
        tabs.appendChild(DOM.create('button', {
            className: `editor-tab ${this.activeTab === 'create' ? 'active' : ''}`,
            textContent: '➕ Créer',
            onClick: () => { this.activeTab = 'create'; this.render(container); }
        }));
        tabs.appendChild(DOM.create('button', {
            className: `editor-tab ${this.activeTab === 'manage' ? 'active' : ''}`,
            textContent: '📋 Gérer',
            onClick: () => { this.activeTab = 'manage'; this.render(container); }
        }));
        header.appendChild(tabs);

        header.appendChild(DOM.create('div', { className: 'editor-header-actions' }));
        screen.appendChild(header);

        // Body
        const body = DOM.create('div', { className: 'editor-body' });
        if (this.activeTab === 'create') {
            EditorCreate.render(body);
        } else {
            EditorManage.render(body);
        }
        screen.appendChild(body);

        container.appendChild(screen);
    },

    destroy() {
        Media.stopAllAudio();
    }
};
