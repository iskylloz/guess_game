import os
import io
import json
import uuid
import zipfile
import threading
import urllib.request
from flask import (
    Blueprint, render_template, request, jsonify,
    send_from_directory, current_app, send_file
)
from app.question_manager import QuestionManager
from app.utils import (
    generate_id, allowed_file, get_file_extension,
    ALLOWED_IMAGE_EXTENSIONS, ALLOWED_AUDIO_EXTENSIONS
)

# In-memory import job store (desktop app, single user)
_import_jobs = {}

bp = Blueprint('main', __name__)


def get_manager():
    return QuestionManager(
        current_app.config['DB_PATH'],
        current_app.config['MEDIA_PATH']
    )


# --- SPA ---

@bp.route('/')
def index():
    return render_template('index.html')


# --- Clipboard (Windows) ---

@bp.route('/api/clipboard')
def get_clipboard():
    import ctypes
    from ctypes import wintypes
    try:
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32
        CF_UNICODETEXT = 13
        if not user32.OpenClipboard(None):
            return jsonify({'text': ''})
        try:
            handle = user32.GetClipboardData(CF_UNICODETEXT)
            if not handle:
                return jsonify({'text': ''})
            kernel32.GlobalLock.restype = ctypes.c_void_p
            ptr = kernel32.GlobalLock(handle)
            if not ptr:
                return jsonify({'text': ''})
            text = ctypes.wstring_at(ptr)
            kernel32.GlobalUnlock(handle)
            return jsonify({'text': text})
        finally:
            user32.CloseClipboard()
    except Exception:
        return jsonify({'text': ''})


# --- Version & update ---

@bp.route('/api/version')
def get_version():
    from version import VERSION
    return jsonify({'version': VERSION})


@bp.route('/api/update-check')
def check_update():
    info = current_app.config.get('UPDATE_INFO')
    if info:
        return jsonify(info)
    return jsonify({'available': False})


# --- Media serving ---

@bp.route('/media/<path:filename>')
def serve_media(filename):
    return send_from_directory(current_app.config['MEDIA_PATH'], filename)


# --- Questions CRUD ---

@bp.route('/api/questions', methods=['GET'])
def get_questions():
    manager = get_manager()
    category = request.args.get('category', '')
    search = request.args.get('search', '')
    sort = request.args.get('sort', 'newest')
    questions = manager.search(text=search, category=category, sort=sort)
    return jsonify({'questions': [q.to_dict() for q in questions]})


@bp.route('/api/questions/stats', methods=['GET'])
def get_stats():
    manager = get_manager()
    return jsonify(manager.get_stats())


@bp.route('/api/questions', methods=['POST'])
def create_question():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    category = data.get('category', '')
    question_data = data.get('question', {})
    answer_data = data.get('answer', {})

    black_type = data.get('black_type')
    is_bonus_malus = category == 'black' and black_type in ('bonus', 'malus')

    if not question_data.get('text', '').strip():
        return jsonify({'error': 'Question text is required'}), 400
    if not is_bonus_malus and not answer_data.get('text', '').strip():
        return jsonify({'error': 'Answer text is required'}), 400

    try:
        manager = get_manager()
        question = manager.create(category, question_data, answer_data, black_type=black_type)
        return jsonify(question.to_dict()), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@bp.route('/api/questions/<question_id>', methods=['PUT'])
