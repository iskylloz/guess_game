/**
 * Game Animations — visual effects and synthesized sound effects for game events.
 * All methods are fire-and-forget with automatic DOM cleanup.
 * SFX are generated via Web Audio API (no external files needed).
 */
const GameAnimations = {

    _audioCtx: null,

    _getAudioCtx() {
        if (!this._audioCtx) {
            this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._audioCtx.state === 'suspended') {
            this._audioCtx.resume().catch(() => {});
        }
        return this._audioCtx;
    },

    // ===== SYNTHESIZED SFX =====

    _sfxCorrect() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        // Rising arpeggio: C5 → E5 → G5
        [523, 659, 784].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            osc.connect(gain);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.25);
        });
    },

    _sfxCorrectBlack() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

        // Triumphant fanfare: C5 → E5 → G5 → C6
        [523, 659, 784, 1047].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);
            osc.connect(gain);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.3);
        });

        // Sparkle overlay
        setTimeout(() => {
            const g2 = ctx.createGain();
            g2.connect(ctx.destination);
            g2.gain.setValueAtTime(vol * 0.15, ctx.currentTime);
            g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            [1568, 2093, 2637].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                osc.connect(g2);
                osc.start(ctx.currentTime + i * 0.06);
                osc.stop(ctx.currentTime + i * 0.06 + 0.15);
            });
        }, 400);
    },

    _sfxWrong() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        // Descending buzz: E4 → C4
        const osc1 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(330, now);
        osc1.frequency.linearRampToValueAtTime(262, now + 0.15);
        osc1.connect(gain);
        osc1.start(now);
        osc1.stop(now + 0.2);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(277, now + 0.2);
        osc2.frequency.linearRampToValueAtTime(220, now + 0.4);
        osc2.connect(gain);
        osc2.start(now + 0.2);
        osc2.stop(now + 0.45);
    },

    _sfxWrongBlack() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;

        // Heavy descending doom chord
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        [220, 165, 131].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.linearRampToValueAtTime(freq * 0.7, now + 0.6);
            osc.connect(gain);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.5);
        });

        // Sub rumble
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        subGain.connect(ctx.destination);
        subGain.gain.setValueAtTime(vol * 0.2, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        sub.type = 'sine';
        sub.frequency.setValueAtTime(55, now);
        sub.connect(subGain);
        sub.start(now);
        sub.stop(now + 0.7);
    },

    _sfxBlackReveal() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;

        // Dramatic low rumble + rising sweep
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(vol * 0.3, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.8);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 1.0);

        // Impact hit
        const hitGain = ctx.createGain();
        hitGain.connect(ctx.destination);
        hitGain.gain.setValueAtTime(vol * 0.4, now + 0.3);
        hitGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        const hit = ctx.createOscillator();
        hit.type = 'square';
        hit.frequency.setValueAtTime(110, now + 0.3);
        hit.frequency.exponentialRampToValueAtTime(55, now + 0.6);
        hit.connect(hitGain);
        hit.start(now + 0.3);
        hit.stop(now + 0.7);
    },

    _sfxTimerCritical() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;

        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.1);
    },

    /** Alert chime at 10s remaining — two quick warning tones */
    _sfxTimerWarning() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;

        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        // Two-tone alert: A5 → E5
        [880, 659].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.15);
            osc.connect(gain);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.12);
        });
    },

    /** Tick sound from 10s→1s — pitch and volume rise as time runs out */
    _sfxTimerTick(remaining) {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;

        // Progress: 0 at 10s → 1 at 1s
        const progress = (10 - Math.max(1, remaining)) / 9;
        // Pitch rises: 500Hz at 10s → 1100Hz at 1s
        const freq = 500 + progress * 600;
        // Volume rises: soft at 10s → louder at 1s
        const tickVol = vol * (0.08 + progress * 0.16);

        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(tickVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.06);

        // Double tick at ≤ 3s for extra tension
        if (remaining <= 3) {
            const g2 = ctx.createGain();
            g2.connect(ctx.destination);
            g2.gain.setValueAtTime(tickVol * 0.7, now + 0.12);
            g2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            const o2 = ctx.createOscillator();
            o2.type = 'square';
            o2.frequency.setValueAtTime(freq * 1.2, now + 0.12);
            o2.connect(g2);
            o2.start(now + 0.12);
            o2.stop(now + 0.18);
        }
    },

    /** End-of-timer buzz — harsh low buzz signaling time's up */
    _sfxTimerBuzz() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;

        // Main buzz: low sawtooth
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.35, now);
        gain.gain.setValueAtTime(vol * 0.35, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.5);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.6);

        // Harsh overtone
        const g2 = ctx.createGain();
        g2.connect(ctx.destination);
        g2.gain.setValueAtTime(vol * 0.15, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        const o2 = ctx.createOscillator();
        o2.type = 'square';
        o2.frequency.setValueAtTime(220, now);
        o2.frequency.linearRampToValueAtTime(165, now + 0.4);
        o2.connect(g2);
        o2.start(now);
        o2.stop(now + 0.45);
    },

    _sfxWinner() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;

        // Victory fanfare: C5 → C5 → G5 → C6 (hold)
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.3, now);
        gain.gain.setValueAtTime(vol * 0.3, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

        const notes = [
            { freq: 523, start: 0, dur: 0.15 },
            { freq: 523, start: 0.18, dur: 0.15 },
            { freq: 784, start: 0.36, dur: 0.2 },
            { freq: 1047, start: 0.6, dur: 0.8 },
        ];
        notes.forEach(n => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.freq, now + n.start);
            osc.connect(gain);
            osc.start(now + n.start);
            osc.stop(now + n.start + n.dur);
        });

        // Shimmer
        setTimeout(() => {
            const g2 = ctx.createGain();
            g2.connect(ctx.destination);
            g2.gain.setValueAtTime(vol * 0.12, ctx.currentTime);
            g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
            [2093, 2637, 3136].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                osc.connect(g2);
                osc.start(ctx.currentTime + i * 0.08);
                osc.stop(ctx.currentTime + i * 0.08 + 0.2);
            });
        }, 700);
    },

    _sfxScorePop() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;

        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.15);
    },

    // ===== BLACK TYPE SFX =====

    _sfxBonus() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;

        // Magical chime: ascending sparkle arpegggio
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        [523, 659, 784, 1047, 1319].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            osc.connect(gain);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        });

        // Shimmer overlay
        const shimGain = ctx.createGain();
        shimGain.connect(ctx.destination);
        shimGain.gain.setValueAtTime(vol * 0.1, now + 0.4);
        shimGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        [2093, 2637, 3136].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + 0.4);
            osc.connect(shimGain);
            osc.start(now + 0.4 + i * 0.06);
            osc.stop(now + 0.4 + i * 0.06 + 0.2);
        });
    },

    _sfxMalus() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;

        // Ominous descending tones + distortion
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

        [330, 277, 220, 165].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + i * 0.15);
            osc.frequency.linearRampToValueAtTime(freq * 0.8, now + i * 0.15 + 0.3);
            osc.connect(gain);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.35);
        });

        // Sub bass rumble
        const subGain = ctx.createGain();
        subGain.connect(ctx.destination);
        subGain.gain.setValueAtTime(vol * 0.2, now + 0.2);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(60, now + 0.2);
        sub.frequency.linearRampToValueAtTime(40, now + 0.9);
        sub.connect(subGain);
        sub.start(now + 0.2);
        sub.stop(now + 0.9);
    },

    _sfxHard() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        const now = ctx.currentTime;

        // Intense power-up: low rumble → rising sweep → impact
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(vol * 0.3, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        const sweep = ctx.createOscillator();
        sweep.type = 'sawtooth';
        sweep.frequency.setValueAtTime(60, now);
        sweep.frequency.exponentialRampToValueAtTime(500, now + 0.6);
        sweep.connect(gain);
        sweep.start(now);
        sweep.stop(now + 0.8);

        // Staccato hits
        [0.3, 0.45, 0.6].forEach((t, i) => {
            const hitGain = ctx.createGain();
            hitGain.connect(ctx.destination);
            hitGain.gain.setValueAtTime(vol * (0.2 + i * 0.1), now + t);
            hitGain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.15);
            const hit = ctx.createOscillator();
            hit.type = 'square';
            hit.frequency.setValueAtTime(110 + i * 55, now + t);
            hit.connect(hitGain);
            hit.start(now + t);
            hit.stop(now + t + 0.12);
        });
    },

    /** Play the SFX matching a black question type */
    sfxBlackType(type) {
        if (type === 'bonus') this._sfxBonus();
        else if (type === 'malus') this._sfxMalus();
        else if (type === 'hard') this._sfxHard();
    },

    // ===== NOTIFICATION SFX =====

    /** Soft chime for success toasts */
    sfxSuccess() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('notifications');
        if (vol < 0.01) return;
        const now = ctx.currentTime;

        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        // Quick rising two-note: G5 → B5
        [784, 988].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            osc.connect(gain);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.15);
        });
    },

    /** Alert tone for error toasts */
    sfxError() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('notifications');
        if (vol < 0.01) return;
        const now = ctx.currentTime;

        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        // Two low buzzy tones: Eb4 → C4
        [311, 262].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);
            osc.connect(gain);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.12);
        });
    },

    /** Gentle ding for warning toasts */
    sfxWarning() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('notifications');
        if (vol < 0.01) return;
        const now = ctx.currentTime;

        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        // Single bell-like ping: E5
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659, now);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.2);
    },

    /** Soft pop for info toasts */
    sfxInfo() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('notifications');
        if (vol < 0.01) return;
        const now = ctx.currentTime;

        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        // Gentle pop: A5
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(700, now + 0.1);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.15);
    },

    /** Lightweight click sound for UI buttons */
    sfxClick() {
        const ctx = this._getAudioCtx();
        const vol = Media.getEffectiveVolume('animations');
        if (vol < 0.01) return;
        const now = ctx.currentTime;

        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol * 0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.06);
    },

    // ===== VISUAL ANIMATIONS =====

    flash(container, type) {
        const overlay = document.createElement('div');
        overlay.className = `anim-flash anim-flash-${type}`;
        container.style.position = container.style.position || 'relative';
        container.appendChild(overlay);
        overlay.addEventListener('animationend', () => overlay.remove());

        // SFX based on type
        if (type === 'correct') this._sfxCorrect();
        else if (type === 'correct-black') this._sfxCorrectBlack();
        else if (type === 'wrong') this._sfxWrong();
        else if (type === 'wrong-black') this._sfxWrongBlack();
    },

    shake(el, intensity = 'normal') {
        const cls = intensity === 'intense' ? 'anim-shake-intense' : 'anim-shake';
        el.classList.add(cls);
        el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
    },

    confetti(container, options = {}) {
        const count = options.count || 40;
        const colors = options.colors || ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#ffffff'];
        const duration = options.duration || 1200;

        const wrapper = document.createElement('div');
        wrapper.className = 'anim-confetti-wrapper';
        container.style.position = container.style.position || 'relative';
        container.appendChild(wrapper);

        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'anim-confetti-particle';
            const color = colors[Math.floor(Math.random() * colors.length)];
            const left = Math.random() * 100;
            const delay = Math.random() * 0.4;
            const rotEnd = Math.random() * 720 - 360;
            const xDrift = Math.random() * 60 - 30;
            const size = 4 + Math.random() * 6;

            particle.style.cssText = `
                left: ${left}%;
                background: ${color};
                width: ${size}px;
                height: ${size}px;
                animation-delay: ${delay}s;
                animation-duration: ${duration}ms;
                --x-drift: ${xDrift}px;
                --rot-end: ${rotEnd}deg;
            `;
            wrapper.appendChild(particle);
        }

        setTimeout(() => wrapper.remove(), duration + 500);
    },

    scorePop(el) {
        el.classList.remove('anim-score-pop');
        void el.offsetWidth;
        el.classList.add('anim-score-pop');
        this._sfxScorePop();
        el.addEventListener('animationend', () => el.classList.remove('anim-score-pop'), { once: true });
    },

    blackReveal(questionContainer) {
        questionContainer.classList.add('question-black', 'anim-black-reveal');
        this._sfxBlackReveal();
        questionContainer.addEventListener('animationend', () => {
            questionContainer.classList.remove('anim-black-reveal');
        }, { once: true });

        this.confetti(questionContainer, {
            count: 25,
            colors: ['#1F2937', '#374151', '#4B5563', '#6B7280', '#9333ea'],
            duration: 1500
        });
    },

    timerCritical(el) {
        if (el && !el.classList.contains('anim-timer-critical')) {
            el.classList.add('anim-timer-critical');
            this._sfxTimerCritical();
        }
    },

    timerCriticalRemove(el) {
        if (el) el.classList.remove('anim-timer-critical');
    },

    /** Warning chime when timer hits 10s */
    timerWarning() { this._sfxTimerWarning(); },

    /** Accelerating tick for countdown ≤ 5s */
    timerTick(remaining) { this._sfxTimerTick(remaining); },

    /** Harsh buzz when timer reaches 0 */
    timerBuzz() { this._sfxTimerBuzz(); },

    winnerCelebration(container, winnerRow) {
        winnerRow.classList.add('anim-winner-row');
        this._sfxWinner();
        this.confetti(container, {
            count: 60,
            colors: ['#fbbf24', '#f59e0b', '#eab308', '#ffffff', '#fef3c7'],
            duration: 2000
        });
    }
};
