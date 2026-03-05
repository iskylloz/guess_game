from dataclasses import dataclass, field, asdict
from typing import Optional
from datetime import datetime, timezone


@dataclass
class MediaContent:
    text: str = ''
    image: Optional[str] = None
    audio: Optional[str] = None
    youtube: Optional[str] = None

    def to_dict(self):
        return {
            'text': self.text,
            'image': self.image,
            'audio': self.audio,
            'youtube': self.youtube
        }

    @classmethod
    def from_dict(cls, data):
        if data is None:
            return cls()
        return cls(
            text=data.get('text', ''),
            image=data.get('image'),
            audio=data.get('audio'),
            youtube=data.get('youtube')
        )


@dataclass
class Question:
    id: str
    category: str
    question: MediaContent
    answer: MediaContent
    created_at: str = ''
    updated_at: str = ''

    def __post_init__(self):
        now = datetime.now(timezone.utc).isoformat()
        if not self.created_at:
            self.created_at = now
        if not self.updated_at:
            self.updated_at = now

    def to_dict(self):
        return {
            'id': self.id,
            'category': self.category,
            'question': self.question.to_dict(),
            'answer': self.answer.to_dict(),
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data['id'],
            category=data['category'],
            question=MediaContent.from_dict(data.get('question', {})),
            answer=MediaContent.from_dict(data.get('answer', {})),
            created_at=data.get('created_at', ''),
            updated_at=data.get('updated_at', '')
        )


CATEGORIES = {
    'blue': {'color': '#2563EB', 'label': 'Bleu', 'emoji': '\U0001f535'},
    'green': {'color': '#10B981', 'label': 'Vert', 'emoji': '\U0001f7e2'},
    'red': {'color': '#EF4444', 'label': 'Rouge', 'emoji': '\U0001f534'},
    'white': {'color': '#F3F4F6', 'label': 'Blanc', 'emoji': '\u26aa'},
    'yellow': {'color': '#EAB308', 'label': 'Jaune', 'emoji': '\U0001f7e1'},
    'pink': {'color': '#EC4899', 'label': 'Rose', 'emoji': '\U0001fa77'},
    'black': {'color': '#1F2937', 'label': 'Noir', 'emoji': '\u26ab'}
}

VALID_CATEGORIES = set(CATEGORIES.keys())