def update_question(question_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    category = data.get('category', '')
    question_data = data.get('question', {})
    answer_data = data.get('answer', {})

    try:
        manager = get_manager()
        black_type = data.get('black_type')
        question = manager.update(question_id, category, question_data, answer_data, black_type=black_type)
        return jsonify(question.to_dict())
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@bp.route('/api/questions/<question_id>', methods=['DELETE'])
def delete_question(question_id):
    try:
        manager = get_manager()
        manager.delete(question_id)
        return jsonify({'ok': True})
    except ValueError as e:
        return jsonify({'error': str(e)}), 404


@bp.route('/api/questions/all', methods=['DELETE'])
def delete_all_questions():
    manager = get_manager()
    manager.delete_all()
    return jsonify({'ok': True})


# --- Duplicate check ---

@bp.route('/api/questions/check-duplicate', methods=['POST'])
def check_duplicate():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    answer_text = data.get('answer_text', '')
    manager = get_manager()
    similar = manager.find_similar(answer_text)
    return jsonify({'similar': similar})


# --- File uploads ---

@bp.route('/api/upload/image', methods=['POST'])
def upload_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No filename'}), 400

    if not allowed_file(file.filename, ALLOWED_IMAGE_EXTENSIONS):
        return jsonify({'error': 'Invalid image format'}), 400

    ext = get_file_extension(file.filename)
    filename = f'img_{generate_id("i")}.{ext}'
    filepath = os.path.join(current_app.config['MEDIA_PATH'], 'images', filename)
    file.save(filepath)

    return jsonify({'path': f'images/{filename}'})


@bp.route('/api/upload/audio', methods=['POST'])
def upload_audio():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No filename'}), 400

    if not allowed_file(file.filename, ALLOWED_AUDIO_EXTENSIONS):
        return jsonify({'error': 'Invalid audio format'}), 400

    ext = get_file_extension(file.filename)
    filename = f'aud_{generate_id("a")}.{ext}'
    filepath = os.path.join(current_app.config['MEDIA_PATH'], 'audio', filename)
    file.save(filepath)

    return jsonify({'path': f'audio/{filename}'})


@bp.route('/api/fetch-image-url', methods=['POST'])
def fetch_image_url():
    data = request.get_json()
    if not data or not data.get('url', '').strip():
        return jsonify({'error': 'No URL provided'}), 400

    url = data['url'].strip()
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            content_type = response.headers.get('Content-Type', '')
            if 'image' not in content_type:
                return jsonify({'error': 'URL does not point to an image'}), 400

            image_data = response.read(10 * 1024 * 1024)  # 10MB max

            # Determine extension from content type
            ext_map = {
                'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
                'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp'
            }
            ext = ext_map.get(content_type.split(';')[0].strip(), 'png')

            filename = f'img_{generate_id("i")}.{ext}'
            filepath = os.path.join(
                current_app.config['MEDIA_PATH'], 'images', filename
            )
            with open(filepath, 'wb') as f:
                f.write(image_data)

            return jsonify({'path': f'images/{filename}'})
    except Exception as e:
        return jsonify({'error': f'Failed to fetch image: {str(e)}'}), 400


# --- Export / Import ---

@bp.route('/api/export', methods=['POST'])
def export_questions():
    import webview
    from datetime import date

    # Ask user to pick a save location via native dialog
    window = webview.windows[0] if webview.windows else None
    if not window:
        return jsonify({'error': 'No window available'}), 500

    default_name = f'questions_{date.today().isoformat()}.zip'
    result = window.create_file_dialog(
        webview.SAVE_DIALOG,
        save_filename=default_name,
        file_types=('ZIP Files (*.zip)',)
    )

    if not result:
        return jsonify({'cancelled': True})

    save_path = result if isinstance(result, str) else result[0]

    manager = get_manager()
    questions = manager.load_all()
    media_path = current_app.config['MEDIA_PATH']

    with zipfile.ZipFile(save_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Write questions JSON
        questions_data = {
            'version': 1,
            'questions': [q.to_dict() for q in questions]
        }
        zf.writestr('questions.json', json.dumps(questions_data, ensure_ascii=False, indent=2))

        # Include media files
        media_files_added = set()
        for q in questions:
            for media in [q.question, q.answer]:
                for path in [media.image, media.audio]:
                    if path and path not in media_files_added:
                        full_path = os.path.join(media_path, path)
                        if os.path.exists(full_path):
                            zf.write(full_path, f'media/{path}')
                            media_files_added.add(path)

    return jsonify({'ok': True, 'path': save_path})


@bp.route('/api/import/pick', methods=['POST'])
def import_pick():
    """Open native file dialog and return chosen file path (no upload)."""
    import webview
    window = webview.windows[0] if webview.windows else None
    if not window:
        return jsonify({'error': 'No window available'}), 500

    result = window.create_file_dialog(
        webview.OPEN_DIALOG,
        file_types=('ZIP Files (*.zip)', 'JSON Files (*.json)')
    )
    if not result:
        return jsonify({'cancelled': True})

    path = result[0] if isinstance(result, (list, tuple)) else result
    size = os.path.getsize(path)
    return jsonify({'path': path, 'size': size, 'name': os.path.basename(path)})


@bp.route('/api/import/start', methods=['POST'])
def import_start():
    """Start background import from a local file path. Returns job_id for polling."""
    data = request.get_json()
    file_path = data.get('path', '')
    mode = data.get('mode', 'full_merge')

    if not file_path or not os.path.exists(file_path):
        return jsonify({'error': 'Fichier introuvable'}), 400

    job_id = str(uuid.uuid4())[:8]
    _import_jobs[job_id] = {
        'status': 'running',
        'step': 'Initialisation…',
        'progress': 0,
        'processed': 0,
        'total': 0,
        'result': None,
        'error': None,
    }

    # Capture config values before entering thread (no app context in thread)
    media_path = current_app.config['MEDIA_PATH']
    db_path = current_app.config['DB_PATH']

    def run():
        try:
            _do_import(job_id, file_path, mode, media_path, db_path)
        except Exception as e:
            _import_jobs[job_id]['status'] = 'error'
            _import_jobs[job_id]['error'] = str(e)

    threading.Thread(target=run, daemon=True).start()
    return jsonify({'job_id': job_id})


@bp.route('/api/import/progress/<job_id>')
def import_progress(job_id):
    """Poll import job status."""
    job = _import_jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Job introuvable'}), 404
    return jsonify(job)


def _do_import(job_id, file_path, mode, media_path, db_path):
    """Background import worker — updates _import_jobs[job_id] in place."""
    from app.question_manager import QuestionManager
    from app.models import Question
    from datetime import datetime, timezone

    job = _import_jobs[job_id]
    manager = QuestionManager(db_path, media_path)
    now = datetime.now(timezone.utc).isoformat()
    imported = []

    # ── Phase 1 : parse file ──────────────────────────────────────────────────
    job['step'] = 'Lecture du fichier…'

    if file_path.lower().endswith('.zip'):
        with zipfile.ZipFile(file_path, 'r') as zf:
            if 'questions.json' not in zf.namelist():
                job['status'] = 'error'
                job['error'] = 'questions.json introuvable dans le ZIP'
                return

            data = json.loads(zf.read('questions.json'))
            imported = data.get('questions', [])
            job['total'] = len(imported)

            # Extract media files
            media_names = [n for n in zf.namelist()
                           if n.startswith('media/') and not n.endswith('/')]
            total_media = len(media_names)
            if total_media:
                job['step'] = f'Extraction des médias (0 / {total_media})…'
                for i, name in enumerate(media_names):
                    rel = name[len('media/'):]
                    target = os.path.join(media_path, rel)
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    with open(target, 'wb') as f:
                        f.write(zf.read(name))
                    if i % 10 == 0 or i == total_media - 1:
                        job['step'] = f'Extraction des médias ({i + 1} / {total_media})…'
                        job['progress'] = int((i + 1) / total_media * 30)

        # Normalize media paths
        for q_data in imported:
            for field in ['question', 'answer']:
                section = q_data.get(field, {})
                for key in ['image', 'audio']:
                    val = section.get(key)
                    if val and val.startswith('media/'):
                        section[key] = val[len('media/'):]

    elif file_path.lower().endswith('.json'):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        imported = data.get('questions', [])
        job['total'] = len(imported)
        for q_data in imported:
            for field in ['question', 'answer']:
                section = q_data.get(field, {})
                for key in ['image', 'audio']:
                    val = section.get(key)
                    if val and val.startswith('media/'):
                        section[key] = val[len('media/'):]
    else:
        job['status'] = 'error'
        job['error'] = 'Format non supporté (.zip ou .json uniquement)'
        return

    total = len(imported)
    job['total'] = total
    result = {'added': 0, 'skipped': 0, 'total': 0}

    # ── Phase 2 : insert questions ────────────────────────────────────────────
    if mode == 'replace':
        job['step'] = 'Suppression des questions existantes…'
        job['progress'] = 30
        existing = manager.load_all()
        for q in existing:
            for media in [q.question, q.answer]:
                if media.image:
                    manager._delete_media_file(media.image)
                if media.audio:
                    manager._delete_media_file(media.audio)

        new_questions = []
        for i, q_data in enumerate(imported):
            q_data['id'] = generate_id('q')
            q_data['updated_at'] = now
            new_questions.append(Question.from_dict(q_data))
            if i % 50 == 0 or i == total - 1:
                job['step'] = f'Préparation des questions… ({i + 1} / {total})'
                job['progress'] = 30 + int((i + 1) / total * 30)
                job['processed'] = i + 1

        job['step'] = f'Enregistrement en base… ({total} questions)'
        job['progress'] = 60
        manager.save_all(new_questions)
        result['added'] = len(new_questions)
        result['total'] = len(new_questions)

    elif mode == 'smart_merge':
        added = 0
        duplicates = []
        for i, q_data in enumerate(imported):
            answer_text = q_data.get('answer', {}).get('text', '')
            similar = manager.find_similar(answer_text) if answer_text else []
            if similar:
                duplicates.append({
                    'index': i,
                    'imported': q_data,
                    'match': similar[0]['question'],
                    'similarity': similar[0]['similarity']
                })
            else:
                manager.create(
                    q_data.get('category', 'blue'),
                    q_data.get('question', {}),
                    q_data.get('answer', {}),
                    black_type=q_data.get('black_type')
                )
                added += 1
            if i % 20 == 0 or i == total - 1:
                job['step'] = f'Analyse des doublons… ({i + 1} / {total})'
                job['progress'] = 30 + int((i + 1) / total * 65)
                job['processed'] = i + 1

        result['added'] = added
        result['skipped'] = len(duplicates)
        result['total'] = manager.count()
        if duplicates:
            result['duplicates'] = duplicates

    else:  # full_merge
        for i, q_data in enumerate(imported):
            manager.create(
                q_data.get('category', 'blue'),
                q_data.get('question', {}),
                q_data.get('answer', {}),
                black_type=q_data.get('black_type')
            )
            if i % 20 == 0 or i == total - 1:
                job['step'] = f'Import des questions… ({i + 1} / {total})'
                job['progress'] = 30 + int((i + 1) / total * 65)
                job['processed'] = i + 1

        result['added'] = len(imported)
        result['total'] = manager.count()

    job['progress'] = 100
    job['step'] = 'Terminé !'
    job['processed'] = total
    job['status'] = 'done'
    job['result'] = result


@bp.route('/api/import/force', methods=['POST'])
def import_force():
    """Force-import selected duplicate questions."""
    data = request.get_json()
    questions = data.get('questions', [])
    manager = get_manager()
    added = 0
    for q_data in questions:
        manager.create(
            q_data.get('category', 'blue'),
            q_data.get('question', {}),
            q_data.get('answer', {}),
            black_type=q_data.get('black_type')
        )
        added += 1
    return jsonify({'added': added, 'total': manager.count()})


# --- Settings ---

_SETTINGS_DEFAULTS = {
    'fullscreen': True,
    'volumes': {
        'master': 1,
        'notifications': 1,
        'questions': 1,
        'ambiance': 1
    }
}


def _load_settings():
    path = os.path.join(current_app.config['DATA_PATH'], 'settings.json')
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            # Merge with defaults for any missing keys
            for k, v in _SETTINGS_DEFAULTS.items():
                if k not in data:
                    data[k] = v
                elif isinstance(v, dict):
                    for sk, sv in v.items():
                        if sk not in data[k]:
                            data[k][sk] = sv
            return data
        except Exception:
            return dict(_SETTINGS_DEFAULTS)
    return dict(_SETTINGS_DEFAULTS)


def _save_settings(data):
    path = os.path.join(current_app.config['DATA_PATH'], 'settings.json')
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


@bp.route('/api/settings', methods=['GET'])
def get_settings():
    return jsonify(_load_settings())


@bp.route('/api/settings', methods=['PUT'])
def update_settings():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400
    current = _load_settings()
    # Shallow merge top-level, deep merge volumes
    for k, v in data.items():
        if k == 'volumes' and isinstance(v, dict):
            current.setdefault('volumes', {})
            current['volumes'].update(v)
        else:
            current[k] = v
    _save_settings(current)
    return jsonify(current)


# --- Fullscreen toggle ---

@bp.route('/api/toggle-fullscreen', methods=['POST'])
def toggle_fullscreen():
    try:
        import webview
        data = request.get_json() or {}
        for window in webview.windows:
            window.toggle_fullscreen()
        # Use the state sent by the frontend (source of truth)
        settings = _load_settings()
        if 'fullscreen' in data:
            settings['fullscreen'] = data['fullscreen']
        else:
            settings['fullscreen'] = not settings.get('fullscreen', True)
        _save_settings(settings)
        return jsonify({'ok': True, 'fullscreen': settings['fullscreen']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- Quit ---

@bp.route('/api/quit', methods=['POST'])
def quit_app():
    try:
        import webview
        for window in webview.windows:
            window.destroy()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
