/**
 * Import/Export — Export ZIP, Import with 3 modes.
 */
const ImportExport = {
    buildSection() {
        const section = DOM.create('div', { className: 'manage-actions-bar' });

        // Export
        section.appendChild(DOM.create('button', {
            className: 'btn btn-primary',
            textContent: '💾 Exporter (ZIP)',
            onClick: () => this.doExport()
        }));

        // Import — native file dialog via backend (no upload, no size limit)
        section.appendChild(DOM.create('button', {
            className: 'btn btn-outline',
            textContent: '📂 Importer',
            onClick: () => this.showModeModal()
        }));

        return section;
    },

    async doExport() {
        let pickResult;
        try {
            DOM.toast('Sélectionnez un emplacement…', 'info', 2000);
            pickResult = await API.post('/api/export/pick', {});
        } catch (err) {
            DOM.toast(`Erreur d'export : ${err.message}`, 'error');
            return;
        }
        if (pickResult.cancelled) {
            DOM.toast('Export annulé.', 'info');
            return;
        }
        const fileName = pickResult.path.split(/[/\\]/).pop();
        this.showJobProgressModal({
            jobId: pickResult.job_id,
            progressUrl: '/api/export/progress/',
            title: '💾 Export en cours…',
            fileInfo: fileName,
            unit: 'médias',
            onDone: () => DOM.toast(`Export terminé ! → ${fileName}`, 'success'),
            onError: (msg) => DOM.toast(`Erreur d'export : ${msg}`, 'error')
        });
    },

    /**
     * Generic progress modal for background jobs (import / export / optimize).
     * Polls `${progressUrl}${jobId}` every 600ms. Transient fetch errors are
     * retried; after MAX_POLL_FAILURES consecutive failures the job is abandoned.
     */
    MAX_POLL_FAILURES: 10,
    POLL_INTERVAL: 600,

    showJobProgressModal({ jobId, progressUrl, title, fileInfo = '', unit = '', onDone, onError }) {
        const barFill = DOM.create('div', { className: 'import-bar-fill' });
        const barWrap = DOM.create('div', { className: 'import-bar-wrap' }, [barFill]);
        const stepText = DOM.create('div', { className: 'import-step-text', textContent: 'Initialisation…' });
        const countText = DOM.create('div', { className: 'import-count-text', textContent: '' });

        const bodyChildren = [];
        if (fileInfo) bodyChildren.push(DOM.create('div', { className: 'import-file-info', textContent: fileInfo }));
        bodyChildren.push(barWrap, stepText, countText);

        const modal = DOM.create('div', { className: 'modal import-progress-modal', style: { width: '500px', padding: '0' } }, [
            DOM.create('div', { className: 'modal-header' }, [DOM.create('h3', { textContent: title })]),
            DOM.create('div', { className: 'modal-body' }, bodyChildren)
        ]);
        DOM.showModal(modal);

        let failures = 0;
        const poll = async () => {
            let job;
            try {
                job = await API.get(`${progressUrl}${jobId}`);
                failures = 0;
            } catch (err) {
                failures++;
                if (failures >= this.MAX_POLL_FAILURES) {
                    DOM.hideModal();
                    if (onError) onError(`connexion perdue (${err.message})`);
                    return;
                }
                setTimeout(poll, this.POLL_INTERVAL);
                return;
            }

            barFill.style.width = `${job.progress || 0}%`;
            stepText.textContent = job.step || '';
            if (job.total > 0) {
                countText.textContent = `${job.processed || 0} / ${job.total}${unit ? ' ' + unit : ''}`;
            }

            if (job.status === 'running') {
                setTimeout(poll, this.POLL_INTERVAL);
                return;
            }

            DOM.hideModal();
            if (job.status === 'error') {
                if (onError) onError(job.error || 'erreur inconnue');
            } else if (onDone) {
                onDone(job.result, job);
            }
        };
        setTimeout(poll, this.POLL_INTERVAL);
    },

    /** One-off in-place downscale of every stored image (see /api/media/optimize). */
    async doOptimizeImages() {
        const confirmed = await DOM.confirm(
            'Les images trop grandes (côté > 2560 px) seront réduites sur place pour éviter les ' +
            'ralentissements en jeu. Les PNG restent sans perte, les JPEG sont ré-encodés en haute ' +
            'qualité. Cette opération est irréversible : exportez un ZIP de sauvegarde avant si besoin.',
            '🖼️ Optimiser les images'
        );
        if (!confirmed) return;

        let jobData;
        try {
            jobData = await API.post('/api/media/optimize', {});
        } catch (err) {
            DOM.toast(`Erreur : ${err.message}`, 'error');
            return;
        }

        this.showJobProgressModal({
            jobId: jobData.job_id,
            progressUrl: '/api/media/optimize/progress/',
            title: '🖼️ Optimisation des images…',
            unit: 'images',
            onDone: (result) => {
                const savedMB = ((result.saved_bytes || 0) / (1024 * 1024)).toFixed(1);
                DOM.toast(
                    `${result.total} image${result.total > 1 ? 's' : ''} analysée${result.total > 1 ? 's' : ''}, ` +
                    `${result.resized} réduite${result.resized > 1 ? 's' : ''}, ${savedMB} MB libérés.`,
                    'success', 6000
                );
            },
            onError: (msg) => DOM.toast(`Erreur d'optimisation : ${msg}`, 'error')
        });
    },

    showModeModal() {
        let selectedMode = 'smart_merge';

        const modes = [
            {
                id: 'smart_merge',
                label: '🧠 Fusion Intelligente (Recommandé)',
                desc: 'Ajoute les nouvelles questions, détecte les doublons et vous laisse choisir.'
            },
            {
                id: 'full_merge',
                label: '➕ Fusion Complète',
                desc: 'Ajoute toutes les questions importées. Peut créer des doublons.'
            },
            {
                id: 'replace',
                label: '🔄 Remplacement Total',
                desc: '⚠️ Supprime TOUTES les questions existantes et les remplace par l\'import.'
            }
        ];

        const modeList = DOM.create('div', { className: 'import-modes' });
        for (const mode of modes) {
            const option = DOM.create('label', { className: 'import-mode-option' });
            const radio = DOM.create('input', { type: 'radio', name: 'import-mode', value: mode.id });
            if (mode.id === 'smart_merge') radio.checked = true;
            radio.addEventListener('change', () => { selectedMode = mode.id; });
            option.appendChild(radio);
            option.appendChild(DOM.create('div', {}, [
                DOM.create('div', { className: 'import-mode-label', textContent: mode.label }),
                DOM.create('div', { className: 'import-mode-desc', textContent: mode.desc })
            ]));
            modeList.appendChild(option);
        }

        const modal = DOM.create('div', { className: 'modal', style: { width: '550px', padding: '0' } }, [
            DOM.create('div', { className: 'modal-header' }, [
                DOM.create('h3', { textContent: '📂 Importer des questions' }),
                DOM.create('button', { className: 'modal-close', textContent: '×', onClick: () => DOM.hideModal() })
            ]),
            DOM.create('div', { className: 'modal-body' }, [
                DOM.create('p', { textContent: 'Choisissez le mode d\'import :', style: { marginBottom: 'var(--spacing-md)' } }),
                modeList
            ]),
            DOM.create('div', { className: 'modal-footer' }, [
                DOM.create('button', { className: 'btn btn-outline', textContent: 'Annuler', onClick: () => DOM.hideModal() }),
                DOM.create('button', {
                    className: 'btn btn-success',
                    textContent: 'Choisir un fichier…',
                    onClick: async () => {
                        DOM.hideModal();
                        await this.doImport(selectedMode);
                    }
                })
            ])
        ]);

        DOM.showModal(modal);
    },

    async doImport(mode) {
        // Confirm destructive mode before opening file dialog
        if (mode === 'replace') {
            const confirmed = await DOM.confirm(
                '⚠️ ATTENTION : Toutes les questions existantes seront supprimées et remplacées. Cette action est irréversible !'
            );
            if (!confirmed) return;
        }

        // Open native file dialog via backend (no upload, no size limit)
        let fileInfo;
        try {
            DOM.toast('Ouverture du sélecteur de fichier…', 'info', 2000);
            fileInfo = await API.post('/api/import/pick', {});
        } catch (err) {
            DOM.toast(`Erreur : ${err.message}`, 'error');
            return;
        }
        if (fileInfo.cancelled) return;

        // Start background import job
        let jobData;
        try {
            jobData = await API.post('/api/import/start', { path: fileInfo.path, mode });
        } catch (err) {
            DOM.toast(`Erreur de démarrage : ${err.message}`, 'error');
            return;
        }

        this.showProgressModal(jobData.job_id, fileInfo.name, fileInfo.size, mode);
    },

    showProgressModal(jobId, fileName, fileSize, mode) {
        const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
        this.showJobProgressModal({
            jobId,
            progressUrl: '/api/import/progress/',
            title: '📂 Import en cours…',
            fileInfo: `${fileName} — ${sizeMB} MB`,
            unit: 'questions',
            onDone: (result) => {
                EditorManage.needsRefresh = true;
                EditorCreate.refresh();
                if (result.duplicates && result.duplicates.length > 0) {
                    this.showDuplicatesModal(result);
                } else {
                    this.showReport(result, mode);
                }
            },
            onError: (msg) => DOM.toast(`Erreur d'import : ${msg}`, 'error', 6000)
        });
    },

    showDuplicatesModal(result) {
        const duplicates = result.duplicates;
        const selected = new Set();

        const modal = DOM.create('div', { className: 'modal duplicates-modal', style: { padding: '0' } });

        // Header
        modal.appendChild(DOM.create('div', { className: 'modal-header' }, [
            DOM.create('h3', { textContent: '🧠 Doublons détectés' }),
            DOM.create('button', {
                className: 'modal-close',
                textContent: '×',
                onClick: () => DOM.hideModal()
            })
        ]));

        // Summary
        const summary = DOM.create('div', { className: 'duplicates-summary' }, [
            DOM.create('span', { textContent: `✅ ${result.added} question${result.added > 1 ? 's' : ''} ajoutée${result.added > 1 ? 's' : ''}` }),
            DOM.create('span', { textContent: `⚠️ ${duplicates.length} doublon${duplicates.length > 1 ? 's' : ''} détecté${duplicates.length > 1 ? 's' : ''}` })
        ]);
        modal.appendChild(summary);

        // Select all row
        const selectAllRow = DOM.create('div', { className: 'duplicates-select-all' });
        const selectAllCb = DOM.create('input', { type: 'checkbox' });
        selectAllCb.addEventListener('change', () => {
            const checked = selectAllCb.checked;
            modal.querySelectorAll('.duplicate-item input[type="checkbox"]').forEach((cb, i) => {
                cb.checked = checked;
                if (checked) selected.add(i);
                else selected.delete(i);
            });
            updateFooter();
        });
        selectAllRow.appendChild(selectAllCb);
        selectAllRow.appendChild(DOM.create('span', { textContent: 'Tout sélectionner' }));
        modal.appendChild(selectAllRow);

        // Duplicates list
        const list = DOM.create('div', { className: 'duplicates-list' });

        duplicates.forEach((dup, idx) => {
            const item = DOM.create('div', { className: 'duplicate-item' });

            const cb = DOM.create('input', { type: 'checkbox' });
            cb.addEventListener('change', () => {
                if (cb.checked) selected.add(idx);
                else selected.delete(idx);
                selectAllCb.checked = selected.size === duplicates.length;
                updateFooter();
            });

            const info = DOM.create('div', { className: 'duplicate-info' });
            const imported = dup.imported;
            const match = dup.match;
            const cat = Media.getCategoryById(imported.category || 'blue');

            // Imported question
            info.appendChild(DOM.create('div', { className: 'duplicate-imported' }, [
                DOM.create('span', { className: `badge badge-${imported.category || 'blue'}`, textContent: cat.emoji }),
                DOM.create('span', { className: 'duplicate-answer', textContent: imported.answer?.text || '(sans réponse)' })
            ]));

            // Match info
            const matchCat = Media.getCategoryById(match.category || 'blue');
            info.appendChild(DOM.create('div', { className: 'duplicate-match' }, [
                DOM.create('span', { className: 'duplicate-match-label', textContent: `↳ similaire à ${dup.similarity}% :` }),
                DOM.create('span', { textContent: match.answer?.text || '' })
            ]));

            item.appendChild(cb);
            item.appendChild(info);
            list.appendChild(item);
        });

        modal.appendChild(list);

        // Footer
        const footerLabel = DOM.create('span', { className: 'duplicates-footer-label', textContent: 'Ignorer tous les doublons' });
        const importBtn = DOM.create('button', {
            className: 'btn btn-primary',
            textContent: 'Confirmer',
            onClick: async () => {
                DOM.hideModal();
                const toImport = duplicates.filter((_, i) => selected.has(i)).map(d => d.imported);
                // Media extracted for duplicates we don't keep is now orphaned — let the
                // backend delete it (it keeps anything still referenced by a question).
                const discard = [];
                duplicates.forEach((d, i) => {
                    if (selected.has(i)) return;
                    for (const side of ['question', 'answer']) {
                        const m = d.imported[side] || {};
                        if (m.image) discard.push(m.image);
                        if (m.audio) discard.push(m.audio);
                    }
                });
                try {
                    if (toImport.length > 0) DOM.toast('Import des doublons sélectionnés...', 'info');
                    const forceResult = await API.post('/api/import/force', { questions: toImport, discard });
                    if (toImport.length > 0) {
                        DOM.toast(`${forceResult.added} question${forceResult.added > 1 ? 's' : ''} supplémentaire${forceResult.added > 1 ? 's' : ''} ajoutée${forceResult.added > 1 ? 's' : ''} !`, 'success');
                        EditorManage.needsRefresh = true;
                        EditorCreate.refresh();
                    } else {
                        DOM.toast(`Import terminé ! ${result.added} ajoutée${result.added > 1 ? 's' : ''}, ${duplicates.length} ignoré${duplicates.length > 1 ? 's' : ''}.`, 'success');
                    }
                } catch (err) {
                    DOM.toast(`Erreur : ${err.message}`, 'error');
                }
            }
        });

        const updateFooter = () => {
            if (selected.size === 0) {
                footerLabel.textContent = 'Ignorer tous les doublons';
            } else if (selected.size === duplicates.length) {
                footerLabel.textContent = `Importer tous les doublons (${selected.size})`;
            } else {
                footerLabel.textContent = `Importer ${selected.size} doublon${selected.size > 1 ? 's' : ''}, ignorer ${duplicates.length - selected.size}`;
            }
        };

        modal.appendChild(DOM.create('div', { className: 'modal-footer' }, [
            footerLabel,
            DOM.create('button', {
                className: 'btn btn-outline',
                textContent: 'Annuler',
                onClick: () => DOM.hideModal()
            }),
            importBtn
        ]));

        DOM.showModal(modal);
    },

    showReport(result, mode) {
        const modeLabels = {
            'smart_merge': 'Fusion Intelligente',
            'full_merge': 'Fusion Complète',
            'replace': 'Remplacement Total'
        };

        const lines = [`✅ ${modeLabels[mode]} terminée !`];
        if (result.added !== undefined) lines.push(`✅ ${result.added} nouvelles ajoutées`);
        if (result.skipped) lines.push(`⚠️ ${result.skipped} doublons ignorés`);
        if (result.errors) {
            lines.push(`❌ ${result.errors} entrée${result.errors > 1 ? 's' : ''} invalide${result.errors > 1 ? 's' : ''} ignorée${result.errors > 1 ? 's' : ''}`);
            for (const sample of (result.error_samples || [])) lines.push(`   · ${sample}`);
        }
        lines.push(`📊 ${result.total} total`);
        if (mode !== 'replace') lines.push('💡 ID régénérés');

        const modal = DOM.create('div', { className: 'modal', style: { width: '450px', padding: '0' } }, [
            DOM.create('div', { className: 'modal-body' }, [
                DOM.create('div', { className: 'import-report' }, [
                    ...lines.map(line => DOM.create('div', {
                        textContent: line,
                        style: { padding: '4px 0' }
                    }))
                ])
            ]),
            DOM.create('div', { className: 'modal-footer' }, [
                DOM.create('button', {
                    className: 'btn btn-primary',
                    textContent: 'OK',
                    onClick: () => DOM.hideModal()
                })
            ])
        ]);

        DOM.showModal(modal);
    }
};
