# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for Guess The Picture."""

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('static', 'static'),
        ('templates', 'templates'),
        ('version.py', '.'),
    ],
    hiddenimports=[
        'webview',
        'webview.platforms.qt',
        'flask',
        'flask.json',
        'flask.templating',
        'PyQt6.QtCore',
        'PyQt6.QtWidgets',
        'PyQt6.QtGui',
        'PyQt6.QtWebEngineWidgets',
        'PyQt6.QtWebEngineCore',
        'PyQt6.QtNetwork',
        'PyQt6.QtWebChannel',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=['tkinter', 'unittest'],
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='GuessThePicture',
    icon='static/assets/icons/icon.ico',
    console=False,
    strip=False,
    upx=False,
)
