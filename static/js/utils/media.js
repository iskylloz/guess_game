/**
 * Media utilities: YouTube parsing, audio helpers, image helpers.
 */
const Media = {
    // ===== YOUTUBE =====
    YT_REGEX: /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,

    /**
     * Extract YouTube video ID from a URL.
     * @returns {string|null} Video ID or null if invalid.
     */
    extractYouTubeId(url) {
        if (!url) return null;
        const match = url.match(this.YT_REGEX);
        return match ? match[1] : null;
    },

    /**
     * Check if a URL is a valid YouTube URL.
     */
    isYouTubeUrl(url) {
        return this.extractYouTubeId(url) !== null;
    },

    /**
     * Get YouTube embed URL from a video ID.
     */
    getYouTubeEmbedUrl(videoId) {
        return `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
    },

    /**
     * Create a YouTube iframe element.
     */
    createYouTubeEmbed(videoId, width = '100%', height = '100%') {
        const iframe = document.createElement('iframe');
        iframe.src = this.getYouTubeEmbedUrl(videoId);
        iframe.width = width;
        iframe.height = height;
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        return iframe;
    },

    // SFX are handled by GameAnimations (Web Audio API synthesis)

    /**
     * Stop only audio elements on a specific channel.
     * Leaves other channels untouched.
     */
    stopChannel(channel) {
        this._activeAudios.forEach((ch, audio) => {
            if (ch === channel) {
                audio.pause();
                audio.currentTime = 0;
            }
        });
        // Also stop YouTube iframes if stopping 'questions' channel
        if (channel === 'questions') {
            document.querySelectorAll('iframe[src*="youtube"]').forEach(iframe => {
                try {
                    iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                } catch (_) {}
            });
        }
    },

    // ===== AUDIO MANAGER =====

    /** Volume channels (0-1), each persisted in localStorage.
     *  Migrates from old single 'app_volume' key if present. */
    _volumes: (() => {
        const old = localStorage.getItem('app_volume');
        const master = parseFloat(localStorage.getItem('vol_master') ?? old ?? '1');
        if (old && !localStorage.getItem('vol_master')) {
            localStorage.setItem('vol_master', master.toString());
            localStorage.removeItem('app_volume');
        }
        return {
            master,
            notifications: parseFloat(localStorage.getItem('vol_notifications') ?? '1'),
            questions:     parseFloat(localStorage.getItem('vol_questions')     ?? '1'),
            animations:    parseFloat(localStorage.getItem('vol_animations')    ?? '1'),
        };
    })(),

    /** All active Audio elements tracked for global stop/volume, with their channel */
    _activeAudios: new Map(), // Map<Audio, channel>

    /** Get volume for a channel */
    getVolume(channel = 'master') {
        return this._volumes[channel] ?? 1;
    },

    /** Compute effective volume for a channel (master × channel) */
    getEffectiveVolume(channel = 'master') {
        if (channel === 'master') return this._volumes.master;
        return this._volumes.master * (this._volumes[channel] ?? 1);
    },

    /** Set volume for a channel, update all tracked audios */
    setVolume(v, channel = 'master') {
        this._volumes[channel] = Math.max(0, Math.min(1, v));
        localStorage.setItem('vol_' + channel, this._volumes[channel].toString());
        // Migrate old key on master change
        if (channel === 'master') localStorage.removeItem('app_volume');
        this._applyVolumes();
    },

    /** Apply effective volumes to all tracked audio elements */
    _applyVolumes() {
        this._activeAudios.forEach((ch, audio) => {
            audio.volume = this.getEffectiveVolume(ch);
        });
    },

    _trackAudio(audio, channel = 'questions') {
        audio.volume = this.getEffectiveVolume(channel);
        this._activeAudios.set(audio, channel);
        audio.addEventListener('ended', () => this._activeAudios.delete(audio));
    },

    _untrackAudio(audio) {
        audio.pause();
        audio.src = '';
        this._activeAudios.delete(audio);
    },

    // ===== AUDIO PLAYER =====

    /**
     * Create a custom audio player element.
     */
    createAudioPlayer(src) {
        const audio = new Audio(src);
        this._trackAudio(audio);

        const container = DOM.create('div', { className: 'game-audio-player' });

        const playBtn = DOM.create('button', {
            className: 'audio-play-btn',
            innerHTML: '&#9654;',
            onClick: () => {
                if (audio.paused) {
                    audio.play();
                    playBtn.innerHTML = '&#9646;&#9646;';
                } else {
                    audio.pause();
                    playBtn.innerHTML = '&#9654;';
                }
            }
        });

        const progress = DOM.create('div', { className: 'audio-progress' });
        const progressFill = DOM.create('div', { className: 'audio-progress-fill' });
        progress.appendChild(progressFill);

        const timeDisplay = DOM.create('span', {
            className: 'audio-time',
            textContent: '0:00'
        });

        progress.addEventListener('click', (e) => {
            const rect = progress.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            audio.currentTime = ratio * audio.duration;
        });

        audio.addEventListener('timeupdate', () => {
            if (audio.duration) {
                const pct = (audio.currentTime / audio.duration) * 100;
                progressFill.style.width = pct + '%';
                timeDisplay.textContent = DOM.formatTime(audio.currentTime);
            }
        });

        audio.addEventListener('ended', () => {
            playBtn.innerHTML = '&#9654;';
            progressFill.style.width = '0%';
        });

        container.appendChild(playBtn);
        container.appendChild(progress);
        container.appendChild(timeDisplay);

        container._audio = audio;
        container._destroy = () => this._untrackAudio(audio);

        return container;
    },

    /**
     * Stop all audio: tracked elements, legacy players, YouTube iframes.
     */
    stopAllAudio() {
        this._activeAudios.forEach((channel, audio) => {
            audio.pause();
            audio.currentTime = 0;
        });
        document.querySelectorAll('.game-audio-player').forEach(player => {
            if (player._audio) {
                player._audio.pause();
                player._audio.currentTime = 0;
            }
        });
        document.querySelectorAll('iframe[src*="youtube"]').forEach(iframe => {
            try {
                iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            } catch (_) {}
        });
    },

    // ===== IMAGES =====

    /**
     * Create an image preview element with edit/delete buttons.
     */
    createImagePreview(src, onEdit, onDelete) {
        const container = DOM.create('div', { className: 'media-preview' });
        const img = DOM.create('img', { src: src });
        container.appendChild(img);

        const actions = DOM.create('div', { className: 'media-preview-actions' });
        if (onEdit) {
            actions.appendChild(DOM.create('button', {
                className: 'btn btn-sm btn-primary',
                textContent: '✏️ Éditer',
                onClick: (e) => { e.stopPropagation(); onEdit(); }
            }));
        }
        if (onDelete) {
            actions.appendChild(DOM.create('button', {
                className: 'btn btn-sm btn-danger',
                textContent: '🗑️',
                onClick: (e) => { e.stopPropagation(); onDelete(); }
            }));
        }
        container.appendChild(actions);

        return container;
    },

    /**
     * Create an audio preview element with edit/delete buttons.
     */
    createAudioPreview(src, onEdit, onDelete) {
        const container = DOM.create('div', { className: 'media-preview', style: { padding: '12px' } });
        const player = this.createAudioPlayer(src);
        container.appendChild(player);

        const actions = DOM.create('div', {
            className: 'media-preview-actions',
            style: { position: 'static', marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }
        });
        if (onEdit) {
            actions.appendChild(DOM.create('button', {
                className: 'btn btn-sm btn-primary',
                textContent: '✂️ Éditer',
                onClick: (e) => { e.stopPropagation(); onEdit(); }
            }));
        }
        if (onDelete) {
            actions.appendChild(DOM.create('button', {
                className: 'btn btn-sm btn-danger',
                textContent: '🗑️',
                onClick: (e) => { e.stopPropagation(); onDelete(); }
            }));
        }
        container.appendChild(actions);

        container._destroy = () => player._destroy && player._destroy();
        return container;
    },

    // ===== FILE HELPERS =====

    /**
     * Read a file as Data URL.
     */
    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Read a file as ArrayBuffer.
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    // ===== OFFLINE =====

    isOnline() {
        return navigator.onLine;
    },

    /**
     * Check if a question has YouTube content.
     */
    hasYouTube(question) {
        return !!(question.question.youtube || question.answer.youtube);
    },

    /**
     * Encode an AudioBuffer to WAV format.
     */
    audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;

        let interleaved;
        if (numChannels === 1) {
            interleaved = buffer.getChannelData(0);
        } else {
            interleaved = new Float32Array(buffer.length * numChannels);
            for (let i = 0; i < buffer.length; i++) {
                for (let ch = 0; ch < numChannels; ch++) {
                    interleaved[i * numChannels + ch] = buffer.getChannelData(ch)[i];
                }
            }
        }

        const dataLength = interleaved.length * (bitDepth / 8);
        const headerLength = 44;
        const arrayBuffer = new ArrayBuffer(headerLength + dataLength);
        const view = new DataView(arrayBuffer);

        // RIFF header
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(view, 8, 'WAVE');

        // fmt chunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
        view.setUint16(32, numChannels * (bitDepth / 8), true);
        view.setUint16(34, bitDepth, true);

        // data chunk
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        // Write samples
        let offset = 44;
        for (let i = 0; i < interleaved.length; i++) {
            let sample = Math.max(-1, Math.min(1, interleaved[i]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, sample, true);
            offset += 2;
        }

        return arrayBuffer;

        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }
    },

    /**
     * Categories data shared between game and editor.
     */
    CATEGORIES: [
        { id: 'blue', color: '#2563EB', label: 'Bleu', emoji: '🔵', textColor: '#ffffff' },
        { id: 'green', color: '#10B981', label: 'Vert', emoji: '🟢', textColor: '#ffffff' },
        { id: 'red', color: '#EF4444', label: 'Rouge', emoji: '🔴', textColor: '#ffffff' },
        { id: 'white', color: '#F3F4F6', label: 'Blanc', emoji: '⚪', textColor: '#1F2937' },
        { id: 'yellow', color: '#EAB308', label: 'Jaune', emoji: '🟡', textColor: '#1F2937' },
        { id: 'pink', color: '#EC4899', label: 'Rose', emoji: '🩷', textColor: '#ffffff' },
        { id: 'black', color: '#1F2937', label: 'Noir', emoji: '⚫', textColor: '#ffffff' }
    ],

    getCategoryById(id) {
        return this.CATEGORIES.find(c => c.id === id) || this.CATEGORIES[0];
    },

    // ===== IMAGE AUTO-SIZING =====

    /**
     * Detect image orientation from an <img> element or {width, height}.
     * Returns { type, label, ratio }
     */
    detectImageOrientation(img) {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const ratio = w / h;
        if (ratio > 1.8)   return { type: 'ultra-wide', label: 'Ultra-large', ratio };
        if (ratio > 1.2)   return { type: 'landscape',  label: 'Paysage',     ratio };
        if (ratio >= 0.8)  return { type: 'square',     label: 'Carré',       ratio };
        if (ratio >= 0.55) return { type: 'portrait',   label: 'Portrait',    ratio };
                           return { type: 'ultra-tall', label: 'Ultra-haut',  ratio };
    },

    /**
     * Compute optimal display size for an image in a container.
     * @param {HTMLImageElement|{naturalWidth,naturalHeight}} img
     * @param {number} containerW  available width
     * @param {number} containerH  available height
     * @returns {{ width:number, height:number, orientation:object }}
     */
    computeImageSize(img, containerW, containerH) {
        const orient = this.detectImageOrientation(img);
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;

        const pad = 20;
        const availW = containerW - pad * 2;
        const availH = containerH - pad * 2;

        let maxW, maxH;

        switch (orient.type) {
            case 'ultra-wide':
                maxW = availW * 0.98;
                maxH = availH * 0.75;
                break;
            case 'landscape':
                maxW = availW * 0.96;
                maxH = availH * 0.90;
                break;
            case 'square':
                maxW = Math.min(availW * 0.90, availH * 0.90);
                maxH = maxW;
                break;
            case 'portrait':
                maxH = availH * 0.95;
                maxW = availW * 0.75;
                break;
            case 'ultra-tall':
                maxH = availH * 0.95;
                maxW = availW * 0.60;
                break;
        }

        // Don't upscale beyond native resolution
        const scale = Math.min(maxW / imgW, maxH / imgH, 1);
        return {
            width: Math.round(imgW * scale),
            height: Math.round(imgH * scale),
            orientation: orient
        };
    }
};
