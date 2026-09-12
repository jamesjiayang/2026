import os
import sys
from dotenv import load_dotenv

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Ensure root package directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

load_dotenv()

from app.client.java_client import JavaDataServiceClient
from app.llm.gemini_tutor import GeminiTutor
from app.graphs.generation_graph import create_generation_graph
from app.graphs.study_session_graph import create_study_session_graph
from app.models.card_models import Flashcard


def run_e2e_tests():
    print("\n" + "=" * 70)
    print("      RUNNING END-TO-END VERIFICATION: POLYGLOT FLASHCARD SYSTEM     ")
    print("=" * 70)

    java_client = JavaDataServiceClient()
    tutor = GeminiTutor()

    # Step 1: Health & Connectivity Check
    print("\n[Step 1] Checking connectivity to Java Storage Service...")
    assert java_client.is_service_ready(), (
        f"Java service not reachable at {java_client.base_url}. Make sure it is running!"
    )
    print("  [OK] Java Service is UP and responding.")

    # Step 2: Document Retrieval via Java REST API
    print("\n[Step 2] Testing Document Retrieval (GET /api/documents/doc-sample-1)...")
    doc = java_client.fetch_document("doc-sample-1")
    assert doc is not None, "Failed to retrieve doc-sample-1"
    assert len(doc.content) > 50, "Document content too short"
    print(f"  [OK] Retrieved document '{doc.name}' ({len(doc.content)} chars)")

    # Step 3: Workflow 1 - The Generation Graph
    print("\n[Step 3] Testing Workflow 1: The Generation Graph...")
    gen_graph = create_generation_graph(java_client, tutor)
    initial_gen_state = {
        "document_id": "doc-sample-1",
        "raw_text": None,
        "draft_cards": [],
        "final_cards": [],
        "sync_result": None,
        "error": None
    }
    gen_result = gen_graph.invoke(initial_gen_state)
    assert gen_result.get("error") is None, f"Generation Graph error: {gen_result.get('error')}"
    final_cards = gen_result.get("final_cards", [])
    sync_res = gen_result.get("sync_result", {})

    assert len(final_cards) > 0, "No cards generated"
    assert sync_res.get("status") == "SUCCESS", f"Sync failed: {sync_res}"
    print(f"  [OK] Generation Graph completed: {len(final_cards)} cards generated and synced with Java.")
    print(f"       First card question: '{final_cards[0].question}'")

    # Step 4: Workflow 2 - The Study Session Graph
    print("\n[Step 4] Testing Workflow 2: The Study Session Graph...")
    def mock_answer_handler(card: Flashcard) -> str:
        if "cap" in card.question.lower():
            return "Consistency, Availability, and Partition tolerance in network partitions."
        elif "raft" in card.question.lower():
            return "Follower, Candidate, and Leader states."
        return "I am not completely sure about this answer."

    study_graph = create_study_session_graph(java_client, tutor, input_handler=mock_answer_handler)
    initial_study_state = {
        "due_cards": [],
        "current_index": 0,
        "current_card": None,
        "user_answer": None,
        "evaluation": None,
        "updated_cards": [],
        "correct_count": 0,
        "incorrect_count": 0,
        "sync_result": None,
        "error": None
    }
    study_result = study_graph.invoke(initial_study_state)
    assert study_result.get("error") is None, f"Study Session error: {study_result.get('error')}"

    due_cards = study_result.get("due_cards", [])
    updated_cards = study_result.get("updated_cards", [])
    study_sync = study_result.get("sync_result", {})

    print(f"  [OK] Study Session Graph completed:")
    print(f"       Due cards retrieved : {len(due_cards)}")
    print(f"       Cards evaluated     : {len(updated_cards)}")
    print(f"       Correct count       : {study_result.get('correct_count')}")
    print(f"       Incorrect count     : {study_result.get('incorrect_count')}")
    print(f"       Java Sync Result    : {study_sync.get('status')}")

    # Step 5: Verify Reconciliation on Master Deck in SQLite
    print("\n[Step 5] Verifying Master Deck persistence and POJO state in SQLite...")
    deck = java_client.fetch_master_deck()
    assert len(deck.cards) >= len(final_cards), "Deck card count does not reflect merged cards"
    print(f"  [OK] Master Deck in SQLite currently has {len(deck.cards)} cards. Version: {deck.version}")

    # Step 6: Verify Architecture Telemetry (SQLite + Google Drive)
    print("\n[Step 6] Verifying SQLite Engine Telemetry & Google Drive targets...")
    status = java_client.fetch_storage_status()
    assert status.get("transactional_database") == "SQLite", "Expected SQLite as transactional database"
    assert status.get("total_cards") == len(deck.cards), "Status card count mismatch"
    assert "backup_target" in status, "Missing backup_target in status"
    assert "unstructured_document_store" in status, "Missing unstructured_document_store in status"
    print(f"  [OK] Transactional DB: {status.get('transactional_database')} ({status.get('sqlite_file')})")
    print(f"       Backup Target   : {status.get('backup_target')}")
    print(f"       Document Store  : {status.get('unstructured_document_store')}")

    # Step 7: Verify Backup & Restore Cycle with Google Drive Target
    print("\n[Step 7] Testing Backup & Restore Lifecycle with Google Drive target...")
    backup_res = java_client.trigger_backup()
    assert backup_res.get("status") == "SUCCESS", f"Backup failed: {backup_res}"
    assert backup_res.get("card_count") == len(deck.cards), "Backup card count mismatch"
    print(f"  [OK] Successfully exported {backup_res.get('card_count')} cards to Google Drive backup target.")

    restore_res = java_client.trigger_restore()
    assert restore_res.get("status") == "SUCCESS", f"Restore failed: {restore_res}"
    assert restore_res.get("restored_card_count") == len(deck.cards), "Restore card count mismatch"
    restored_deck = java_client.fetch_master_deck()
    assert len(restored_deck.cards) == len(deck.cards), "Restored deck count mismatch"
    print(f"  [OK] Successfully restored SQLite database from Google Drive target ({len(restored_deck.cards)} cards).")

    print("\n" + "=" * 70)
    print("      ALL END-TO-END INTEGRATION TESTS PASSED SUCCESSFULLY!         ")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    run_e2e_tests()

