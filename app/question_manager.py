import os
import sqlite3
from datetime import datetime, timezone

from app.models import Question, MediaContent, VALID_CATEGORIES
from app.utils import generate_id


def _word_set(text):
    """Lowercased word set used for Jaccard similarity."""
    return set((text or '').lower().split())


def _jaccard(a, b):
    """Jaccard similarity between two word sets (0..1)."""
    if not a or not b:
        return 0.0
    union = a | b
    return len(a & b) / len(union) if union else 0.0


class QuestionManager:
    def __init__(self, db_path, media_path):
        self.db_path = db_path
        self.media_path = media_path
        self._init_db()

    def _get_conn(self):
        """Get a SQLite connection with WAL mode for better concurrency."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA foreign_keys=ON')
        return conn

    def _init_db(self):
        """Create the questions table if it doesn't exist."""
        conn = self._get_conn()
        try:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS questions (
                    id TEXT PRIMARY KEY,
                    category TEXT NOT NULL,
                    question_text TEXT NOT NULL DEFAULT '',
                    question_image TEXT,
                    question_audio TEXT,
                    question_youtube TEXT,
                    answer_text TEXT NOT NULL DEFAULT '',
                    answer_image TEXT,
                    answer_audio TEXT,
                    answer_youtube TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    black_type TEXT
                )
            ''')
            # Migration: add black_type column if missing
            try:
                conn.execute('ALTER TABLE questions ADD COLUMN black_type TEXT')
            except Exception:
                pass  # Column already exists
            conn.execute('''
                CREATE INDEX IF NOT EXISTS idx_category ON questions(category)
            ''')
            conn.execute('''
                CREATE INDEX IF NOT EXISTS idx_question_text ON questions(question_text)
            ''')
            conn.commit()
        finally:
            conn.close()

    def _row_to_question(self, row):
        """Convert a sqlite3.Row to a Question object."""
        return Question(
            id=row['id'],
            category=row['category'],
            question=MediaContent(
                text=row['question_text'],
                image=row['question_image'],
                audio=row['question_audio'],
                youtube=row['question_youtube']
            ),
            answer=MediaContent(
                text=row['answer_text'],
                image=row['answer_image'],
                audio=row['answer_audio'],
                youtube=row['answer_youtube']
            ),
            created_at=row['created_at'],
            updated_at=row['updated_at'],
            black_type=row['black_type']
        )

    def load_all(self):
        """Load all questions as Question objects."""
        conn = self._get_conn()
        try:
            rows = conn.execute(
                'SELECT * FROM questions ORDER BY created_at DESC'
            ).fetchall()
            return [self._row_to_question(r) for r in rows]
        finally:
            conn.close()

    def save_all(self, questions):
        """Replace all questions with the given list (used by import)."""
        conn = self._get_conn()
        try:
            conn.execute('DELETE FROM questions')
            for q in questions:
                self._insert_question(conn, q)
            conn.commit()
        finally:
            conn.close()

    def _insert_question(self, conn, question):
        """Insert a Question object into the database."""
        conn.execute('''
            INSERT OR REPLACE INTO questions
            (id, category, question_text, question_image, question_audio, question_youtube,
             answer_text, answer_image, answer_audio, answer_youtube, created_at, updated_at, black_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            question.id, question.category,
            question.question.text, question.question.image,
            question.question.audio, question.question.youtube,
            question.answer.text, question.answer.image,
            question.answer.audio, question.answer.youtube,
            question.created_at, question.updated_at,
            question.black_type
        ))

    def get_by_id(self, question_id):
        """Get a single question by ID."""
        conn = self._get_conn()
        try:
            row = conn.execute(
                'SELECT * FROM questions WHERE id = ?', (question_id,)
            ).fetchone()
            return self._row_to_question(row) if row else None
        finally:
            conn.close()

    def _build_question(self, category, question_data, answer_data, black_type=None):
        """Validate input and build a new Question object (not persisted)."""
        if category not in VALID_CATEGORIES:
            raise ValueError(f'Invalid category: {category}')
        question_data = question_data or {}
        answer_data = answer_data or {}

        return Question(
            id=generate_id('q'),
            category=category,
            question=MediaContent(
                text=question_data.get('text') or '',
                image=question_data.get('image'),
                audio=question_data.get('audio'),
                youtube=question_data.get('youtube')
            ),
            answer=MediaContent(
                text=answer_data.get('text') or '',
                image=answer_data.get('image'),
                audio=answer_data.get('audio'),
                youtube=answer_data.get('youtube')
            ),
            black_type=black_type if category == 'black' else None
        )

    def create(self, category, question_data, answer_data, black_type=None):
        """Create a new question and return it."""
        question = self._build_question(category, question_data, answer_data, black_type)

        conn = self._get_conn()
        try:
            self._insert_question(conn, question)
            conn.commit()
        finally:
            conn.close()

        return question

    def create_many(self, items):
        """
        Insert many questions in a single transaction.
        items: iterable of (category, question_data, answer_data, black_type).
        Validation happens before any write, so either all rows are inserted or none.
        """
        questions = [self._build_question(*item) for item in items]
        if not questions:
            return []

        conn = self._get_conn()
        try:
            for q in questions:
                self._insert_question(conn, q)
            conn.commit()
        finally:
            conn.close()

        return questions

    def update(self, question_id, category, question_data, answer_data, black_type=None):
        """Update an existing question."""
        if category not in VALID_CATEGORIES:
            raise ValueError(f'Invalid category: {category}')

        existing = self.get_by_id(question_id)
        if not existing:
            raise ValueError(f'Question not found: {question_id}')

        # Cleanup orphaned media files (removed or replaced)
        old_media = {
            existing.question.image,
            existing.question.audio,
            existing.answer.image,
            existing.answer.audio,
        }
        new_media = {
            question_data.get('image'),
            question_data.get('audio'),
            answer_data.get('image'),
            answer_data.get('audio'),
        }
        for path in old_media - new_media:
            self._delete_media_file(path)

        now = datetime.now(timezone.utc).isoformat()

        conn = self._get_conn()
        try:
            conn.execute('''
                UPDATE questions SET
                    category=?, question_text=?, question_image=?, question_audio=?,
                    question_youtube=?, answer_text=?, answer_image=?, answer_audio=?,
                    answer_youtube=?, updated_at=?, black_type=?
                WHERE id=?
            ''', (
                category,
                question_data.get('text', ''),
                question_data.get('image'),
                question_data.get('audio'),
                question_data.get('youtube'),
                answer_data.get('text', ''),
                answer_data.get('image'),
                answer_data.get('audio'),
                answer_data.get('youtube'),
                now,
                black_type if category == 'black' else None,
                question_id
            ))
            conn.commit()
        finally:
            conn.close()

        return self.get_by_id(question_id)

    def delete(self, question_id):
        """Delete a question and its associated media files."""
        question = self.get_by_id(question_id)
        if not question:
            raise ValueError(f'Question not found: {question_id}')

        # Delete associated media files
        for media in [question.question, question.answer]:
            if media.image:
                self._delete_media_file(media.image)
            if media.audio:
                self._delete_media_file(media.audio)

        conn = self._get_conn()
        try:
            conn.execute('DELETE FROM questions WHERE id = ?', (question_id,))
            conn.commit()
        finally:
            conn.close()

    def delete_all(self):
        """Delete ALL questions and their associated media files."""
        conn = self._get_conn()
        try:
            # Collect all media paths first
            rows = conn.execute(
                'SELECT question_image, question_audio, answer_image, answer_audio FROM questions'
            ).fetchall()
            for row in rows:
                for col in ['question_image', 'question_audio', 'answer_image', 'answer_audio']:
                    if row[col]:
                        self._delete_media_file(row[col])
            # Delete all rows
            conn.execute('DELETE FROM questions')
            conn.commit()
        finally:
            conn.close()

    def _delete_media_file(self, relative_path):
        """
        Delete a media file by its relative path (e.g. 'images/img_xxx.jpg').
        Refuses paths that escape the media folder. Returns True if a file was removed.
        """
        if not relative_path or not isinstance(relative_path, str):
            return False
        media_root = os.path.abspath(self.media_path)
        full_path = os.path.abspath(os.path.join(media_root, relative_path))
        if not full_path.startswith(media_root + os.sep):
            return False
        if os.path.isfile(full_path):
            try:
                os.remove(full_path)
                return True
            except OSError:
                return False
        return False

    def get_stats(self):
        """Get question counts per category and total."""
        conn = self._get_conn()
        try:
            total = conn.execute('SELECT COUNT(*) FROM questions').fetchone()[0]
            rows = conn.execute(
                'SELECT category, COUNT(*) as cnt FROM questions GROUP BY category'
            ).fetchall()
            stats = {cat: 0 for cat in VALID_CATEGORIES}
            for row in rows:
                if row['category'] in stats:
                    stats[row['category']] = row['cnt']
            return {'total': total, 'by_category': stats}
        finally:
            conn.close()

    SORT_OPTIONS = {
        'newest':    'created_at DESC',
        'oldest':    'created_at ASC',
        'modified':  'updated_at DESC',
        'alpha_asc': 'question_text ASC',
        'alpha_desc':'question_text DESC',
        'category':  'category ASC, question_text ASC',
    }

    def search(self, text='', category='', sort='newest'):
        """Search questions by text and/or category with sorting."""
        conn = self._get_conn()
        try:
            query = 'SELECT * FROM questions WHERE 1=1'
            params = []

            if category:
                query += ' AND category = ?'
                params.append(category)

            if text:
                query += ' AND (question_text LIKE ? OR answer_text LIKE ?)'
                like = f'%{text}%'
                params.extend([like, like])

            order = self.SORT_OPTIONS.get(sort, 'created_at DESC')
            query += f' ORDER BY {order}'

            rows = conn.execute(query, params).fetchall()
            return [self._row_to_question(r) for r in rows]
        finally:
            conn.close()

    def find_similar(self, answer_text, threshold=0.5):
        """Find questions with similar answer text using Jaccard similarity (full dicts)."""
        words_new = _word_set(answer_text)
        if not words_new:
            return []

        conn = self._get_conn()
        try:
            rows = conn.execute('SELECT * FROM questions').fetchall()
            similar = []
            for row in rows:
                similarity = _jaccard(words_new, _word_set(row['answer_text']))
                if similarity >= threshold:
                    similar.append({
                        'question': self._row_to_question(row).to_dict(),
                        'similarity': round(similarity * 100)
                    })
            similar.sort(key=lambda x: x['similarity'], reverse=True)
            return similar[:10]
        finally:
            conn.close()

    # --- Bulk similarity (import) ---
    # An "index" is a plain list of entries built once, so a large import
    # doesn't re-query and re-tokenize the whole table for every question.

    @staticmethod
    def make_index_entry(question_id, category, question_text, answer_text):
        return {
            'id': question_id,
            'category': category,
            'question_text': question_text or '',
            'answer_text': answer_text or '',
            'words': _word_set(answer_text),
        }

    def build_answer_index(self):
        """Load a lightweight in-memory index of all questions for similarity checks."""
        conn = self._get_conn()
        try:
            rows = conn.execute(
                'SELECT id, category, question_text, answer_text FROM questions'
            ).fetchall()
            return [
                self.make_index_entry(r['id'], r['category'], r['question_text'], r['answer_text'])
                for r in rows
            ]
        finally:
            conn.close()

    @staticmethod
    def find_similar_in_index(index, answer_text, threshold=0.5, limit=10):
        """
        Same contract as find_similar() but against an in-memory index.
        The 'question' entry is slim (id, category, question.text, answer.text).
        """
        words_new = _word_set(answer_text)
        if not words_new:
            return []

        similar = []
        for entry in index:
            similarity = _jaccard(words_new, entry['words'])
            if similarity >= threshold:
                similar.append({
                    'question': {
                        'id': entry['id'],
                        'category': entry['category'],
                        'question': {'text': entry['question_text']},
                        'answer': {'text': entry['answer_text']},
                    },
                    'similarity': round(similarity * 100)
                })
        similar.sort(key=lambda x: x['similarity'], reverse=True)
        return similar[:limit]

    def is_media_referenced(self, relative_path):
        """True if any question references this media path."""
        if not relative_path:
            return False
        conn = self._get_conn()
        try:
            row = conn.execute(
                '''SELECT 1 FROM questions
                   WHERE question_image = ? OR question_audio = ?
                      OR answer_image = ? OR answer_audio = ?
                   LIMIT 1''',
                (relative_path,) * 4
            ).fetchone()
            return row is not None
        finally:
            conn.close()

    def count(self):
        """Get total question count (fast)."""
        conn = self._get_conn()
        try:
            return conn.execute('SELECT COUNT(*) FROM questions').fetchone()[0]
        finally:
            conn.close()
