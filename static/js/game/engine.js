/**
 * Game Engine — Core game logic: state, question selection, scoring, team rotation.
 */
class GameEngine {
    constructor(config) {
        this.mode = config.mode;           // 'random', 'classic', 'timer'
        this.adminMode = config.adminMode || false;
        this.blackChance = config.blackChance || 5;
        this.timerDuration = config.timerDuration || 0;

        this.teams = config.teams.map(t => ({
            name: t.name,
            icon: t.icon || null,
            score: 0,
            correct: 0,
            incorrect: 0,
            blackDrawn: 0,
            blackCorrect: 0
        }));

        this.currentTeamIndex = 0;
        this.allQuestions = [];
        this.usedQuestionIds = new Set();
        this.cancelledQuestions = [];
        this.currentQuestion = null;
        this.currentIsBlack = false;      // Was this question drawn as a black override?
        this.isFinished = false;
        this.timer = null;

        // Questions grouped by category for classic mode
        this.questionsByCategory = {};
    }

    async init() {
        const data = await API.get('/api/questions');
        let questions = data.questions || [];

        // Filter YouTube if offline
        if (!navigator.onLine) {
            questions = questions.filter(q => !Media.hasYouTube(q));
        }

        this.allQuestions = questions;

        // Group by category
        this.questionsByCategory = {};
        for (const q of questions) {
            if (!this.questionsByCategory[q.category]) {
                this.questionsByCategory[q.category] = [];
            }
            this.questionsByCategory[q.category].push(q);
        }

        // Setup timer if timer mode (per-question countdown)
        if (this.mode === 'timer' && this.timerDuration > 0) {
            this.timer = new GameTimer(
                this.timerDuration,
                (remaining, total) => {
                    if (this.onTimerTick) this.onTimerTick(remaining, total);
                },
                () => {
                    // Timer expired for this question — notify UI but don't end game
                    if (this.onTimerEnd) this.onTimerEnd();
                }
            );
        }

        return this;
    }

    /**
     * Get available (unused) questions for a given category.
     */
    getAvailableQuestions(category = null) {
        let pool;
        if (category) {
            pool = this.questionsByCategory[category] || [];
        } else {
            pool = this.allQuestions;
        }
        return pool.filter(q => !this.usedQuestionIds.has(q.id));
    }

    /**
     * Get count of remaining questions per category.
     */
    getRemainingByCategory() {
        const counts = {};
        for (const cat of Media.CATEGORIES) {
            const available = this.getAvailableQuestions(cat.id);
            counts[cat.id] = available.length;
        }
        return counts;
    }

    /**
     * Get total remaining questions.
     */
    getTotalRemaining() {
        return this.allQuestions.filter(q => !this.usedQuestionIds.has(q.id)).length;
    }

    /**
     * Pick the next question.
     * For Random mode: random from all unused.
     * For Classic/Timer: from the selected category, with black chance override.
     */
    getNextQuestion(selectedCategory = null) {
        if (this.isFinished) return null;

        let question = null;
        this.currentIsBlack = false;

        if (this.mode === 'random') {
            // Random mode: pick from all unused
            const available = this.getAvailableQuestions();
            if (available.length === 0) {
                this.endGame();
                return null;
            }

            // Roll for black chance
            const blackAvailable = available.filter(q => q.category === 'black');
            const nonBlackAvailable = available.filter(q => q.category !== 'black');

            if (blackAvailable.length > 0 && Math.random() * 100 < this.blackChance) {
                question = blackAvailable[Math.floor(Math.random() * blackAvailable.length)];
                this.currentIsBlack = true;
            } else if (nonBlackAvailable.length > 0) {
                question = nonBlackAvailable[Math.floor(Math.random() * nonBlackAvailable.length)];
            } else {
                question = available[Math.floor(Math.random() * available.length)];
                if (question.category === 'black') this.currentIsBlack = true;
            }
        } else {
            // Classic / Timer mode
            if (!selectedCategory) return null;

            // Check for black override (unless admin mode or already black selected)
            if (!this.adminMode && selectedCategory !== 'black') {
                const blackAvailable = this.getAvailableQuestions('black');
                if (blackAvailable.length > 0 && Math.random() * 100 < this.blackChance) {
                    // Black override!
                    question = blackAvailable[Math.floor(Math.random() * blackAvailable.length)];
                    this.currentIsBlack = true;
                }
            }

            if (!question) {
                const available = this.getAvailableQuestions(selectedCategory);
                if (available.length === 0) return null;
                question = available[Math.floor(Math.random() * available.length)];
                if (question.category === 'black') this.currentIsBlack = true;
            }
        }

        if (question) {
            this.usedQuestionIds.add(question.id);
            this.currentQuestion = question;

            // Track black drawn
            if (this.currentIsBlack || question.category === 'black') {
                this.currentIsBlack = true;
                this.getCurrentTeam().blackDrawn++;
            }

            // Reset and start timer for each new question
            if (this.timer) {
                this.timer.reset();
                this.timer.start();
            }
        }

        return question;
    }

    /**
     * Get current team.
     */
    getCurrentTeam() {
        return this.teams[this.currentTeamIndex];
    }

    /**
     * Pause the per-question timer (e.g. when showing answer).
     */
    pauseTimer() {
        if (this.timer) this.timer.pause();
    }

    /**
     * Validate answer — correct, team replays.
     */
    validate() {
        const team = this.getCurrentTeam();
        if (this.currentIsBlack) {
            team.score += 2;
            team.correct++;
            team.blackCorrect++;
        } else {
            team.score += 1;
            team.correct++;
        }
        this.currentQuestion = null;
        // Team replays — don't advance

        if (this.getTotalRemaining() === 0) {
            this.endGame();
        }
    }

    /**
     * Refuse answer — incorrect. Advance team in classic/timer, not in random (single team).
     */
    refuse() {
        const team = this.getCurrentTeam();
        team.incorrect++;
        this.currentQuestion = null;

        if (this.mode !== 'random') {
            this.advanceTeam();
        }

        if (this.getTotalRemaining() === 0) {
            this.endGame();
        }
    }

    /**
     * Cancel question — no points, tracked, team replays.
     */
    cancel() {
        if (this.currentQuestion) {
            this.cancelledQuestions.push({
                id: this.currentQuestion.id,
                category: this.currentQuestion.category,
                question_text: this.currentQuestion.question.text,
                answer_text: this.currentQuestion.answer.text
            });
        }
        this.currentQuestion = null;
        // Team replays — don't advance
    }

    /**
     * Advance to next team.
     */
    advanceTeam() {
        this.currentTeamIndex = (this.currentTeamIndex + 1) % this.teams.length;
    }

    /**
     * End the game.
     */
    endGame() {
        this.isFinished = true;
        if (this.timer) {
            this.timer.stop();
        }
        this.currentQuestion = null;
    }

    /**
     * Get winner team(s).
     */
    getWinners() {
        const maxScore = Math.max(...this.teams.map(t => t.score));
        return this.teams.filter(t => t.score === maxScore);
    }

    /**
     * Get sorted teams (highest score first).
     */
    getSortedTeams() {
        return [...this.teams].sort((a, b) => b.score - a.score);
    }
}
