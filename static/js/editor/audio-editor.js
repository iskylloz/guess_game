/**
 * Audio Editor — Fullscreen game-style waveform editor with trim, fade, export.
 * Uses wavesurfer.js for visualization and Web Audio API for processing.
 * In-place DOM updates with persistent element references (no screen recreation).
 */
const AudioEditor = {
    wavesurfer: null,
    audioBuffer: null,
    audioContext: null,
    trimStart: 0,
    trimEnd: 0,
    duration: 0,
    onSave: null,
    _dragTarget: null,

    // Persistent DOM refs
    _middle: null,
    _sidebarEl: null,
    _toolbarEl: null,
    _waveformWrapper: null,
    _overlayLeft: null,
    _overlayRight: null,
    _handleLeft: null,
    _handleRight: null,
    _trimStartVal: null,
    _trimEndVal: null,
    _trimDuration: null,

    settings: {
        channels: 'stereo',
        sampleRate: 22050,
        normalize: true,
        fadeIn: 0,
        fadeOut: 0.5
    },

    open(audioSrc, onSave) {
        this.onSave = onSave;
        this.trimStart = 0;
        this.trimEnd = 0;
        this.duration = 0;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        fetch(audioSrc)
            .then(r => r.arrayBuffer())
            .then(buf => this.audioContext.decodeAudioData(buf))
            .then(decoded => {
                this.audioBuffer = decoded;
                this.duration = decoded.duration;
                this.trimEnd = decoded.duration;
                this._buildScreen(audioSrc);
            })
            .catch(err => DOM.toast(`Erreur audio : ${err.message}`, 'error'));
    },

    _buildScreen(audioSrc) {
        const modal = DOM.create('div', { className: 'modal preview-fullscreen' });
        const screen = DOM.create('div', { className: 'game-play' });

        // Header (static)
        const header = DOM.create('div', { className: 'game-header' });
        const left = DOM.create('div', { className: 'game-header-left' });
        left.appendChild(DOM.create('button', {
            className: 'btn btn-ghost btn-sm',
            textContent: '← Fermer',
            onClick: () => this.close()
        }));
        header.appendChild(left);

        const center = DOM.create('div', { className: 'game-header-center' });
        center.textContent = 'Éditeur Audio';
        header.appendChild(center);

        const right = DOM.create('div', { className: 'game-header-right' });
        right.appendChild(DOM.create('button', {
            className: 'btn btn-success btn-sm',
            textContent: '💾 Sauvegarder',
            onClick: () => this.save()
        }));
        header.appendChild(right);
        screen.appendChild(header);

        // Middle area: sidebar overlaid on main content
        this._middle = DOM.create('div', { className: 'ae-middle' });

        // Sidebar (persistent ref)
        this._sidebarEl = this.buildSidebar();
        this._middle.appendChild(this._sidebarEl);

        // Main content: waveform with trim overlays
        const content = DOM.create('div', { className: 'ae-content' });

        // Waveform wrapper
        this._waveformWrapper = DOM.create('div', { className: 'waveform-wrapper' });
        const waveformDiv = DOM.create('div', { className: 'audio-editor-waveform' });
        this._waveformWrapper.appendChild(waveformDiv);

        // Trim overlays & handles (persistent refs)
        this._overlayLeft = DOM.create('div', { className: 'trim-overlay trim-overlay-left' });
        this._overlayRight = DOM.create('div', { className: 'trim-overlay trim-overlay-right' });
        this._handleLeft = DOM.create('div', { className: 'trim-handle trim-handle-left' });
        this._handleLeft.appendChild(DOM.create('div', { className: 'trim-handle-line' }));
        this._handleRight = DOM.create('div', { className: 'trim-handle trim-handle-right' });
        this._handleRight.appendChild(DOM.create('div', { className: 'trim-handle-line' }));

        this._waveformWrapper.appendChild(this._overlayLeft);
        this._waveformWrapper.appendChild(this._overlayRight);
        this._waveformWrapper.appendChild(this._handleLeft);
        this._waveformWrapper.appendChild(this._handleRight);
        content.appendChild(this._waveformWrapper);

        this._middle.appendChild(content);
        screen.appendChild(this._middle);

        // Toolbar (persistent ref)
        this._toolbarEl = this.buildToolbar();
        screen.appendChild(this._toolbarEl);

        modal.appendChild(screen);
        DOM.showModal(modal);

        // Init wavesurfer + drag handlers after DOM ready
        setTimeout(() => {
            this.initWavesurfer(audioSrc, waveformDiv);
            this.initDragHandles();
        }, 100);
    },

    // ---- Sidebar ----

    buildSidebar() {
        const sidebar = DOM.create('div', { className: 'audio-editor-sidebar' });

        // Playback controls
        sidebar.appendChild(DOM.create('div', { className: 'ae-sidebar-title', textContent: '🔊 Lecture' }));

        sidebar.appendChild(DOM.create('button', {
            className: 'btn btn-outline btn-sm w-full',
            textContent: '▶️ Lecture complète',
            onClick: () => {
                if (this.wavesurfer) { this.wavesurfer.seekTo(0); this.wavesurfer.play(); }
            }
        }));
        sidebar.appendChild(DOM.create('button', {
            className: 'btn btn-primary btn-sm w-full',
            textContent: '🔊 Écouter sélection',
            onClick: () => this.playSelection()
        }));
        sidebar.appendChild(DOM.create('button', {
            className: 'btn btn-ghost btn-sm w-full',
            textContent: '⏹️ Stop',
            onClick: () => { if (this.wavesurfer) this.wavesurfer.pause(); }
        }));

        // Trim controls
        sidebar.appendChild(DOM.create('hr', { style: { margin: '12px 0', opacity: '0.2' } }));
        sidebar.appendChild(DOM.create('div', { className: 'ae-sidebar-title', textContent: '✂️ Découpage' }));

        // Start trim
        const startGroup = DOM.create('div', { className: 'ae-trim-group' });
        startGroup.appendChild(DOM.create('span', { className: 'trim-label', textContent: 'Début:' }));
        this._trimStartVal = DOM.create('span', {
            className: 'trim-value',
            textContent: DOM.formatTimeDecimal(this.trimStart)
        });
        startGroup.appendChild(this._trimStartVal);
        const startBtns = DOM.create('div', { className: 'trim-buttons' });
        for (const d of [-1, -0.1, 0.1, 1]) {
            startBtns.appendChild(DOM.create('button', {
                className: 'btn btn-sm btn-outline',
                textContent: `${d > 0 ? '+' : ''}${d}s`,
                onClick: () => this.adjustTrim('start', d)
            }));
        }
        startGroup.appendChild(startBtns);
        sidebar.appendChild(startGroup);

        // End trim
        const endGroup = DOM.create('div', { className: 'ae-trim-group' });
        endGroup.appendChild(DOM.create('span', { className: 'trim-label', textContent: 'Fin:' }));
        this._trimEndVal = DOM.create('span', {
            className: 'trim-value',
            textContent: DOM.formatTimeDecimal(this.trimEnd)
        });
        endGroup.appendChild(this._trimEndVal);
        const endBtns = DOM.create('div', { className: 'trim-buttons' });
        for (const d of [-1, -0.1, 0.1, 1]) {
            endBtns.appendChild(DOM.create('button', {
                className: 'btn btn-sm btn-outline',
                textContent: `${d > 0 ? '+' : ''}${d}s`,
                onClick: () => this.adjustTrim('end', d)
            }));
        }
        endGroup.appendChild(endBtns);
        sidebar.appendChild(endGroup);

        // Duration display
        const dur = Math.max(0, this.trimEnd - this.trimStart);
        this._trimDuration = DOM.create('div', {
            className: 'text-center text-muted text-sm',
            textContent: `Sélection: ${dur.toFixed(1)}s`
        });
        if (dur > 30) {
            this._trimDuration.style.color = 'var(--warning)';
            this._trimDuration.textContent += ' ⚠️';
        }
        sidebar.appendChild(this._trimDuration);

        // Fade controls
        sidebar.appendChild(DOM.create('hr', { style: { margin: '12px 0', opacity: '0.2' } }));
        sidebar.appendChild(DOM.create('div', { className: 'ae-sidebar-title', textContent: '🎵 Effets' }));

        const fadeInGroup = DOM.create('div', { className: 'form-group' });
        fadeInGroup.appendChild(DOM.create('label', { className: 'label', textContent: 'Fade In (s)' }));
        const fadeInInput = DOM.create('input', {
            className: 'input input-sm',
            type: 'number',
            min: '0', max: '5', step: '0.1',
            value: this.settings.fadeIn.toString()
        });
        fadeInInput.addEventListener('input', (e) => { this.settings.fadeIn = parseFloat(e.target.value) || 0; });
        fadeInGroup.appendChild(fadeInInput);
        sidebar.appendChild(fadeInGroup);

        const fadeOutGroup = DOM.create('div', { className: 'form-group' });
        fadeOutGroup.appendChild(DOM.create('label', { className: 'label', textContent: 'Fade Out (s)' }));
        const fadeOutInput = DOM.create('input', {
            className: 'input input-sm',
            type: 'number',
            min: '0', max: '5', step: '0.1',
            value: this.settings.fadeOut.toString()
        });
        fadeOutInput.addEventListener('input', (e) => { this.settings.fadeOut = parseFloat(e.target.value) || 0; });
        fadeOutGroup.appendChild(fadeOutInput);
        sidebar.appendChild(fadeOutGroup);

        // Audio info
        if (this.audioBuffer) {
            sidebar.appendChild(DOM.create('hr', { style: { margin: '12px 0', opacity: '0.2' } }));
            sidebar.appendChild(DOM.create('div', { className: 'ae-sidebar-title', textContent: 'ℹ️ Info' }));
            sidebar.appendChild(DOM.create('div', {
                className: 'text-muted text-sm',
                textContent: `Durée: ${this.audioBuffer.duration.toFixed(1)}s`
            }));
            const estSize = this.audioBuffer.length * this.audioBuffer.numberOfChannels * 2;
            sidebar.appendChild(DOM.create('div', {
                className: 'text-muted text-sm',
                textContent: `Taille: ${(estSize / 1024 / 1024).toFixed(1)} MB`
            }));
        }

        return sidebar;
    },

    // ---- Toolbar ----

    buildToolbar() {
        const toolbar = DOM.create('div', { className: 'image-editor-toolbar' });

        const playGroup = DOM.create('div', { className: 'tool-group' });
        playGroup.appendChild(DOM.create('button', {
            className: 'tool-btn',
            textContent: '▶️ Lecture',
            onClick: () => { if (this.wavesurfer) { this.wavesurfer.seekTo(0); this.wavesurfer.play(); } }
        }));
        playGroup.appendChild(DOM.create('button', {
            className: 'tool-btn',
            textContent: '🔊 Sélection',
            onClick: () => this.playSelection()
        }));
        playGroup.appendChild(DOM.create('button', {
            className: 'tool-btn',
            textContent: '⏹️ Stop',
            onClick: () => { if (this.wavesurfer) this.wavesurfer.pause(); }
        }));
        toolbar.appendChild(playGroup);

        const trimGroup = DOM.create('div', { className: 'tool-group' });
        trimGroup.appendChild(DOM.create('button', {
            className: 'tool-btn',
            textContent: '⏮️ Début ici',
            onClick: () => {
                if (this.wavesurfer) {
                    this.trimStart = Math.round(this.wavesurfer.getCurrentTime() * 10) / 10;
                    this.updateTrimDisplay();
                    this.updateTrimOverlay();
                }
            }
        }));
        trimGroup.appendChild(DOM.create('button', {
            className: 'tool-btn',
            textContent: '⏭️ Fin ici',
            onClick: () => {
                if (this.wavesurfer) {
                    this.trimEnd = Math.round(this.wavesurfer.getCurrentTime() * 10) / 10;
                    this.updateTrimDisplay();
                    this.updateTrimOverlay();
                }
            }
        }));
        trimGroup.appendChild(DOM.create('button', {
            className: 'tool-btn',
            textContent: '🔄 Réinitialiser',
            onClick: () => {
                this.trimStart = 0;
                this.trimEnd = this.duration;
                this.updateTrimDisplay();
                this.updateTrimOverlay();
            }
        }));
        toolbar.appendChild(trimGroup);

        return toolbar;
    },

    // ---- WaveSurfer ----

    async initWavesurfer(audioSrc, container) {
        if (!container) return;

        // Lazy-load WaveSurfer on first use
        if (typeof WaveSurfer === 'undefined') {
            try {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = '/static/lib/wavesurfer.min.js';
                    s.onload = resolve;
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
            } catch (_) {
                DOM.toast('Impossible de charger WaveSurfer.js.', 'error');
                return;
            }
        }

        this.wavesurfer = WaveSurfer.create({
            container: container,
            waveColor: '#4F4A85',
            progressColor: '#6366f1',
            cursorColor: '#e2e8f0',
            height: 180,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            url: audioSrc
        });

        this.wavesurfer.on('ready', () => {
            this.duration = this.wavesurfer.getDuration();
            this.trimEnd = this.duration;
            this.updateTrimDisplay();
            this.updateTrimOverlay();
        });
    },

    // ---- Draggable trim handles ----

    initDragHandles() {
        if (!this._handleLeft || !this._handleRight) return;

        const onMouseDown = (target) => (e) => {
            e.preventDefault();
            this._dragTarget = target;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!this._dragTarget || !this._waveformWrapper) return;

            const rect = this._waveformWrapper.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const ratio = x / rect.width;
            const time = Math.round(ratio * this.duration * 10) / 10;

            if (this._dragTarget === 'left') {
                this.trimStart = Math.max(0, Math.min(time, this.trimEnd - 0.1));
            } else {
                this.trimEnd = Math.min(this.duration, Math.max(time, this.trimStart + 0.1));
            }
            this.updateTrimDisplay();
            this.updateTrimOverlay();
        };

        const onMouseUp = () => {
            this._dragTarget = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        this._handleLeft.addEventListener('mousedown', onMouseDown('left'));
        this._handleRight.addEventListener('mousedown', onMouseDown('right'));
    },

    updateTrimOverlay() {
        if (!this._waveformWrapper || !this._overlayLeft) return;

        const dur = this.duration || 1;
        const leftPct = (this.trimStart / dur) * 100;
        const rightPct = (1 - this.trimEnd / dur) * 100;

        this._overlayLeft.style.width = leftPct + '%';
        this._overlayRight.style.width = rightPct + '%';
        this._handleLeft.style.left = leftPct + '%';
        this._handleRight.style.right = rightPct + '%';
    },

    // ---- Trim adjustments ----

    adjustTrim(which, delta) {
        const maxDuration = this.duration || 999;
        if (which === 'start') {
            this.trimStart = Math.max(0, Math.min(this.trimEnd - 0.1, this.trimStart + delta));
        } else {
            this.trimEnd = Math.min(maxDuration, Math.max(this.trimStart + 0.1, this.trimEnd + delta));
        }
        this.trimStart = Math.round(this.trimStart * 10) / 10;
        this.trimEnd = Math.round(this.trimEnd * 10) / 10;
        this.updateTrimDisplay();
        this.updateTrimOverlay();
    },

    updateTrimDisplay() {
        if (this._trimStartVal) this._trimStartVal.textContent = DOM.formatTimeDecimal(this.trimStart);
        if (this._trimEndVal) this._trimEndVal.textContent = DOM.formatTimeDecimal(this.trimEnd);
        if (this._trimDuration) {
            const dur = Math.max(0, this.trimEnd - this.trimStart);
            this._trimDuration.textContent = `Sélection: ${dur.toFixed(1)}s`;
            this._trimDuration.style.color = dur > 30 ? 'var(--warning)' : '';
            if (dur > 30) this._trimDuration.textContent += ' ⚠️';
        }
    },

    // ---- Playback ----

    playSelection() {
        if (this.wavesurfer) {
            const duration = this.wavesurfer.getDuration();
            if (duration > 0) {
                this.wavesurfer.seekTo(this.trimStart / duration);
                this.wavesurfer.play();
                const checkInterval = setInterval(() => {
                    if (this.wavesurfer && this.wavesurfer.getCurrentTime() >= this.trimEnd) {
                        this.wavesurfer.pause();
                        clearInterval(checkInterval);
                    }
                }, 50);
            }
        }
    },

    // ---- Audio processing ----

    async processAudio() {
        if (!this.audioBuffer) throw new Error('No audio loaded');

        const srcBuffer = this.audioBuffer;
        const srcRate = srcBuffer.sampleRate;
        const targetRate = this.settings.sampleRate;
        const targetChannels = this.settings.channels === 'mono' ? 1 : srcBuffer.numberOfChannels;

        // 1. Trim
        const startSample = Math.floor(this.trimStart * srcRate);
        const endSample = Math.floor(this.trimEnd * srcRate);
        const trimmedLength = endSample - startSample;
        if (trimmedLength <= 0) throw new Error('Invalid trim range');

        const trimmedBuffer = this.audioContext.createBuffer(srcBuffer.numberOfChannels, trimmedLength, srcRate);
        for (let ch = 0; ch < srcBuffer.numberOfChannels; ch++) {
            const srcData = srcBuffer.getChannelData(ch);
            const destData = trimmedBuffer.getChannelData(ch);
            for (let i = 0; i < trimmedLength; i++) {
                destData[i] = srcData[startSample + i];
            }
        }

        // 2. Resample
        const resampledLength = Math.round(trimmedLength * targetRate / srcRate);
        const offlineCtx = new OfflineAudioContext(targetChannels, resampledLength, targetRate);
        const source = offlineCtx.createBufferSource();

        if (targetChannels < srcBuffer.numberOfChannels) {
            const monoBuffer = this.audioContext.createBuffer(1, trimmedLength, srcRate);
            const monoData = monoBuffer.getChannelData(0);
            for (let i = 0; i < trimmedLength; i++) {
                let sum = 0;
                for (let ch = 0; ch < srcBuffer.numberOfChannels; ch++) {
                    sum += trimmedBuffer.getChannelData(ch)[i];
                }
                monoData[i] = sum / srcBuffer.numberOfChannels;
            }
            source.buffer = monoBuffer;
        } else {
            source.buffer = trimmedBuffer;
        }

        source.connect(offlineCtx.destination);
        source.start(0);
        let processedBuffer = await offlineCtx.startRendering();

        // 3. Normalize
        if (this.settings.normalize) {
            let peak = 0;
            for (let ch = 0; ch < processedBuffer.numberOfChannels; ch++) {
                const data = processedBuffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    peak = Math.max(peak, Math.abs(data[i]));
                }
            }
            if (peak > 0 && peak < 1) {
                const gain = 1.0 / peak;
                for (let ch = 0; ch < processedBuffer.numberOfChannels; ch++) {
                    const data = processedBuffer.getChannelData(ch);
                    for (let i = 0; i < data.length; i++) {
                        data[i] *= gain;
                    }
                }
            }
        }

        // 4. Fade in / out
        const fadeInSamples = Math.floor(this.settings.fadeIn * targetRate);
        const fadeOutSamples = Math.floor(this.settings.fadeOut * targetRate);
        for (let ch = 0; ch < processedBuffer.numberOfChannels; ch++) {
            const data = processedBuffer.getChannelData(ch);
            for (let i = 0; i < fadeInSamples && i < data.length; i++) {
                data[i] *= i / fadeInSamples;
            }
            for (let i = 0; i < fadeOutSamples && i < data.length; i++) {
                const idx = data.length - 1 - i;
                data[idx] *= i / fadeOutSamples;
            }
        }

        return processedBuffer;
    },

    async save() {
        try {
            DOM.toast('Traitement audio...', 'info');
            const processed = await this.processAudio();
            const wavData = Media.audioBufferToWav(processed);
            const blob = new Blob([wavData], { type: 'audio/wav' });
            const file = new File([blob], 'edited.wav', { type: 'audio/wav' });
            const result = await API.uploadFile('/api/upload/audio', file);

            this.close();
            if (this.onSave) this.onSave(result.path);
            DOM.toast('Audio sauvegardé !', 'success');
        } catch (err) {
            DOM.toast(`Erreur : ${err.message}`, 'error');
        }
    },

    close() {
        Media.stopAllAudio();
        if (this.wavesurfer) {
            this.wavesurfer.destroy();
            this.wavesurfer = null;
        }
        this._dragTarget = null;
        this._middle = null;
        this._sidebarEl = null;
        this._toolbarEl = null;
        this._waveformWrapper = null;
        this._overlayLeft = null;
        this._overlayRight = null;
        this._handleLeft = null;
        this._handleRight = null;
        this._trimStartVal = null;
        this._trimEndVal = null;
        this._trimDuration = null;
        DOM.hideModal();
    }
};
