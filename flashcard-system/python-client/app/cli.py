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


# ANSI formatting for premium CLI look
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def print_banner():
    banner = f"""
{CYAN}{BOLD}╔════════════════════════════════════════════════════════════════════════════╗
║             POLYGLOT FLASHCARD SYSTEM (Python + Java + SQLite)             ║
║  AI LangGraph ◄──► SQLite (Local Transactional DB) ◄──► GDrive Docs/Backup ║
╚════════════════════════════════════════════════════════════════════════════╝{RESET}
"""
    print(banner)


def check_java_service(client: JavaDataServiceClient) -> bool:
    print(f"{DIM}Connecting to Java Storage Layer at {client.base_url}...{RESET}", end="", flush=True)
    if client.is_service_ready():
        print(f" {GREEN}[CONNECTED]{RESET}")
        return True
    else:
        print(f" {RED}[DISCONNECTED]{RESET}")
        print(f"{YELLOW}Warning: Java Data Service is not running on {client.base_url}.{RESET}")
        print(f"Please start the Java service using: {CYAN}mvn spring-boot:run{RESET}\n")
        return False


def run_generation_workflow(java_client: JavaDataServiceClient, tutor: GeminiTutor):
    print(f"\n{CYAN}{BOLD}=== Workflow 1: The Generation Graph ==={RESET}")
    doc_id = input(f"Enter Document ID to retrieve [default: doc-sample-1]: ").strip()
    if not doc_id:
        doc_id = "doc-sample-1"

    print(f"\n{DIM}Executing LangGraph Generation Pipeline...{RESET}")
    generation_graph = create_generation_graph(java_client, tutor)

    initial_state = {
        "document_id": doc_id,
        "raw_text": None,
        "draft_cards": [],
        "final_cards": [],
        "sync_result": None,
        "error": None
    }

    result = generation_graph.invoke(initial_state)

    if result.get("error"):
        print(f"{RED}[ERROR] Pipeline failed: {result['error']}{RESET}")
        return

    final_cards = result.get("final_cards", [])
    sync_res = result.get("sync_result", {})

    print(f"\n{GREEN}{BOLD}✓ Generation & Sync Succeeded!{RESET}")
    print(f"Generated and reviewed {BOLD}{len(final_cards)}{RESET} flashcards from document '{doc_id}':")

    for i, card in enumerate(final_cards, 1):
        print(f"\n  {BOLD}Card {i}:{RESET}")
        print(f"    {CYAN}Q:{RESET} {card.question}")
        print(f"    {GREEN}A:{RESET} {card.answer}")
        print(f"    {DIM}Tags:{RESET} {', '.join(card.tags)}")

    print(f"\n{DIM}Java Master Deck Total Cards:{RESET} {sync_res.get('total_deck_cards', 'N/A')}")


