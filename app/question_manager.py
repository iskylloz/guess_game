import os
import sqlite3
from datetime import datetime, timezone

from app.models import Question, MediaContent, VALID_CATEGORIES
from app.utils import generate_id


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
                    updated_at TEXT NOT NULL
                )
            ''')
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
            updated_at=row['updated_at']
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
             answer_text, answer_image, answer_audio, answer_youtube, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            question.id, question.category,
            question.question.text, question.question.image,
            question.question.audio, question.question.youtube,
            question.answer.text, question.answer.image,
            question.answer.audio, question.answer.youtube,
            question.created_at, question.updated_at
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

    def create(self, category, question_data, answer_data):
        """Create a new question and return it."""
        if category not in VALID_CATEGORIES:
            raise ValueError(f'Invalid category: {category}')

        question = Question(
            id=generate_id('q'),
            category=category,
            question=MediaContent(
                text=question_data.get('text', ''),
                image=question_data.get('image'),
                audio=question_data.get('audio'),
                youtube=question_data.get('youtube')
            ),
            answer=MediaContent(
                text=answer_data.get('text', ''),
                image=answer_data.get('image'),
                audio=answer_data.get('audio'),
                youtube=answer_data.get('youtube')
            )
        )

        conn = self._get_conn()
        try:
            self._insert_question(conn, question)
            conn.commit()
        finally:
            conn.close()

        return question

    def update(self, question_id, category, question_data, answer_data):
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
                    answer_youtube=?, updated_at=?
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
        """Delete a media file by its relative path (e.g. 'images/img_xxx.jpg')."""
        if not relative_path:
            return
        full_path = os.path.join(self.media_path, relative_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except OSError:
                pass

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
        """Find questions with similar answer text using Jaccard similarity."""
        words_new = set(answer_text.lower().split())
        if not words_new:
            return []

        conn = self._get_conn()
        try:
            rows = conn.execute(
                'SELECT * FROM questions'
            ).fetchall()

            similar = []
            for row in rows:
                words_existing = set(row['answer_text'].lower().split())
                if not words_existing:
                    continue
                intersection = words_new & words_existing
                union = words_new | words_existing
                similarity = len(intersection) / len(union) if union else 0
                if similarity >= threshold:
                    q = self._row_to_question(row)
                    similar.append({
                        'question': q.to_dict(),
                        'similarity': round(similarity * 100)
                    })

            similar.sort(key=lambda x: x['similarity'], reverse=True)
            return similar[:10]
        finally:
            conn.close()

    def count(self):
        """Get total question count (fast)."""
        conn = self._get_conn()
        try:
            return conn.execute('SELECT COUNT(*) FROM questions').fetchone()[0]
        finally:
            conn.close()
