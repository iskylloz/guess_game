/**
 * Game End Screen — Results, stats, cancelled questions export.
 */
const GameEnd = {
    render(container) {
        const engine = GameUI.engine;
        if (!engine) {
            App.navigate('#/home');
            return;
        }

        DOM.clear(container);

        const screen = DOM.create('div', { className: 'game-end' });
        const content = DOM.create('div', { className: 'game-end-content' });

        // Title
        content.appendChild(DOM.create('h1', { textContent: '🎉 Partie terminée !' }));

        if (engine.mode === 'random') {
            // Random mode: single team summary cards
            const team = engine.teams[0];
            const total = team.correct + team.incorrect;
            const accuracy = total > 0 ? Math.round((team.correct / total) * 100) : 0;
            const used = engine.usedQuestionIds.size;
            const allQ = engine.allQuestions.length;

            const summary = DOM.create('div', { className: 'random-end-summary' });
            summary.appendChild(DOM.create('div', { className: 'random-end-score' }, [
                DOM.create('span', { textContent: 'Score final' }),
                DOM.create('span', { className: 'random-end-score-value', textContent: team.score.toString() })
            ]));

            const statsGrid = DOM.create('div', { className: 'random-end-stats' });
            const statItems = [
                { label: 'Questions jouées', value: `${used} / ${allQ}` },
                { label: 'Correctes', value: team.correct.toString() },
                { label: 'Incorrectes', value: team.incorrect.toString() },
                { label: 'Précision', value: accuracy + '%' },
            ];
            if (team.blackDrawn > 0) {
                statItems.push({ label: 'Noires tirées', value: team.blackDrawn.toString() });
                statItems.push({ label: 'Noires réussies', value: team.blackCorrect.toString() });
            }
            for (const s of statItems) {
                statsGrid.appendChild(DOM.create('div', { className: 'random-end-stat' }, [
                    DOM.create('span', { className: 'random-end-stat-label', textContent: s.label }),
                    DOM.create('span', { className: 'random-end-stat-value', textContent: s.value })
                ]));
            }
            summary.appendChild(statsGrid);
            content.appendChild(summary);

            // Score pop animation
            const scoreValueEl = summary.querySelector('.random-end-score-value');
            if (scoreValueEl) {
                setTimeout(() => GameAnimations.scorePop(scoreValueEl), 300);
            }
        } else {
            // Classic/Timer: competitive table
            const sortedTeams = engine.getSortedTeams();
            const winners = engine.getWinners();
            const table = DOM.create('table', { className: 'stats-table' });

            const thead = DOM.create('thead');
            const headerRow = DOM.create('tr');
            ['Équipe', 'Score', '✅ Correctes', '❌ Incorrectes', '💀 Noires tirées', '⭐ Noires réussies', 'Précision'].forEach(h => {
                headerRow.appendChild(DOM.create('th', { textContent: h }));
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = DOM.create('tbody');
            for (const team of sortedTeams) {
                const row = DOM.create('tr');
                const total = team.correct + team.incorrect;
                const accuracy = total > 0 ? Math.round((team.correct / total) * 100) : 0;
                const isWinner = winners.includes(team);

                const nameCell = DOM.create('td', { className: 'team-name-cell' });
                if (team.icon) {
                    nameCell.appendChild(DOM.create('img', {
                        className: 'end-team-icon',
                        src: `/static/assets/teams/${team.icon}.png`
                    }));
                }
                nameCell.appendChild(DOM.create('span', { textContent: team.name }));
                if (isWinner && sortedTeams.indexOf(team) === 0) {
                    nameCell.appendChild(DOM.create('span', {
                        className: 'winner-label',
                        textContent: '🏆 GAGNANT'
                    }));
                }
                row.appendChild(nameCell);
                row.appendChild(DOM.create('td', { textContent: team.score.toString(), style: { fontWeight: '800', fontSize: '1.3rem' } }));
                row.appendChild(DOM.create('td', { textContent: team.correct.toString() }));
                row.appendChild(DOM.create('td', { textContent: team.incorrect.toString() }));
                row.appendChild(DOM.create('td', { textContent: team.blackDrawn.toString() }));
                row.appendChild(DOM.create('td', { textContent: team.blackCorrect.toString() }));
                row.appendChild(DOM.create('td', { textContent: accuracy + '%' }));

                tbody.appendChild(row);
            }
            table.appendChild(tbody);
            content.appendChild(table);

            // Winner celebration animation (after DOM is in place)
            const firstRow = tbody.querySelector('tr');
            if (firstRow) {
                setTimeout(() => {
                    GameAnimations.winnerCelebration(screen, firstRow);
                }, 300);
            }
        }

        // Cancelled questions
        if (engine.cancelledQuestions.length > 0) {
            const cancelSection = DOM.create('div', { className: 'cancelled-section' });
            cancelSection.appendChild(DOM.create('h3', {
                textContent: `🚫 Questions annulées (${engine.cancelledQuestions.length})`
            }));

            const list = DOM.create('div', { className: 'cancelled-list' });
            for (const cq of engine.cancelledQuestions) {
                const cat = Media.getCategoryById(cq.category);
                const item = DOM.create('div', { className: 'cancelled-item' }, [
                    DOM.create('span', {
                        className: `badge badge-${cq.category}`,
                        textContent: cat.emoji,
                        style: { flexShrink: '0' }
                    }),
                    DOM.create('span', { className: 'cancelled-q', textContent: `Q: ${cq.question_text}` }),
                    DOM.create('span', { className: 'cancelled-a', textContent: `R: ${cq.answer_text}` })
                ]);
                list.appendChild(item);
            }
            cancelSection.appendChild(list);

            cancelSection.appendChild(DOM.create('button', {
                className: 'btn btn-outline',
                textContent: '💾 Exporter les questions annulées (JSON)',
                onClick: () => this.exportCancelled(engine.cancelledQuestions)
            }));

            content.appendChild(cancelSection);
        }

        // Actions
        const actions = DOM.create('div', { className: 'end-actions' });
        actions.appendChild(DOM.create('button', {
            className: 'btn btn-success btn-lg',
            textContent: '🔄 Nouvelle Partie',
            onClick: () => App.navigate('#/game/setup')
        }));
        actions.appendChild(DOM.create('button', {
            className: 'btn btn-outline btn-lg',
            textContent: '🏠 Accueil',
            onClick: () => App.navigate('#/home')
        }));
        content.appendChild(actions);

        screen.appendChild(content);
        container.appendChild(screen);
    },

    exportCancelled(cancelled) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const data = {
            date: now.toISOString(),
            total: cancelled.length,
            questions: cancelled
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `questions_a_corriger_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        DOM.toast('Fichier exporté !', 'success');
    }
};
