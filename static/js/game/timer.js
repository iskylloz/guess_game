/**
 * Game Timer — Countdown timer for Timer mode.
 */
class GameTimer {
    constructor(durationSeconds, onTick, onEnd) {
        this.total = durationSeconds;
        this.remaining = durationSeconds;
        this.intervalId = null;
        this.onTick = onTick;
        this.onEnd = onEnd;
        this.running = false;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.intervalId = setInterval(() => {
            this.remaining--;
            if (this.onTick) this.onTick(this.remaining, this.total);
            // Tick sound for last 5 seconds
            if (this.remaining > 0 && this.remaining <= 5) {
                Media.playSFX('timer_tick');
            }
            if (this.remaining <= 0) {
                this.stop();
                if (this.onEnd) this.onEnd();
            }
        }, 1000);
    }

    pause() {
        this.running = false;
        clearInterval(this.intervalId);
        this.intervalId = null;
    }

    resume() {
        if (!this.running && this.remaining > 0) {
            this.start();
        }
    }

    stop() {
        this.running = false;
        clearInterval(this.intervalId);
        this.intervalId = null;
    }

    reset() {
        this.stop();
        this.remaining = this.total;
    }

    /**
     * Get CSS class for timer color based on remaining percentage.
     */
    getColorClass() {
        const pct = this.remaining / this.total;
        if (pct > 0.5) return 'timer-green';
        if (pct > 0.25) return 'timer-yellow';
        return 'timer-red';
    }

    /**
     * Format remaining time as MM:SS.
     */
    getFormattedTime() {
        return DOM.formatTime(Math.max(0, this.remaining));
    }
}
