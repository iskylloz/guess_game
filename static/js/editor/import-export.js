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

        // Import
        const fileInput = DOM.create('input', {
            type: 'file',
            accept: '.json,.zip',
            style: { display: 'none' }
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) this.showImportModal(e.target.files[0]);
        });
        section.appendChild(DOM.create('button', {
            className: 'btn btn-outline',
            textContent: '📂 Importer',
            onClick: () => fileInput.click()
        }));
        section.appendChild(fileInput);

        return section;
    },

    async doExport() {
        try {
            DOM.toast('Sélectionnez un emplacement...', 'info');
            const result = await API.post('/api/export');
            if (result.cancelled) {
                DOM.toast('Export annulé.', 'info');
                return;
            }
            DOM.toast('Export terminé !', 'success');
        } catch (err) {
            DOM.toast(`Erreur d'export : ${err.message}`, 'error');
        }
    },

    showImportModal(file) {
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
            const radio = DOM.create('input', {
                type: 'radio',
                name: 'import-mode',
                value: mode.id
            });
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
                DOM.create('h3', { textContent: `📂 Importer : ${file.name}` }),
                DOM.create('button', {
                    className: 'modal-close',
                    textContent: '×',
                    onClick: () => DOM.hideModal()
                })
            ]),
            DOM.create('div', { className: 'modal-body' }, [
                DOM.create('p', {
                    textContent: 'Choisissez le mode d\'import :',
                    style: { marginBottom: 'var(--spacing-md)' }
                }),
                modeList
            ]),
            DOM.create('div', { className: 'modal-footer' }, [
                DOM.create('button', {
                    className: 'btn btn-outline',
                    textContent: 'Annuler',
                    onClick: () => DOM.hideModal()
                }),
                DOM.create('button', {
                    className: 'btn btn-success',
                    textContent: 'Importer',
                    onClick: () => {
                        DOM.hideModal();
                        this.doImport(file, selectedMode);
                    }
                })
            ])
        ]);

        DOM.showModal(modal);
    },

    async doImport(file, mode) {
        if (mode === 'replace') {
            const confirmed = await DOM.confirm(
                '⚠️ ATTENTION : Toutes les questions existantes seront supprimées et remplacées. Cette action est irréversible !'
            );
            if (!confirmed) return;
        }

        try {
            DOM.toast('Import en cours...', 'info');
            const formData = new FormData();
            formData.append('file', file);
            formData.append('mode', mode);
            const result = await API.postFormData('/api/import', formData);

            if (result.duplicates && result.duplicates.length > 0) {
                this.showDuplicatesModal(result);
            } else {
                this.showReport(result, mode);
            }
            EditorManage.needsRefresh = true;
            EditorCreate.refresh();
        } catch (err) {
            DOM.toast(`Erreur d'import : ${err.message}`, 'error');
        }
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
                if (selected.size > 0) {
                    const toImport = duplicates.filter((_, i) => selected.has(i)).map(d => d.imported);
                    try {
                        DOM.toast('Import des doublons sélectionnés...', 'info');
                        const forceResult = await API.post('/api/import/force', { questions: toImport });
                        DOM.toast(`${forceResult.added} question${forceResult.added > 1 ? 's' : ''} supplémentaire${forceResult.added > 1 ? 's' : ''} ajoutée${forceResult.added > 1 ? 's' : ''} !`, 'success');
                        EditorManage.needsRefresh = true;
                        EditorCreate.refresh();
                    } catch (err) {
                        DOM.toast(`Erreur : ${err.message}`, 'error');
                    }
                } else {
                    DOM.toast(`Import terminé ! ${result.added} ajoutée${result.added > 1 ? 's' : ''}, ${duplicates.length} ignoré${duplicates.length > 1 ? 's' : ''}.`, 'success');
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
