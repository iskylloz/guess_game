/**
 * Home Screen — Play Game, Editor, Quit.
 */
App.pages.home = {
    render(container) {
        const screen = DOM.create('div', { className: 'home-screen' }, [
            DOM.create('div', { className: 'home-content' }, [
                // Title
                DOM.create('div', { className: 'home-title' }, [
                    DOM.create('h1', { textContent: 'Guess the Picture' }),
                    DOM.create('p', { textContent: 'Le quiz multimédia pour tous !' })
                ]),

                // Navigation buttons
                DOM.create('div', { className: 'home-nav' }, [
                    // Play button
                    DOM.create('div', {
                        className: 'home-btn home-btn-game',
                        onClick: () => App.navigate('#/game/setup')
                    }, [
                        DOM.create('span', { className: 'home-btn-icon', textContent: '🎮' }),
                        DOM.create('span', { className: 'home-btn-label', textContent: 'Jouer' }),
                        DOM.create('span', { className: 'home-btn-desc', textContent: 'Lancer une partie' })
                    ]),

                    // Editor button
                    DOM.create('div', {
                        className: 'home-btn home-btn-editor',
                        onClick: () => App.navigate('#/editor')
                    }, [
                        DOM.create('span', { className: 'home-btn-icon', textContent: '✏️' }),
                        DOM.create('span', { className: 'home-btn-label', textContent: 'Éditeur' }),
                        DOM.create('span', { className: 'home-btn-desc', textContent: 'Créer & gérer les questions' })
                    ])
                ]),

                // Quit button
                DOM.create('div', { className: 'home-quit-wrapper' }, [
                    DOM.create('button', {
                        className: 'btn btn-outline home-quit-btn',
                        textContent: '✕ Quitter',
                        onClick: async () => {
                            const confirmed = await DOM.confirm('Voulez-vous quitter l\'application ?');
                            if (confirmed) {
                                try { await API.post('/api/quit', {}); } catch(e) {}
                            }
                        }
                    })
                ])
            ]),

            // Footer
            DOM.create('div', { className: 'home-footer', textContent: 'Guess the Picture v1.0' })
        ]);

        container.appendChild(screen);
    }
};
