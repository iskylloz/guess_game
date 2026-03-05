import os
from flask import Flask


def create_app(base_path, data_path):
    app = Flask(
        __name__,
        static_folder=os.path.join(base_path, 'static'),
        template_folder=os.path.join(base_path, 'templates')
    )
    app.config['DATA_PATH'] = data_path
    app.config['DB_PATH'] = os.path.join(data_path, 'questions.db')
    app.config['MEDIA_PATH'] = os.path.join(data_path, 'media')
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB max upload

    from app.routes import bp
    app.register_blueprint(bp)

    return app
