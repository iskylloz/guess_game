# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this?

"Guess the Picture" — a desktop quiz game app with a question editor. Built with Python (Flask + pywebview/Qt6) as backend and vanilla JavaScript as a SPA frontend rendered inside a native window.

## Running the app

```bash
pip install -r requirements.txt
python main.py            # production
python main.py --debug    # with devtools
```

There is no build step, bundler, or test framework. Frontend is vanilla JS loaded directly via `<script>` tags.

## Architecture

### Backend (Python)

- **`main.py`** — Entry point. Creates Flask app, pywebview window (Qt6 backend), reads `data/settings.json` for startup config (fullscreen, etc.).
- **`app/__init__.py`** — Flask factory. Configures `DATA_PATH`, `DB_PATH`, `MEDIA_PATH`.
- **`app/routes.py`** — All API endpoints. Questions CRUD, media uploads, import/export (ZIP/JSON), settings persistence, fullscreen toggle.
- **`app/models.py`** — `Question` and `MediaContent` dataclasses. `CATEGORIES` constant defines the 7 game categories (blue, green, red, white, yellow, pink, black).
- **`app/question_manager.py`** — SQLite operations (WAL mode). Handles CRUD, search, similarity detection (Jaccard on word sets, 50% threshold), media file cleanup.
- **`app/utils.py`** — ID generation (`prefix_timestamp_random`), file extension validation.

### Frontend (Vanilla JS SPA)

Hash-based routing (`#/home`, `#/editor`, `#/game/setup`, `#/game/play`, `#/game/end`, `#/settings`). Pages register as `App.pages[name] = { render(container, params), destroy() }`.

**Utilities (`static/js/utils/`):**
- `dom.js` — Element creation (`DOM.create`), modals, toasts, confirm dialogs. All UI is built programmatically, no template engine.
- `api.js` — Centralized fetch wrapper (`API.get/post/put/delete/uploadFile`).
- `media.js` — YouTube embed extraction, audio player widget, multi-channel volume system (master × channel), image orientation detection & auto-sizing, WAV encoding.

**Game (`static/js/game/`):**
- `setup.js` — Config screen (mode, teams, timer, black question chance).
- `engine.js` — Core logic. 3 modes: random, classic (category pick), timer. Scoring: normal=1pt, black=2pt. Tracks used questions, team rotation, cancelled questions.
- `ui.js` — Renders category grid, question/answer views with auto-sized images, score bar.
- `timer.js` — Countdown class with color-coded display.
- `end.js` — Results table, cancelled questions review.

**Editor (`static/js/editor/`):**
- `create.js` — Question creation/edit form with category selector, media fields (image/audio/YouTube), duplicate detection.
- `manage.js` — Question list with search, sort, category filter, bulk operations.
- `image-editor.js` — Canvas-based: draw, text, blur, crop, brightness/contrast. Uses HTML overlay div for selection (not drawn on canvas) so canvas stays clean for processing.
- `audio-editor.js` — Record via Web Audio API, trim with WaveSurfer.js.
- `preview.js` — Question preview modal with auto-sized images.
- `import-export.js` — ZIP/JSON export, 3 import modes (replace, full merge, smart merge with duplicate review).

### Data

All user data lives in `data/` (persists across updates when frozen):
- `questions.db` — SQLite, single `questions` table.
- `settings.json` — Fullscreen preference, volume levels per channel.
- `media/images/`, `media/audio/` — Uploaded/imported media files.

Media paths stored in DB are relative (e.g. `images/img_q_abc.jpg`), served via `/media/<path>`.

## Key patterns

- **No frameworks** — vanilla JS with module pattern (namespace objects). No npm, no bundler.
- **All UI is JS-generated** — `DOM.create()` builds elements. `index.html` is just a shell with script tags.
- **Volume system** — `Media._volumes` object with 4 channels. `getEffectiveVolume(channel)` = master × channel. Persisted to both localStorage (fast sync access) and `settings.json` (backend persistence).
- **Image auto-sizing** — `Media.detectImageOrientation()` classifies aspect ratio (ultra-wide/landscape/square/portrait/ultra-tall), `Media.computeImageSize()` computes optimal display dimensions.
- **Import smart merge** — Jaccard similarity on answer text to detect duplicates; user reviews detected duplicates in a modal before force-importing selected ones.
- **Desktop integration** — pywebview's `window.toggle_fullscreen()` for fullscreen (not Qt direct API, to keep pywebview state in sync). Native file dialogs for export.

## Language

The application UI and user-facing text are in **French**. Code comments and variable names are in English.