def run_study_session_workflow(java_client: JavaDataServiceClient, tutor: GeminiTutor):
    print(f"\n{CYAN}{BOLD}=== Workflow 2: The Study Session Graph ==={RESET}")
    print(f"{DIM}Requesting due cards from Java guardian (GET /api/deck/due)...{RESET}")

    # Custom input handler to print interactive prompts
    def cli_prompt(card: Flashcard) -> str:
        print(f"\n{BOLD}{'─' * 60}{RESET}")
        print(f"{YELLOW}Box {card.box_number}{RESET} | {BOLD}Question:{RESET} {card.question}")
        print(f"{DIM}Tags: {', '.join(card.tags) if card.tags else 'general'}{RESET}")
        print(f"{'─' * 60}")
        ans = input(f"{CYAN}Your Answer:{RESET} ").strip()
        return ans

    session_graph = create_study_session_graph(java_client, tutor, input_handler=cli_prompt)

    initial_state = {
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

    # Run the graph
    result = session_graph.invoke(initial_state)

    if result.get("error"):
        print(f"{RED}[ERROR] Study session error: {result['error']}{RESET}")
        return

    due_cards = result.get("due_cards", [])
    if not due_cards:
        print(f"\n{GREEN}🎉 Great job! No cards are due for review today!{RESET}")
        return

    correct = result.get("correct_count", 0)
    incorrect = result.get("incorrect_count", 0)
    total = correct + incorrect
    acc = (correct / total * 100) if total > 0 else 0

    print(f"\n{CYAN}{BOLD}═══════════════════════════════════════════════════════════════════{RESET}")
    print(f"{GREEN}{BOLD}                  STUDY SESSION SUMMARY                           {RESET}")
    print(f"{CYAN}{BOLD}═══════════════════════════════════════════════════════════════════{RESET}")
    print(f"Cards Studied : {BOLD}{total}{RESET}")
    print(f"Correct       : {GREEN}{correct}{RESET}")
    print(f"Needs Review  : {RED}{incorrect}{RESET}")
    print(f"Accuracy      : {BOLD}{acc:.1f}%{RESET}")

    sync_result = result.get("sync_result", {})
    print(f"Cloud Sync    : {GREEN}{sync_result.get('status', 'OK')}{RESET} ({sync_result.get('message', '')})")
    print(f"{CYAN}{BOLD}═══════════════════════════════════════════════════════════════════{RESET}\n")


def view_deck_status(java_client: JavaDataServiceClient):
    print(f"\n{CYAN}{BOLD}=== Deck & Leitner Box Distribution ==={RESET}")
    try:
        deck = java_client.fetch_master_deck()
        due_cards = java_client.fetch_due_cards()

        boxes = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for c in deck.cards:
            b = min(max(c.box_number, 1), 5)
            boxes[b] += 1

        print(f"\nDeck Name    : {BOLD}{deck.name}{RESET}")
        print(f"Deck ID      : {deck.deck_id}")
        print(f"Total Cards  : {BOLD}{len(deck.cards)}{RESET}")
        print(f"Cards Due Now: {YELLOW}{BOLD}{len(due_cards)}{RESET}")
        print(f"Last Synced  : {deck.last_synced or 'Just now'}")

        print(f"\n{BOLD}Leitner Box Breakdown:{RESET}")
        intervals = {1: "Daily", 2: "3 Days", 3: "7 Days", 4: "14 Days", 5: "30 Days"}
        for b in range(1, 6):
            bar = "█" * boxes[b]
            print(f"  Box {b} ({intervals[b]:<7}): {boxes[b]:>2} cards  {CYAN}{bar}{RESET}")

    except Exception as e:
        print(f"{RED}Failed to fetch deck status: {e}{RESET}")


def manage_storage_and_backup(java_client: JavaDataServiceClient):
    print(f"\n{CYAN}{BOLD}=== 💾 Storage & Backup Management (SQLite & Google Drive) ==={RESET}")
    try:
        status = java_client.fetch_storage_status()
        print(f"\n{BOLD}Architecture Status:{RESET}")
        print(f"  • Transactional DB       : {GREEN}{status.get('transactional_database', 'SQLite')}{RESET}")
        print(f"  • SQLite Database File   : {DIM}{status.get('sqlite_file')}{RESET}")
        print(f"  • Total Deck Cards       : {BOLD}{status.get('total_cards')}{RESET}")
        print(f"  • Master Deck Version    : {status.get('deck_version')}")
        print(f"  • Last Synchronized      : {status.get('last_synced') or 'Never'}")
        print(f"  • Backup Target          : {CYAN}{status.get('backup_target')}{RESET}")
        print(f"  • Document Store         : {CYAN}{status.get('unstructured_document_store')}{RESET}")
        print(f"  • Auto-Sync Backup       : {GREEN if status.get('auto_sync_backup') else YELLOW}{status.get('auto_sync_backup')}{RESET}")
    except Exception as e:
        print(f"{RED}Failed to fetch storage status: {e}{RESET}")
        return

    print(f"\n{BOLD}Actions:{RESET}")
    print(f"  {CYAN}1.{RESET} 📤 Export Snapshot to Google Drive Backup Target (POST /api/deck/backup)")
    print(f"  {CYAN}2.{RESET} 📥 Restore SQLite Database from Google Drive Backup Target (POST /api/deck/restore)")
    print(f"  {CYAN}3.{RESET} ↩ Return to Main Menu")

    action = input(f"\n{BOLD}Select an action [1-3]:{RESET} ").strip()
    if action == "1":
        print(f"{DIM}Exporting snapshot to Google Drive backup target...{RESET}")
        try:
            res = java_client.trigger_backup()
            print(f"{GREEN}✓ Backup Succeeded!{RESET} Backed up {BOLD}{res.get('card_count')}{RESET} cards to Google Drive target.")
        except Exception as e:
            print(f"{RED}[ERROR] Backup failed: {e}{RESET}")
    elif action == "2":
        confirm = input(f"{YELLOW}Warning: This will overwrite local SQLite cards with backup state. Proceed? (y/N): {RESET}").strip().lower()
        if confirm == 'y':
            print(f"{DIM}Restoring from Google Drive backup target...{RESET}")
            try:
                res = java_client.trigger_restore()
                print(f"{GREEN}✓ Restore Succeeded!{RESET} Restored {BOLD}{res.get('restored_card_count')}{RESET} cards into SQLite.")
            except Exception as e:
                print(f"{RED}[ERROR] Restore failed: {e}{RESET}")
        else:
            print("Restore cancelled.")


def main():
    print_banner()
    java_client = JavaDataServiceClient()
    tutor = GeminiTutor()

    check_java_service(java_client)

    while True:
        print(f"\n{BOLD}Main Menu:{RESET}")
        print(f"  {CYAN}1.{RESET} 📄 Generate Cards from Document {DIM}(Workflow 1: Generation Graph){RESET}")
        print(f"  {CYAN}2.{RESET} 🧠 Start Study Session          {DIM}(Workflow 2: Study Session Graph){RESET}")
        print(f"  {CYAN}3.{RESET} 📊 View Master Deck Status      {DIM}(Leitner Distribution & Due Count){RESET}")
        print(f"  {CYAN}4.{RESET} 💾 Storage & Backup Management  {DIM}(SQLite & Google Drive Architecture){RESET}")
        print(f"  {CYAN}5.{RESET} 🚪 Exit")

        choice = input(f"\n{BOLD}Select an option [1-5]:{RESET} ").strip()

        if choice == "1":
            run_generation_workflow(java_client, tutor)
        elif choice == "2":
            run_study_session_workflow(java_client, tutor)
        elif choice == "3":
            view_deck_status(java_client)
        elif choice == "4":
            manage_storage_and_backup(java_client)
        elif choice == "5":
            print(f"\n{CYAN}Goodbye! Happy learning!{RESET}\n")
            break
        else:
            print(f"{RED}Invalid option, please choose between 1 and 5.{RESET}")


if __name__ == "__main__":
    main()

