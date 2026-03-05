import sys
import os
import json
import threading
import webview
from app import create_app
from version import VERSION


def get_base_path():
    """Return the base path for static/template assets."""
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def get_data_path():
    """Return the path for user data (persists across updates)."""
    if getattr(sys, 'frozen', False):
        appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
        return os.path.join(appdata, 'GuessThePicture')
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')


def load_settings(data_path):
    """Read settings.json from data folder."""
    path = os.path.join(data_path, 'settings.json')
    defaults = {
        'fullscreen': True,
        'volumes': {'master': 1, 'notifications': 1, 'questions': 1, 'ambiance': 1}
    }
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            for k, v in defaults.items():
                if k not in data:
                    data[k] = v
            return data
        except Exception:
            return defaults
    return defaults


if __name__ == '__main__':
    base_path = get_base_path()
    data_path = get_data_path()

    os.makedirs(os.path.join(data_path, 'media', 'images'), exist_ok=True)
    os.makedirs(os.path.join(data_path, 'media', 'audio'), exist_ok=True)

    settings = load_settings(data_path)

    app = create_app(base_path, data_path)

    icon_path = os.path.join(base_path, 'static', 'assets', 'icons', 'icon.png')

    window = webview.create_window(
        f'Guess The Picture v{VERSION}',
        app,
        width=1280,
        height=800,
        min_size=(1024, 700),
        resizable=True,
        background_color='#0f0f23'
    )

    # Write defaults on first run so settings.json always exists
    settings_path = os.path.join(data_path, 'settings.json')
    if not os.path.exists(settings_path):
        with open(settings_path, 'w', encoding='utf-8') as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)

    # Check for updates in background
    def _check_update():
        from app.updater import check_for_update
        result = check_for_update(VERSION)
        if result and result.get('available'):
            app.config['UPDATE_INFO'] = result

    threading.Thread(target=_check_update, daemon=True).start()

    if settings.get('fullscreen', True):
        def on_shown():
            """Enter fullscreen using pywebview API for state consistency."""
            def delayed_fs():
                import time
                time.sleep(0.3)
                window.toggle_fullscreen()
            threading.Thread(target=delayed_fs, daemon=True).start()

        window.events.shown += on_shown

    webview.start(
        gui='qt',
        icon=icon_path,
        debug=('--debug' in sys.argv)
    )
