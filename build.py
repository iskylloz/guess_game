"""Build script — Compile GuessThePicture into a standalone Windows executable."""

import os
import sys
import shutil
import subprocess
import zipfile


ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'dist')
BUILD = os.path.join(ROOT, 'build')
ICON_PNG = os.path.join(ROOT, 'static', 'assets', 'icons', 'icon.png')
ICON_ICO = os.path.join(ROOT, 'static', 'assets', 'icons', 'icon.ico')


def get_version():
    """Read VERSION from version.py."""
    v = {}
    with open(os.path.join(ROOT, 'version.py'), encoding='utf-8') as f:
        exec(f.read(), v)
    return v['VERSION']


def generate_ico():
    """Convert icon.png to icon.ico (multi-resolution) using Pillow."""
    if os.path.exists(ICON_ICO):
        print(f"  icon.ico already exists, skipping conversion.")
        return

    try:
        from PIL import Image
    except ImportError:
        print("  WARNING: Pillow not installed, cannot generate .ico file.")
        print("  Install with: pip install Pillow")
        print("  Or manually create static/assets/icons/icon.ico")
        return

    img = Image.open(ICON_PNG)
    sizes = [(16, 16), (32, 32), (48, 48), (256, 256)]
    img.save(ICON_ICO, format='ICO', sizes=sizes)
    print(f"  Generated icon.ico from icon.png")


def clean():
    """Remove previous build artifacts."""
    for folder in [BUILD, DIST]:
        if os.path.exists(folder):
            shutil.rmtree(folder)
            print(f"  Cleaned {folder}")


def build():
    """Run PyInstaller with build.spec."""
    spec_file = os.path.join(ROOT, 'build.spec')
    result = subprocess.run(
        [sys.executable, '-m', 'PyInstaller', spec_file, '--distpath', DIST, '--workpath', BUILD],
        cwd=ROOT,
    )
    if result.returncode != 0:
        print("\nBuild FAILED.")
        sys.exit(1)


def package_zip(version):
    """Create a ZIP archive of the build output."""
    app_dir = os.path.join(DIST, 'GuessThePicture')
    zip_name = f'GuessThePicture-v{version}-win64.zip'
    zip_path = os.path.join(DIST, zip_name)

    if not os.path.isdir(app_dir):
        print("  ERROR: Build directory not found, cannot create ZIP.")
        return None

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for dirpath, dirnames, filenames in os.walk(app_dir):
            for filename in filenames:
                file_path = os.path.join(dirpath, filename)
                arcname = os.path.join('GuessThePicture', os.path.relpath(file_path, app_dir))
                zf.write(file_path, arcname)

    size_mb = os.path.getsize(zip_path) / (1024 * 1024)
    print(f"  Created {zip_name} ({size_mb:.1f} MB)")
    return zip_path


def summary(version, zip_path):
    """Print build summary."""
    app_dir = os.path.join(DIST, 'GuessThePicture')
    exe_path = os.path.join(app_dir, 'GuessThePicture.exe')

    print(f"\n{'='*50}")
    if os.path.exists(exe_path):
        print(f"  BUILD SUCCESS — v{version}")
        print(f"  Folder: {app_dir}")
        if zip_path:
            size_mb = os.path.getsize(zip_path) / (1024 * 1024)
            print(f"  ZIP:    {zip_path} ({size_mb:.1f} MB)")
        print(f"{'='*50}")
        print(f"\n  User data: %APPDATA%/GuessThePicture/")
        print(f"  Distribute the ZIP file to users.")
    else:
        print(f"  BUILD FAILED — executable not found")
        print(f"{'='*50}")


if __name__ == '__main__':
    version = get_version()
    print(f"=== Guess The Picture v{version} — Build ===\n")

    print("[1/5] Generating icon.ico...")
    generate_ico()

    print("[2/5] Cleaning previous builds...")
    clean()

    print("[3/5] Running PyInstaller...")
    build()

    print("[4/5] Creating ZIP archive...")
    zip_path = package_zip(version)

    print("[5/5] Summary")
    summary(version, zip_path)
