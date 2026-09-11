from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid


class Flashcard(BaseModel):
    """
    Python Pydantic model matching the Java Flashcard POJO contract.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    answer: str
    box_number: int = Field(default=1, ge=1, le=5)
    last_reviewed: Optional[str] = None
    next_review_date: Optional[str] = Field(default_factory=lambda: date.today().isoformat())
    tags: List[str] = Field(default_factory=list)
    source_document_id: Optional[str] = None

    def advance_box(self) -> None:
        """Advance to next Leitner box on correct answer and schedule future review."""
        self.box_number = min(self.box_number + 1, 5)
        self.last_reviewed = date.today().isoformat()
        intervals = {1: 1, 2: 3, 3: 7, 4: 14, 5: 30}
        days_ahead = intervals.get(self.box_number, 1)
        from datetime import timedelta
        self.next_review_date = (date.today() + timedelta(days=days_ahead)).isoformat()

    def reset_box(self) -> None:
        """Reset to Leitner Box 1 on incorrect answer."""
        self.box_number = 1
        self.last_reviewed = date.today().isoformat()
        from datetime import timedelta
        self.next_review_date = (date.today() + timedelta(days=1)).isoformat()


class DocumentResponse(BaseModel):
    id: str
    name: str
    content: str
    mime_type: Optional[str] = "text/plain"


class SyncResponse(BaseModel):
    status: str
    message: str
    synced_count: int
    total_deck_cards: int
    timestamp: Optional[str] = None


class Deck(BaseModel):
    deck_id: str = "master-deck"
    name: str = "Personal Study Deck"
    version: int = 1
    last_synced: Optional[str] = None
    cards: List[Flashcard] = Field(default_factory=list)
