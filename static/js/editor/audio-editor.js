/**
 * Audio Editor — Waveform display, trim with draggable handles, fade, export.
 * Uses wavesurfer.js for visualization and Web Audio API for processing.
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
                this.showModal(audioSrc);
            })
            .catch(err => DOM.toast(`Erreur audio : ${err.message}`, 'error'));
    },

    showModal(audioSrc) {
        const modal = DOM.create('div', { className: 'modal audio-editor-modal' });

        // Header
        const header = DOM.create('div', { className: 'modal-header' });
        header.appendChild(DOM.create('h3', { textContent: '✂️ Éditeur Audio' }));
        header.appendChild(DOM.create('button', {
            className: 'modal-close',
            textContent: '×',
            onClick: () => this.close()
        }));
        modal.appendChild(header);

        // Body
        const body = DOM.create('div', { className: 'modal-body' });

        // Waveform with trim overlay
        const waveformWrapper = DOM.create('div', { className: 'waveform-wrapper', id: 'waveform-wrapper' });
        const waveformDiv = DOM.create('div', { className: 'audio-editor-waveform', id: 'audio-editor-waveform' });
        waveformWrapper.appendChild(waveformDiv);

        // Trim overlay elements
        const overlayLeft = DOM.create('div', { className: 'trim-overlay trim-overlay-left', id: 'trim-overlay-left' });
        const overlayRight = DOM.create('div', { className: 'trim-overlay trim-overlay-right', id: 'trim-overlay-right' });
        const handleLeft = DOM.create('div', { className: 'trim-handle trim-handle-left', id: 'trim-handle-left' });
        handleLeft.appendChild(DOM.create('div', { className: 'trim-handle-line' }));
        const handleRight = DOM.create('div', { className: 'trim-handle trim-handle-right', id: 'trim-handle-right' });
        handleRight.appendChild(DOM.create('div', { className: 'trim-handle-line' }));

        waveformWrapper.appendChild(overlayLeft);
        waveformWrapper.appendChild(overlayRight);
        waveformWrapper.appendChild(handleLeft);
        waveformWrapper.appendChild(handleRight);
        body.appendChild(waveformWrapper);

        // Audio info
        const info = DOM.create('div', { className: 'audio-info' });
        info.appendChild(DOM.create('span', { textContent: `Durée: ${this.audioBuffer.duration.toFixed(1)}s` }));
        const estSize = this.audioBuffer.length * this.audioBuffer.numberOfChannels * 2;
        info.appendChild(DOM.create('span', { textContent: `Taille: ${(estSize / 1024 / 1024).toFixed(1)} MB` }));
        body.appendChild(info);

        // Trim controls (buttons + display)
        body.appendChild(this.buildTrimControls());

        // Playback controls
        body.appendChild(this.buildPlaybackControls());

        // Optimization (fade only)
        body.appendChild(this.buildOptimizationPanel());

        modal.appendChild(body);

        // Footer
        const footer = DOM.create('div', { className: 'modal-footer' });
        footer.appendChild(DOM.create('button', {
            className: 'btn btn-outline',
            textContent: '❌ Annuler',
            onClick: () => this.close()
        }));
        footer.appendChild(DOM.create('button', {
            className: 'btn btn-success',
            textContent: '💾 Sauvegarder',
            onClick: () => this.save()
        }));
        modal.appendChild(footer);

        DOM.showModal(modal);

        // Init wavesurfer + drag handlers after DOM ready
        setTimeout(() => {
            this.initWavesurfer(audioSrc);
            this.initDragHandles();
        }, 100);
    },

    async initWavesurfer(audioSrc) {
        const container = document.getElementById('audio-editor-waveform');
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
            height: 128,
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
        const handleLeft = document.getElementById('trim-handle-left');
        const handleRight = document.getElementById('trim-handle-right');
        if (!handleLeft || !handleRight) return;

        const onMouseDown = (target) => (e) => {
            e.preventDefault();
            this._dragTarget = target;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!this._dragTarget) return;
            const wrapper = document.getElementById('waveform-wrapper');
            if (!wrapper) return;

            const rect = wrapper.getBoundingClientRect();
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

        handleLeft.addEventListener('mousedown', onMouseDown('left'));
        handleRight.addEventListener('mousedown', onMouseDown('right'));
    },

    updateTrimOverlay() {
        const wrapper = document.getElementById('waveform-wrapper');
        const overlayLeft = document.getElementById('trim-overlay-left');
        const overlayRight = document.getElementById('trim-overlay-right');
        const handleLeft = document.getElementById('trim-handle-left');
        const handleRight = document.getElementById('trim-handle-right');
        if (!wrapper || !overlayLeft || !overlayRight || !handleLeft || !handleRight) return;

        const dur = this.duration || 1;
        const leftPct = (this.trimStart / dur) * 100;
        const rightPct = (1 - this.trimEnd / dur) * 100;

        overlayLeft.style.width = leftPct + '%';
        overlayRight.style.width = rightPct + '%';
        handleLeft.style.left = leftPct + '%';
        handleRight.style.right = rightPct + '%';
    },

    // ---- Trim controls (buttons + values) ----

    buildTrimControls() {
        const controls = DOM.create('div', { className: 'audio-editor-controls' });
        const trimRow = DOM.create('div', { className: 'trim-controls' });

        // Start
        const startGroup = DOM.create('div', { className: 'trim-group' });
        startGroup.appendChild(DOM.create('span', { className: 'trim-label', textContent: 'Début:' }));
        startGroup.appendChild(DOM.create('span', {
            className: 'trim-value', id: 'trim-start-val',
            textContent: DOM.formatTimeDecimal(this.trimStart)
        }));
        const startBtns = DOM.create('div', { className: 'trim-buttons' });
        for (const d of [-1, -0.1, 0.1, 1]) {
            startBtns.appendChild(DOM.create('button', {
                className: 'btn btn-sm btn-outline',
                textContent: `${d > 0 ? '+' : ''}${d}s`,
                onClick: () => this.adjustTrim('start', d)
            }));
        }
        startGroup.appendChild(startBtns);
        trimRow.appendChild(startGroup);

        // End
        const endGroup = DOM.create('div', { className: 'trim-group' });
        endGroup.appendChild(DOM.create('span', { className: 'trim-label', textContent: 'Fin:' }));
        endGroup.appendChild(DOM.create('span', {
            className: 'trim-value', id: 'trim-end-val',
            textContent: DOM.formatTimeDecimal(this.trimEnd)
        }));
        const endBtns = DOM.create('div', { className: 'trim-buttons' });
        for (const d of [-1, -0.1, 0.1, 1]) {
            endBtns.appendChild(DOM.create('button', {
                className: 'btn btn-sm btn-outline',
                textContent: `${d > 0 ? '+' : ''}${d}s`,
                onClick: () => this.adjustTrim('end', d)
            }));
        }
        endGroup.appendChild(endBtns);
        trimRow.appendChild(endGroup);

        controls.appendChild(trimRow);

        // Duration display
        const duration = Math.max(0, this.trimEnd - this.trimStart);
        const durDisplay = DOM.create('div', {
            className: 'text-center text-muted text-sm',
            id: 'trim-duration',
            textContent: `Durée sélectionnée: ${duration.toFixed(1)}s`
        });
        if (duration > 30) {
            durDisplay.style.color = 'var(--warning)';
            durDisplay.textContent += ' ⚠️ (> 30s)';
        }
        controls.appendChild(durDisplay);

        return controls;
    },

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
        const startEl = document.getElementById('trim-start-val');
        const endEl = document.getElementById('trim-end-val');
        const durEl = document.getElementById('trim-duration');
        if (startEl) startEl.textContent = DOM.formatTimeDecimal(this.trimStart);
        if (endEl) endEl.textContent = DOM.formatTimeDecimal(this.trimEnd);
        if (durEl) {
            const dur = Math.max(0, this.trimEnd - this.trimStart);
            durEl.textContent = `Durée sélectionnée: ${dur.toFixed(1)}s`;
            durEl.style.color = dur > 30 ? 'var(--warning)' : '';
            if (dur > 30) durEl.textContent += ' ⚠️ (> 30s)';
        }
    },

    // ---- Playback ----

    buildPlaybackControls() {
        const controls = DOM.create('div', { className: 'audio-playback-controls' });

        controls.appendChild(DOM.create('button', {
            className: 'btn btn-outline',
            textContent: '▶️ Lecture complète',
            onClick: () => {
                if (this.wavesurfer) {
                    this.wavesurfer.seekTo(0);
                    this.wavesurfer.play();
                }
            }
        }));

        controls.appendChild(DOM.create('button', {
            className: 'btn btn-primary',
            textContent: '🔊 Écouter sélection',
            onClick: () => this.playSelection()
        }));

        controls.appendChild(DOM.create('button', {
            className: 'btn btn-ghost',
            textContent: '⏹️ Stop',
            onClick: () => {
                if (this.wavesurfer) this.wavesurfer.pause();
            }
        }));

        return controls;
    },

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

    // ---- Optimization (fade only) ----

    buildOptimizationPanel() {
        const panel = DOM.create('div', { className: 'optimization-panel' });

        // Fade In
        const fadeInGroup = DOM.create('div', { className: 'form-group' });
        fadeInGroup.appendChild(DOM.create('label', { className: 'label', textContent: 'Fade In (secondes)' }));
        const fadeInInput = DOM.create('input', {
            className: 'input',
            type: 'number',
            min: '0', max: '5', step: '0.1',
            value: this.settings.fadeIn.toString(),
            style: { width: '100px' }
        });
        fadeInInput.addEventListener('input', (e) => { this.settings.fadeIn = parseFloat(e.target.value) || 0; });
        fadeInGroup.appendChild(fadeInInput);
        panel.appendChild(fadeInGroup);

        // Fade Out
        const fadeOutGroup = DOM.create('div', { className: 'form-group' });
        fadeOutGroup.appendChild(DOM.create('label', { className: 'label', textContent: 'Fade Out (secondes)' }));
        const fadeOutInput = DOM.create('input', {
            className: 'input',
            type: 'number',
            min: '0', max: '5', step: '0.1',
            value: this.settings.fadeOut.toString(),
            style: { width: '100px' }
        });
        fadeOutInput.addEventListener('input', (e) => { this.settings.fadeOut = parseFloat(e.target.value) || 0; });
        fadeOutGroup.appendChild(fadeOutInput);
        panel.appendChild(fadeOutGroup);

        return panel;
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
        DOM.hideModal();
    }
};
