/**
 * Image Editor — Canvas-based image editing with draw, text, blur, crop, resize, filters.
 */
const ImageEditor = {
    canvas: null,
    ctx: null,
    originalImage: null,
    undoStack: [],
    currentTool: 'draw',
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    onSave: null,
    selectionStart: null,
    selectionEnd: null,
    isSelecting: false,

    // Tool settings
    settings: {
        drawColor: '#ff0000',
        drawSize: 4,
        textColor: '#ffffff',
        textSize: 24,
        brightness: 100,
        contrast: 100
    },

    open(imageSrc, onSave) {
        this.onSave = onSave;
        this.undoStack = [];
        this.currentTool = 'draw';
        this.isDrawing = false;
        this.isSelecting = false;

        // Load the image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.originalImage = img;
            this.initCanvas(img.width, img.height);
            this.ctx.drawImage(img, 0, 0);
            this.showModal();
        };
        img.onerror = () => DOM.toast('Erreur de chargement de l\'image.', 'error');
        img.src = imageSrc;
    },

    initCanvas(width, height) {
        // Limit to 4096x4096
        const maxSize = 4096;
        if (width > maxSize) { height = height * (maxSize / width); width = maxSize; }
        if (height > maxSize) { width = width * (maxSize / height); height = maxSize; }

        this.canvas = document.createElement('canvas');
        this.canvas.width = Math.round(width);
        this.canvas.height = Math.round(height);
        this.ctx = this.canvas.getContext('2d');
    },

    pushUndo() {
        if (this.undoStack.length >= 10) this.undoStack.shift();
        this.undoStack.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
    },

    undo() {
        if (this.undoStack.length > 0) {
            const data = this.undoStack.pop();
            this.canvas.width = data.width;
            this.canvas.height = data.height;
            this.ctx.putImageData(data, 0, 0);
        } else {
            DOM.toast('Aucune action à annuler.', 'info');
        }
    },

    reset() {
        if (this.originalImage) {
            this.canvas.width = this.originalImage.width;
            this.canvas.height = this.originalImage.height;
            this.ctx.drawImage(this.originalImage, 0, 0);
            this.undoStack = [];
        }
    },

    showModal() {
        const modal = DOM.create('div', { className: 'modal image-editor-modal' });

        // Header
        const header = DOM.create('div', { className: 'modal-header' });
        header.appendChild(DOM.create('h3', { textContent: '✏️ Éditeur d\'image' }));
        header.appendChild(DOM.create('button', {
            className: 'modal-close',
            textContent: '×',
            onClick: () => DOM.hideModal()
        }));
        modal.appendChild(header);

        // Toolbar
        modal.appendChild(this.buildToolbar());

        // Body: sidebar + canvas
        const body = DOM.create('div', { className: 'image-editor-body' });
        body.appendChild(this.buildSidebar());

        const canvasArea = DOM.create('div', { className: 'image-editor-canvas-area' });
        const canvasWrapper = DOM.create('div', { className: 'canvas-wrapper' });
        canvasWrapper.appendChild(this.canvas);
        this._selectionOverlay = DOM.create('div', { className: 'selection-overlay' });
        this._selectionOverlay.style.display = 'none';
        canvasWrapper.appendChild(this._selectionOverlay);
        canvasArea.appendChild(canvasWrapper);
        this.setupCanvasEvents(this.canvas);
        body.appendChild(canvasArea);

        modal.appendChild(body);

        // Footer
        const footer = DOM.create('div', { className: 'image-editor-footer' });
        footer.appendChild(DOM.create('button', {
            className: 'btn btn-outline',
            textContent: '❌ Annuler',
            onClick: () => DOM.hideModal()
        }));
        footer.appendChild(DOM.create('button', {
            className: 'btn btn-success',
            textContent: '💾 Sauvegarder',
            onClick: () => this.save()
        }));
        modal.appendChild(footer);

        DOM.showModal(modal);
    },

    buildToolbar() {
        const toolbar = DOM.create('div', { className: 'image-editor-toolbar' });

        // Drawing tools
        const toolGroup = DOM.create('div', { className: 'tool-group' });
        const tools = [
            { id: 'draw', label: '✏️ Dessiner' },
            { id: 'text', label: '📝 Texte' },
            { id: 'blur', label: '🌫️ Flouter' },
            { id: 'crop', label: '✂️ Rogner' }
        ];
        for (const tool of tools) {
            toolGroup.appendChild(DOM.create('button', {
                className: `tool-btn ${this.currentTool === tool.id ? 'active' : ''}`,
                textContent: tool.label,
                onClick: () => { this.currentTool = tool.id; this.refreshToolbar(toolbar); }
            }));
        }
        toolbar.appendChild(toolGroup);

        // Filters
        const filterGroup = DOM.create('div', { className: 'tool-group' });
        const filters = [
            { id: 'grayscale', label: '⚫ N&B' },
            { id: 'sepia', label: '🟤 Sépia' },
            { id: 'invert', label: '🔄 Inverser' }
        ];
        for (const f of filters) {
            filterGroup.appendChild(DOM.create('button', {
                className: 'tool-btn',
                textContent: f.label,
                onClick: () => this.applyFilter(f.id)
            }));
        }
        toolbar.appendChild(filterGroup);

        // Actions
        const actionGroup = DOM.create('div', { className: 'tool-group' });
        actionGroup.appendChild(DOM.create('button', {
            className: 'tool-btn',
            textContent: '🔗 Import URL',
            onClick: () => this.importFromUrl()
        }));
        actionGroup.appendChild(DOM.create('button', {
            className: 'tool-btn',
            textContent: '↩️ Annuler',
            onClick: () => this.undo()
        }));
        actionGroup.appendChild(DOM.create('button', {
            className: 'tool-btn',
            textContent: '🔄 Réinitialiser',
            onClick: () => this.reset()
        }));
        toolbar.appendChild(actionGroup);

        return toolbar;
    },

    refreshToolbar(toolbar) {
        const parent = toolbar.parentElement;
        const newToolbar = this.buildToolbar();
        parent.replaceChild(newToolbar, toolbar);

        // Refresh sidebar too
        const sidebar = parent.querySelector('.image-editor-sidebar');
        if (sidebar) {
            const newSidebar = this.buildSidebar();
            sidebar.parentElement.replaceChild(newSidebar, sidebar);
        }
    },

    buildSidebar() {
        const sidebar = DOM.create('div', { className: 'image-editor-sidebar' });

        if (this.currentTool === 'draw') {
            sidebar.appendChild(DOM.create('label', { className: 'label', textContent: 'Couleur' }));
            const colorInput = DOM.create('input', {
                type: 'color',
                value: this.settings.drawColor,
                style: { width: '100%', height: '40px', cursor: 'pointer' }
            });
            colorInput.addEventListener('input', (e) => { this.settings.drawColor = e.target.value; });
            sidebar.appendChild(colorInput);

            sidebar.appendChild(DOM.create('label', { className: 'label mt-md', textContent: `Épaisseur: ${this.settings.drawSize}px` }));
            const sizeInput = DOM.create('input', {
                className: 'range',
                type: 'range',
                min: '1',
                max: '20',
                value: this.settings.drawSize.toString()
            });
            sizeInput.addEventListener('input', (e) => {
                this.settings.drawSize = parseInt(e.target.value);
                sidebar.querySelector('.label + .label').textContent = `Épaisseur: ${this.settings.drawSize}px`;
            });
            sidebar.appendChild(sizeInput);
        }

        if (this.currentTool === 'text') {
            sidebar.appendChild(DOM.create('label', { className: 'label', textContent: 'Couleur du texte' }));
            const colorInput = DOM.create('input', {
                type: 'color',
                value: this.settings.textColor,
                style: { width: '100%', height: '40px', cursor: 'pointer' }
            });
            colorInput.addEventListener('input', (e) => { this.settings.textColor = e.target.value; });
            sidebar.appendChild(colorInput);

            sidebar.appendChild(DOM.create('label', { className: 'label mt-md', textContent: `Taille: ${this.settings.textSize}px` }));
            const sizeInput = DOM.create('input', {
                className: 'range',
                type: 'range',
                min: '12',
                max: '72',
                value: this.settings.textSize.toString()
            });
            sizeInput.addEventListener('input', (e) => { this.settings.textSize = parseInt(e.target.value); });
            sidebar.appendChild(sizeInput);

            sidebar.appendChild(DOM.create('p', {
                className: 'text-muted text-sm mt-md',
                textContent: 'Cliquez sur l\'image pour placer du texte.'
            }));
        }

        if (this.currentTool === 'blur') {
            sidebar.appendChild(DOM.create('p', {
                className: 'text-muted text-sm',
                textContent: 'Dessinez un rectangle sur la zone à flouter.'
            }));
        }

        if (this.currentTool === 'crop') {
            sidebar.appendChild(DOM.create('p', {
                className: 'text-muted text-sm',
                textContent: 'Dessinez un rectangle pour rogner l\'image.'
            }));
            if (this.selectionStart && this.selectionEnd) {
                sidebar.appendChild(DOM.create('button', {
                    className: 'btn btn-success btn-sm mt-md w-full',
                    textContent: '✂️ Appliquer le rognage',
                    onClick: () => this.applyCrop()
                }));
            }
        }

        // Brightness & Contrast
        sidebar.appendChild(DOM.create('hr', { style: { margin: '16px 0', opacity: '0.2' } }));
        sidebar.appendChild(DOM.create('label', { className: 'label', textContent: `☀️ Luminosité: ${this.settings.brightness}%` }));
        const brightSlider = DOM.create('input', {
            className: 'range',
            type: 'range',
            min: '20',
            max: '200',
            value: this.settings.brightness.toString()
        });
        brightSlider.addEventListener('change', (e) => {
            this.settings.brightness = parseInt(e.target.value);
            this.applyBrightnessContrast();
        });
        sidebar.appendChild(brightSlider);

        sidebar.appendChild(DOM.create('label', { className: 'label mt-sm', textContent: `🔆 Contraste: ${this.settings.contrast}%` }));
        const contrastSlider = DOM.create('input', {
            className: 'range',
            type: 'range',
            min: '20',
            max: '200',
            value: this.settings.contrast.toString()
        });
        contrastSlider.addEventListener('change', (e) => {
            this.settings.contrast = parseInt(e.target.value);
            this.applyBrightnessContrast();
        });
        sidebar.appendChild(contrastSlider);

        return sidebar;
    },

    setupCanvasEvents(canvas) {
        canvas.style.cursor = this.currentTool === 'draw' ? 'crosshair' : 'default';

        canvas.onmousedown = (e) => this.onMouseDown(e);
        canvas.onmousemove = (e) => this.onMouseMove(e);
        canvas.onmouseup = (e) => this.onMouseUp(e);
        canvas.onmouseleave = (e) => this.onMouseUp(e);
    },

    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    },

    onMouseDown(e) {
        const { x, y } = this.getCanvasCoords(e);

        if (this.currentTool === 'draw') {
            this.pushUndo();
            this.isDrawing = true;
            this.lastX = x;
            this.lastY = y;
            this.ctx.strokeStyle = this.settings.drawColor;
            this.ctx.lineWidth = this.settings.drawSize;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
        }

        if (this.currentTool === 'text') {
            this.placeText(x, y);
        }

        if (this.currentTool === 'blur' || this.currentTool === 'crop') {
            this.isSelecting = true;
            this.selectionStart = { x, y };
            this.selectionEnd = { x, y };
        }
    },

    onMouseMove(e) {
        const { x, y } = this.getCanvasCoords(e);

        if (this.currentTool === 'draw' && this.isDrawing) {
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            this.lastX = x;
            this.lastY = y;
        }

        if ((this.currentTool === 'blur' || this.currentTool === 'crop') && this.isSelecting) {
            this.selectionEnd = { x, y };
            // Draw selection rectangle overlay (temporary)
            this.drawSelectionOverlay();
        }
    },

    onMouseUp(e) {
        if (this.currentTool === 'draw' && this.isDrawing) {
            this.isDrawing = false;
        }

        if (this.currentTool === 'blur' && this.isSelecting) {
            this.isSelecting = false;
            this.applyBlur();
        }

        if (this.currentTool === 'crop' && this.isSelecting) {
            this.isSelecting = false;
            // Keep selection for "Apply crop" button
            const sidebar = document.querySelector('.image-editor-sidebar');
            if (sidebar) {
                const parent = sidebar.parentElement;
                const newSidebar = this.buildSidebar();
                parent.replaceChild(newSidebar, sidebar);
            }
        }
    },

    drawSelectionOverlay() {
        if (!this._selectionOverlay || !this.selectionStart || !this.selectionEnd) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / this.canvas.width;
        const scaleY = rect.height / this.canvas.height;

        const s = this.selectionStart;
        const end = this.selectionEnd;
        const x = Math.min(s.x, end.x) * scaleX;
        const y = Math.min(s.y, end.y) * scaleY;
        const w = Math.abs(end.x - s.x) * scaleX;
        const h = Math.abs(end.y - s.y) * scaleY;

        Object.assign(this._selectionOverlay.style, {
            display: 'block',
            left: x + 'px',
            top: y + 'px',
            width: w + 'px',
            height: h + 'px'
        });
    },

    hideSelectionOverlay() {
        if (this._selectionOverlay) this._selectionOverlay.style.display = 'none';
    },

    placeText(x, y) {
        const text = prompt('Texte à ajouter :');
        if (!text) return;

        this.pushUndo();
        this.ctx.font = `${this.settings.textSize}px 'Segoe UI', sans-serif`;
        this.ctx.fillStyle = this.settings.textColor;
        this.ctx.fillText(text, x, y);
    },

    applyBlur() {
        if (!this.selectionStart || !this.selectionEnd) return;

        const s = this.selectionStart;
        const end = this.selectionEnd;
        const x = Math.min(s.x, end.x);
        const y = Math.min(s.y, end.y);
        const w = Math.abs(end.x - s.x);
        const h = Math.abs(end.y - s.y);

        if (w < 5 || h < 5) return;

        this.hideSelectionOverlay();
        this.pushUndo();

        // Use canvas filter for blur
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');

        // Copy region (canvas is clean — overlay is HTML, not drawn)
        tempCtx.drawImage(this.canvas, x, y, w, h, 0, 0, w, h);

        // Apply blur
        this.ctx.save();
        this.ctx.filter = 'blur(15px)';
        this.ctx.drawImage(tempCanvas, 0, 0, w, h, x, y, w, h);
        this.ctx.restore();

        this.selectionStart = null;
        this.selectionEnd = null;
    },

    applyCrop() {
        if (!this.selectionStart || !this.selectionEnd) return;

        const s = this.selectionStart;
        const end = this.selectionEnd;
        const x = Math.round(Math.min(s.x, end.x));
        const y = Math.round(Math.min(s.y, end.y));
        const w = Math.round(Math.abs(end.x - s.x));
        const h = Math.round(Math.abs(end.y - s.y));

        if (w < 10 || h < 10) {
            DOM.toast('Sélection trop petite.', 'warning');
            return;
        }

        this.hideSelectionOverlay();
        this.pushUndo();

        const imageData = this.ctx.getImageData(x, y, w, h);
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx.putImageData(imageData, 0, 0);

        this.selectionStart = null;
        this.selectionEnd = null;
        DOM.toast('Image rognée !', 'success');
    },

    applyFilter(filterId) {
        this.pushUndo();
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        const filterMap = {
            'grayscale': 'grayscale(100%)',
            'sepia': 'sepia(100%)',
            'invert': 'invert(100%)'
        };

        tempCtx.filter = filterMap[filterId] || 'none';
        tempCtx.drawImage(this.canvas, 0, 0);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(tempCanvas, 0, 0);
    },

    applyBrightnessContrast() {
        // Redraw original with filters
        if (this.undoStack.length > 0) {
            // Use last undo state as base
            const lastState = this.undoStack[this.undoStack.length - 1];
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = lastState.width;
            tempCanvas.height = lastState.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(lastState, 0, 0);

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.filter = `brightness(${this.settings.brightness}%) contrast(${this.settings.contrast}%)`;
            this.ctx.drawImage(tempCanvas, 0, 0);
            this.ctx.filter = 'none';
        }
    },

    async importFromUrl() {
        const url = await DOM.prompt('URL de l\'image :', '', 'Importer une image');
        if (!url) return;

        try {
            const result = await API.post('/api/fetch-image-url', { url });
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.pushUndo();
                this.canvas.width = img.width;
                this.canvas.height = img.height;
                this.ctx.drawImage(img, 0, 0);
                this.originalImage = img;
                DOM.toast('Image importée !', 'success');
            };
            img.src = `/media/${result.path}`;
        } catch (err) {
            DOM.toast(`Erreur : ${err.message}`, 'error');
        }
    },

    async save() {
        try {
            const blob = await new Promise(resolve => this.canvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], 'edited.png', { type: 'image/png' });
            const result = await API.uploadFile('/api/upload/image', file);
            DOM.hideModal();
            if (this.onSave) this.onSave(result.path);
            DOM.toast('Image sauvegardée !', 'success');
        } catch (err) {
            DOM.toast(`Erreur de sauvegarde : ${err.message}`, 'error');
        }
    }
};
