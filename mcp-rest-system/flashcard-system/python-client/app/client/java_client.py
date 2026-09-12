import logging
import os
from typing import List, Optional
import requests
from app.models.card_models import Flashcard, DocumentResponse, SyncResponse, Deck

logger = logging.getLogger("JavaDataServiceClient")


class JavaDataServiceClient:
    """
    Client for the Java Storage Layer.
    Adheres strictly to the Java-Python REST contract:
    - GET /api/documents/{id} -> Raw document text
    - GET /api/deck/due -> Cards due today or earlier (filtered via Java Streams)
    - POST /api/deck/sync -> Sync updated cards into Google Drive master deck
    - GET /api/deck -> Retrieve complete master deck
    """

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or os.getenv("JAVA_SERVICE_URL", "http://localhost:8080")).rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json", "Accept": "application/json"})

    def is_service_ready(self) -> bool:
        """Check if Java REST service is reachable."""
        try:
            resp = self.session.get(f"{self.base_url}/api/deck", timeout=3)
            return resp.status_code == 200
        except Exception:
            return False

    def fetch_document(self, document_id: str) -> DocumentResponse:
        """
        Calls Java service: GET /api/documents/{id}
        """
        url = f"{self.base_url}/api/documents/{document_id}"
        logger.info(f"Fetching document from Java layer: {url}")
        resp = self.session.get(url, timeout=10)

        if resp.status_code != 200:
            raise RuntimeError(f"Failed to fetch document '{document_id}' from Java service: {resp.status_code} - {resp.text}")

        data = resp.json()
        return DocumentResponse(**data)

    def fetch_due_cards(self) -> List[Flashcard]:
        """
        Calls Java service: GET /api/deck/due
        Java calculates due cards based on timestamp and returns only those cards.
        """
        url = f"{self.base_url}/api/deck/due"
        logger.info(f"Requesting due study session cards: {url}")
        resp = self.session.get(url, timeout=10)

        if resp.status_code != 200:
            raise RuntimeError(f"Failed to fetch due cards from Java service: {resp.status_code} - {resp.text}")

        items = resp.json()
        return [Flashcard(**item) for item in items]

    def sync_deck(self, cards: List[Flashcard]) -> SyncResponse:
        """
        Calls Java service: POST /api/deck/sync
        Python sends updated cards, and Java merges them safely into the Drive file.
        """
        url = f"{self.base_url}/api/deck/sync"
        payload = {"cards": [card.model_dump() for card in cards]}
        logger.info(f"Syncing {len(cards)} cards with Java layer: {url}")
        resp = self.session.post(url, json=payload, timeout=15)

        if resp.status_code != 200:
            raise RuntimeError(f"Failed to sync cards with Java service: {resp.status_code} - {resp.text}")

        return SyncResponse(**resp.json())

    def fetch_master_deck(self) -> Deck:
        """
        Calls Java service: GET /api/deck
        Retrieves full master deck metadata and all cards.
        """
        url = f"{self.base_url}/api/deck"
        resp = self.session.get(url, timeout=10)

        if resp.status_code != 200:
            raise RuntimeError(f"Failed to fetch master deck from Java service: {resp.status_code} - {resp.text}")

        return Deck(**resp.json())

    def trigger_backup(self) -> dict:
        """
        Calls Java service: POST /api/deck/backup
        Exports SQLite master deck snapshot to Google Drive backup target.
        """
        url = f"{self.base_url}/api/deck/backup"
        logger.info(f"Triggering backup to Google Drive target: {url}")
        resp = self.session.post(url, timeout=15)
        if resp.status_code != 200:
            raise RuntimeError(f"Backup failed: {resp.status_code} - {resp.text}")
        return resp.json()

    def trigger_restore(self) -> dict:
        """
        Calls Java service: POST /api/deck/restore
        Restores SQLite master deck from Google Drive backup target.
        """
        url = f"{self.base_url}/api/deck/restore"
        logger.info(f"Triggering restore from Google Drive target: {url}")
        resp = self.session.post(url, timeout=15)
        if resp.status_code != 200:
            raise RuntimeError(f"Restore failed: {resp.status_code} - {resp.text}")
        return resp.json()

    def fetch_storage_status(self) -> dict:
        """
        Calls Java service: GET /api/deck/status
        Retrieves storage engine telemetry (SQLite file, card count, Google Drive status).
        """
        url = f"{self.base_url}/api/deck/status"
        resp = self.session.get(url, timeout=5)
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to fetch storage status: {resp.status_code} - {resp.text}")
        return resp.json()

