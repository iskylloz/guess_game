"""Build script — Compile GuessThePicture into a standalone Windows executable."""

import os
import sys
import shutil
import subprocess


ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'dist')
BUILD = os.path.join(ROOT, 'build')
ICON_PNG = os.path.join(ROOT, 'static', 'assets', 'icons', 'icon.png')
ICON_ICO = os.path.join(ROOT, 'static', 'assets', 'icons', 'icon.ico')


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


def summary():
    """Print build summary."""
    exe_path = os.path.join(DIST, 'GuessThePicture.exe')
    if os.path.exists(exe_path):
        size_mb = os.path.getsize(exe_path) / (1024 * 1024)
        print(f"\n{'='*50}")
        print(f"  BUILD SUCCESS")
        print(f"  Executable: {exe_path}")
        print(f"  Size: {size_mb:.1f} MB")
        print(f"{'='*50}")
        print(f"\n  User data will be stored in: %APPDATA%/GuessThePicture/")
    else:
        print("\nBuild completed but executable not found.")


if __name__ == '__main__':
    print("=== Guess The Picture — Build ===\n")

    print("[1/4] Generating icon.ico...")
    generate_ico()

    print("[2/4] Cleaning previous builds...")
    clean()

    print("[3/4] Running PyInstaller...")
    build()

    print("[4/4] Summary")
    summary()
