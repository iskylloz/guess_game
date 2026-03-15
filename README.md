# Guess the Picture

Quiz multimédia desktop pour jouer entre amis ou en famille. Devinez à partir d'images, de sons et de vidéos !

## Fonctionnalités

- **3 modes de jeu** : Aléatoire, Classique (choix de catégorie), Chrono (compte à rebours)
- **7 catégories** de questions avec couleurs distinctes, dont la catégorie noire spéciale (bonus, malus, difficile)
- **Multimédia** : images, audio, vidéos YouTube
- **Éditeur intégré** : création et gestion de questions avec éditeur d'image et éditeur audio
- **Import/Export** : sauvegarde et partage de packs de questions (ZIP/JSON)
- **Multi-équipes** : rotation automatique, scores, statistiques de fin de partie
- **Mode chrono** : SFX de tension progressive, ticks accélérés, buzz final
- **Application desktop** : fenêtre native via pywebview (Qt6)

## Installation

```bash
pip install -r requirements.txt
```

## Lancement

```bash
python main.py            # mode normal
python main.py --debug    # avec devtools
```

## Stack technique

- **Backend** : Python, Flask, pywebview (Qt6), SQLite
- **Frontend** : Vanilla JavaScript (SPA), CSS3, Web Audio API
- **Pas de bundler** ni de framework JS — tout est chargé directement

## Structure

```
├── main.py                 # Point d'entrée
├── app/
│   ├── __init__.py         # Factory Flask
│   ├── routes.py           # API REST
│   ├── models.py           # Dataclasses Question/MediaContent
│   ├── question_manager.py # CRUD SQLite
│   └── utils.py            # Utilitaires
├── static/
│   ├── css/                # Styles
│   └── js/
│       ├── utils/          # DOM, API, Media helpers
│       ├── game/           # Setup, Engine, UI, Timer, End
│       └── editor/         # Create, Manage, Image/Audio editors
├── data/                   # Données utilisateur (gitignored)
│   ├── questions.db
│   ├── settings.json
│   └── media/
└── version.py              # Version de l'application
```

## Licence

Usage personnel.
