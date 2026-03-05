import os
import time
import random
import string
import re


def generate_id(prefix='q'):
    """Generate a unique ID: prefix_timestamp_random6."""
    ts = int(time.time())
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f'{prefix}_{ts}_{rand}'


ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}
ALLOWED_AUDIO_EXTENSIONS = {'wav', 'mp3', 'ogg', 'webm', 'm4a'}


def allowed_file(filename, allowed_extensions):
    """Check if a filename has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


def sanitize_filename(name):
    """Strip unsafe characters from a filename."""
    name = re.sub(r'[^\w\s\-.]', '', name)
    name = re.sub(r'\s+', '_', name)
    return name


def get_file_extension(filename):
    """Get the lowercase extension of a file."""
    if '.' in filename:
        return filename.rsplit('.', 1)[1].lower()
    return ''


def get_file_size_formatted(size_bytes):
    """Convert bytes to human-readable size."""
    if size_bytes < 1024:
        return f'{size_bytes} B'
    elif size_bytes < 1024 * 1024:
        return f'{size_bytes / 1024:.1f} KB'
    else:
        return f'{size_bytes / (1024 * 1024):.1f} MB'
