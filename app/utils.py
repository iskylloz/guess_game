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


# --- Image normalisation ---

IMAGE_MAX_SIDE = 2560          # Longest side after import/upload (game runs at <= 2560px wide)
IMAGE_JPEG_QUALITY = 92        # High quality, no chroma subsampling
IMAGE_SKIP_BELOW_BYTES = 1536 * 1024  # Small files already within bounds are left untouched


def optimize_image(path, max_side=IMAGE_MAX_SIDE, jpeg_quality=IMAGE_JPEG_QUALITY):
    """
    Downscale an image in place so its longest side is <= max_side, keeping the
    original format and extension (PNG stays lossless, JPEG re-encoded at high quality).
    GIFs are never touched (animation). Returns dict {old_size, new_size, resized}.
    Silently returns unchanged stats if Pillow is unavailable or the file can't be decoded.
    """
    result = {'old_size': 0, 'new_size': 0, 'resized': False}
    if not path or not os.path.isfile(path):
        return result
    old_size = os.path.getsize(path)
    result['old_size'] = result['new_size'] = old_size

    ext = get_file_extension(path)
    if ext == 'gif':
        return result

    try:
        from PIL import Image, ImageOps
    except ImportError:
        return result

    try:
        with Image.open(path) as im:
            fmt = im.format  # 'JPEG', 'PNG', 'WEBP', 'BMP'...
            im = ImageOps.exif_transpose(im)
            w, h = im.size
            longest = max(w, h)

            needs_resize = longest > max_side
            # Nothing to gain: already within bounds and reasonably small
            if not needs_resize and old_size <= IMAGE_SKIP_BELOW_BYTES:
                return result
            # Only re-encode without resizing for lossy formats (worth it for huge JPEGs);
            # a big in-bounds PNG is left alone to stay byte-identical.
            if not needs_resize and fmt not in ('JPEG', 'WEBP'):
                return result

            if needs_resize:
                scale = max_side / longest
                im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)

            save_kwargs = {}
            if fmt == 'JPEG':
                if im.mode not in ('RGB', 'L'):
                    im = im.convert('RGB')
                save_kwargs = {'quality': jpeg_quality, 'optimize': True, 'subsampling': 0}
            elif fmt == 'PNG':
                save_kwargs = {'optimize': True}
            elif fmt == 'WEBP':
                save_kwargs = {'quality': jpeg_quality, 'method': 4}
            elif fmt == 'BMP':
                save_kwargs = {}
            else:
                return result

            tmp = path + '.tmp'
            im.save(tmp, format=fmt, **save_kwargs)

        new_size = os.path.getsize(tmp)
        # Never replace with a bigger file unless we actually had to downscale
        if new_size >= old_size and not needs_resize:
            os.remove(tmp)
            return result

        os.replace(tmp, path)
        result['new_size'] = new_size
        result['resized'] = needs_resize
        return result
    except Exception:
        tmp = path + '.tmp'
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass
        return result


def get_file_size_formatted(size_bytes):
    """Convert bytes to human-readable size."""
    if size_bytes < 1024:
        return f'{size_bytes} B'
    elif size_bytes < 1024 * 1024:
        return f'{size_bytes / 1024:.1f} KB'
    else:
        return f'{size_bytes / (1024 * 1024):.1f} MB'
