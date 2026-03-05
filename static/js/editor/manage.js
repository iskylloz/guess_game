/**
 * Editor — Manage Tab: Stats, filters, question cards list.
 */
const EditorManage = {
    questions: [],
    stats: null,
    filterCategory: '',
    filterText: '',
    sortBy: 'newest',
    needsRefresh: true,

    async render(container) {
        if (this.needsRefresh) {
            await this.loadData();
        }

        const content = DOM.create('div', { className: 'manage-content' });

        // Actions bar (import/export/delete) at the top
        content.appendChild(this.buildActionsBar());

        // Stats
        content.appendChild(this.buildStats());

        // Filters
        content.appendChild(this.buildFilters());

        // Questions list
        content.appendChild(this.buildQuestionsList());

        container.appendChild(content);
    },

    async loadData() {
        try {
            const params = new URLSearchParams();
            if (this.filterCategory) params.set('category', this.filterCategory);
            if (this.filterText) params.set('search', this.filterText);
            params.set('sort', this.sortBy);

            const [questionsData, statsData] = await Promise.all([
                API.get(`/api/questions?${params.toString()}`),
                API.get('/api/questions/stats')
            ]);
            this.questions = questionsData.questions || [];
            this.stats = statsData;
            this.needsRefresh = false;
        } catch (err) {
            DOM.toast('Erreur de chargement.', 'error');
        }
    },

    buildStats() {
        const section = DOM.create('div', { className: 'manage-stats animate-fadeIn' });

        const total = this.stats ? this.stats.total : 0;
        section.appendChild(DOM.create('div', { className: 'stats-total', textContent: total.toString() }));
        section.appendChild(DOM.create('div', { className: 'stats-total-label', textContent: 'questions au total' }));

        if (this.stats && this.stats.by_category) {
            const cats = DOM.create('div', { className: 'stats-categories' });
            for (const cat of Media.CATEGORIES) {
                const count = this.stats.by_category[cat.id] || 0;
                if (count > 0 || true) { // Show all categories
                    cats.appendChild(DOM.create('div', { className: 'stat-category' }, [
                        DOM.create('div', { className: 'stat-cat-dot', style: { backgroundColor: cat.color } }),
                        DOM.create('span', { className: 'stat-cat-count', textContent: count.toString() }),
                        DOM.create('span', { className: 'stat-cat-label', textContent: cat.label })
                    ]));
                }
            }
            section.appendChild(cats);
        }

        return section;
    },

    buildFilters() {
        const filters = DOM.create('div', { className: 'manage-filters' });

        // Text search
        const searchWrapper = DOM.create('div', { className: 'search-input-wrapper' });
        searchWrapper.appendChild(DOM.create('span', { className: 'search-icon', textContent: '🔍' }));
        const searchInput = DOM.create('input', {
            className: 'input',
            type: 'text',
            placeholder: 'Rechercher dans les questions...',
            value: this.filterText
        });
        searchInput.addEventListener('input', DOM.debounce((e) => {
            this.filterText = e.target.value;
            this.reloadAndRefresh();
        }, 300));
        searchWrapper.appendChild(searchInput);
        filters.appendChild(searchWrapper);

        // Sort selector (custom dropdown)
        const sortOptions = [
            { value: 'newest',    label: '📅 Plus récents' },
            { value: 'oldest',    label: '📅 Plus anciens' },
            { value: 'modified',  label: '🔄 Derniers modifiés' },
            { value: 'alpha_asc', label: '🔤 A → Z' },
            { value: 'alpha_desc',label: '🔤 Z → A' },
            { value: 'category',  label: '🏷️ Catégorie' },
        ];
        const currentSort = sortOptions.find(o => o.value === this.sortBy) || sortOptions[0];

        const sortWrapper = DOM.create('div', { className: 'sort-dropdown' });
        const sortToggle = DOM.create('button', {
            className: 'sort-dropdown-toggle',
            textContent: currentSort.label
        });
        const sortMenu = DOM.create('div', { className: 'sort-dropdown-menu' });

        for (const opt of sortOptions) {
            sortMenu.appendChild(DOM.create('div', {
                className: `sort-dropdown-item ${opt.value === this.sortBy ? 'active' : ''}`,
                textContent: opt.label,
                onClick: () => {
                    this.sortBy = opt.value;
                    // Update toggle text immediately
                    sortToggle.textContent = opt.label;
                    // Update active state on all items
                    DOM.$$('.sort-dropdown-item', sortMenu).forEach(item => {
                        item.classList.toggle('active', item.textContent === opt.label);
                    });
                    sortWrapper.classList.remove('open');
                    this.reloadAndRefresh();
                }
            }));
        }

        sortToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sortWrapper.classList.toggle('open');
        });

        // Close on outside click
        document.addEventListener('click', () => {
            sortWrapper.classList.remove('open');
        }, { once: false });

        sortWrapper.appendChild(sortToggle);
        sortWrapper.appendChild(sortMenu);
        filters.appendChild(sortWrapper);

        // Category filters
        const catFilters = DOM.create('div', { className: 'filter-cats' });

        const updateCatButtons = (activeId) => {
            DOM.$$('.filter-cat-btn', catFilters).forEach(btn => {
                const btnCatId = btn.dataset.catId || '';
                const isActive = btnCatId === activeId;
                btn.classList.toggle('active', isActive);
                if (!btnCatId) {
                    // "Toutes" button
                    btn.style.color = isActive ? 'var(--accent)' : '';
                } else {
                    const cat = Media.getCategoryById(btnCatId);
                    btn.style.color = isActive ? cat.color : '';
                }
            });
        };

        catFilters.appendChild(DOM.create('button', {
            className: `filter-cat-btn ${!this.filterCategory ? 'active' : ''}`,
            textContent: 'Toutes',
            dataset: { catId: '' },
            style: { color: !this.filterCategory ? 'var(--accent)' : '' },
            onClick: () => { this.filterCategory = ''; updateCatButtons(''); this.reloadAndRefresh(); }
        }));

        for (const cat of Media.CATEGORIES) {
            catFilters.appendChild(DOM.create('button', {
                className: `filter-cat-btn ${this.filterCategory === cat.id ? 'active' : ''}`,
                textContent: cat.emoji,
                dataset: { catId: cat.id },
                style: { color: this.filterCategory === cat.id ? cat.color : '' },
                onClick: () => { this.filterCategory = cat.id; updateCatButtons(cat.id); this.reloadAndRefresh(); }
            }));
        }
        filters.appendChild(catFilters);

        return filters;
    },

    buildQuestionsList() {
        const list = DOM.create('div', { className: 'questions-list' });

        // Filtering & sorting is done server-side, just use this.questions directly
        const filtered = this.questions;

        if (filtered.length === 0) {
            list.appendChild(DOM.create('div', { className: 'empty-state' }, [
                DOM.create('div', { className: 'empty-state-icon', textContent: '📭' }),
                DOM.create('div', { className: 'empty-state-text', textContent: 'Aucune question trouvée' })
            ]));
            return list;
        }

        for (const q of filtered) {
            const cat = Media.getCategoryById(q.category);
            const card = DOM.create('div', {
                className: 'question-card',
                style: { borderLeftColor: cat.color },
                onClick: () => this.editQuestion(q)
            });

            const body = DOM.create('div', { className: 'question-card-body' });

            // Header: badge + media badges
            const header = DOM.create('div', { className: 'question-card-header' });
            header.appendChild(DOM.create('span', {
                className: `badge badge-${q.category}`,
                textContent: `${cat.emoji} ${cat.label}`,
                style: { fontSize: '0.7rem', padding: '2px 8px' }
            }));

            // Media badges
            const badges = DOM.create('div', { className: 'media-badges' });
            if (q.question.image) badges.appendChild(DOM.create('span', { className: 'media-badge', textContent: '📸' }));
            if (q.question.audio) badges.appendChild(DOM.create('span', { className: 'media-badge', textContent: '🎵' }));
            if (q.answer.image) badges.appendChild(DOM.create('span', { className: 'media-badge', textContent: '🖼️' }));
            if (q.answer.audio) badges.appendChild(DOM.create('span', { className: 'media-badge', textContent: '🎶' }));
            if (q.question.youtube || q.answer.youtube) badges.appendChild(DOM.create('span', { className: 'media-badge', textContent: '📺' }));
            header.appendChild(badges);
            body.appendChild(header);

            // Question text
            body.appendChild(DOM.create('div', {
                className: 'question-card-text',
                textContent: q.question.text
            }));

            // Answer text
            body.appendChild(DOM.create('div', {
                className: 'question-card-answer',
                textContent: `→ ${q.answer.text}`
            }));

            card.appendChild(body);

            // Actions
            const actions = DOM.create('div', { className: 'question-card-actions' });
            actions.appendChild(DOM.create('button', {
                className: 'btn btn-sm btn-ghost',
                textContent: '✏️',
                onClick: (e) => { e.stopPropagation(); this.editQuestion(q); }
            }));
            actions.appendChild(DOM.create('button', {
                className: 'btn btn-sm btn-ghost',
                textContent: '🗑️',
                onClick: (e) => { e.stopPropagation(); this.deleteQuestion(q); }
            }));
            card.appendChild(actions);

            list.appendChild(card);
        }

        return list;
    },

    editQuestion(q) {
        EditorCreate.loadForEdit(q);
        App.pages.editor.activeTab = 'create';
        EditorCreate.refresh();
    },

    async deleteQuestion(q) {
        const confirmed = await DOM.confirm(`Supprimer la question "${q.question.text.substring(0, 50)}..." ?`);
        if (!confirmed) return;

        try {
            await API.delete(`/api/questions/${q.id}`);
            DOM.toast('Question supprimée.', 'success');
            this.needsRefresh = true;
            EditorCreate.refresh();
        } catch (err) {
            DOM.toast(`Erreur : ${err.message}`, 'error');
        }
    },

    buildActionsBar() {
        const bar = DOM.create('div', { className: 'manage-actions-bar' });

        // Import/Export buttons (from ImportExport module)
        const ieSection = ImportExport.buildSection();
        // ImportExport.buildSection returns a manage-actions-bar div with buttons;
        // we merge its children into our bar
        while (ieSection.firstChild) {
            bar.appendChild(ieSection.firstChild);
        }

        // Spacer
        bar.appendChild(DOM.create('div', { className: 'actions-bar-spacer' }));

        // Delete all
        bar.appendChild(DOM.create('button', {
            className: 'btn btn-danger delete-all-btn',
            textContent: '🗑️ Tout supprimer',
            onClick: () => this.deleteAll()
        }));

        return bar;
    },

    async deleteAll() {
        const total = this.stats ? this.stats.total : 0;
        if (total === 0) {
            DOM.toast('Aucune question à supprimer.', 'info');
            return;
        }
        const confirmed = await DOM.confirm(
            `Supprimer les ${total} questions et tous les médias associés ?\n\nCette action est irréversible.`
        );
        if (!confirmed) return;

        try {
            await API.delete('/api/questions/all');
            DOM.toast('Toutes les questions ont été supprimées.', 'success');
            this.needsRefresh = true;
            EditorCreate.refresh();
        } catch (err) {
            DOM.toast(`Erreur : ${err.message}`, 'error');
        }
    },

    async reloadAndRefresh() {
        // Reload data from API (with current filters/sort) then re-render list + stats
        await this.loadData();
        this.refreshList();
        this.refreshStats();
    },

    refreshList() {
        // Re-render just the list part
        const list = DOM.$('.questions-list');
        if (list) {
            const parent = list.parentElement;
            const newList = this.buildQuestionsList();
            parent.replaceChild(newList, list);
        }
    },

    refreshStats() {
        // Re-render just the stats part
        const stats = DOM.$('.manage-stats');
        if (stats) {
            const parent = stats.parentElement;
            const newStats = this.buildStats();
            parent.replaceChild(newStats, stats);
        }
    }
};
