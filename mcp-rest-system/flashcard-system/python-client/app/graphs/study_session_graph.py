import logging
from typing import TypedDict, List, Optional, Dict, Any, Callable
from langgraph.graph import StateGraph, END
from app.client.java_client import JavaDataServiceClient
from app.llm.gemini_tutor import GeminiTutor
from app.models.card_models import Flashcard

logger = logging.getLogger("StudySessionGraph")


class StudySessionState(TypedDict):
    """State for Workflow 2: Study Session Graph."""
    due_cards: List[Flashcard]
    current_index: int
    current_card: Optional[Flashcard]
    user_answer: Optional[str]
    evaluation: Optional[Dict[str, Any]]
    updated_cards: List[Flashcard]
    correct_count: int
    incorrect_count: int
    sync_result: Optional[dict]
    error: Optional[str]


def create_study_session_graph(
    java_client: JavaDataServiceClient,
    tutor: GeminiTutor,
    input_handler: Optional[Callable[[Flashcard], str]] = None
):
    """
    Builds and compiles Workflow 2: The "Study Session" Graph.
    Nodes:
    1. Initialize Node (Python -> Java): Requests due cards (GET /api/deck/due).
    2. Select Node: Selects the next due card or transitions to sync when finished.
    3. Human-in-the-Loop Node: Captures student answer.
    4. Evaluate Node: Gemini grades the response and updates Leitner box_number & schedule.
    5. Sync Node (Python -> Java): Sends reconciled cards via POST /api/deck/sync.
    """

    def initialize_node(state: StudySessionState) -> dict:
        logger.info("[Initialize Node] Requesting due flashcards from Java layer (GET /api/deck/due)...")
        try:
            due_cards = java_client.fetch_due_cards()
            logger.info(f"[Initialize Node] Java returned {len(due_cards)} cards due for review.")
            return {
                "due_cards": due_cards,
                "current_index": 0,
                "updated_cards": [],
                "correct_count": 0,
                "incorrect_count": 0,
                "error": None
            }
        except Exception as e:
            logger.error(f"[Initialize Node] Failed to fetch due cards: {e}")
            return {"error": f"Init failed: {str(e)}", "due_cards": []}

    def select_node(state: StudySessionState) -> dict:
        due_cards = state.get("due_cards", [])
        idx = state.get("current_index", 0)

        if idx < len(due_cards):
            card = due_cards[idx]
            logger.info(f"[Select Node] Selected card {idx + 1}/{len(due_cards)}: '{card.question}' (Box {card.box_number})")
            return {"current_card": card, "user_answer": None, "evaluation": None}
        else:
            logger.info("[Select Node] All due cards completed. Ready to synchronize.")
            return {"current_card": None}

    def human_in_the_loop_node(state: StudySessionState) -> dict:
        card = state.get("current_card")
        if not card:
            return {}

        # If answer was already provided in state (e.g., scripted/automated session)
        ans = state.get("user_answer")
        if ans is None:
            if input_handler:
                ans = input_handler(card)
            else:
                # Default CLI input prompt
                print(f"\n" + "="*50)
                print(f"Card {state['current_index'] + 1}/{len(state['due_cards'])} [Box {card.box_number}]")
                print(f"Question: {card.question}")
                print("="*50)
                ans = input("Your Answer: ").strip()

        return {"user_answer": ans}

    def evaluate_node(state: StudySessionState) -> dict:
        card = state.get("current_card")
        user_answer = state.get("user_answer", "")

        if not card:
            return {}

        logger.info(f"[Evaluate Node] Evaluating answer for: '{card.question}'")
        eval_result = tutor.evaluate_answer(card.question, card.answer, user_answer)

        is_correct = eval_result.get("is_correct", False)
        old_box = card.box_number

        if is_correct:
            card.advance_box()
            correct = state.get("correct_count", 0) + 1
            incorrect = state.get("incorrect_count", 0)
            logger.info(f"[Evaluate Node] CORRECT! Promoted card from Box {old_box} -> Box {card.box_number}. Next review: {card.next_review_date}")
        else:
            card.reset_box()
            correct = state.get("correct_count", 0)
            incorrect = state.get("incorrect_count", 0) + 1
            logger.info(f"[Evaluate Node] INCORRECT. Demoted card from Box {old_box} -> Box {card.box_number}. Next review: {card.next_review_date}")

        updated = list(state.get("updated_cards", []))
        updated.append(card)

        return {
            "evaluation": eval_result,
            "updated_cards": updated,
            "correct_count": correct,
            "incorrect_count": incorrect,
            "current_index": state.get("current_index", 0) + 1
        }

    def sync_node(state: StudySessionState) -> dict:
        updated_cards = state.get("updated_cards", [])
        if not updated_cards:
            logger.info("[Sync Node] No updated cards to synchronize.")
            return {"sync_result": {"status": "NO_OP", "message": "No cards updated."}}

        logger.info(f"[Sync Node] Sending {len(updated_cards)} updated cards to Java layer (POST /api/deck/sync)...")
        try:
            sync_resp = java_client.sync_deck(updated_cards)
            logger.info(f"[Sync Node] Java sync complete: {sync_resp.status}, {sync_resp.message}")
            return {"sync_result": sync_resp.model_dump()}
        except Exception as e:
            logger.error(f"[Sync Node] Error during sync with Java layer: {e}")
            return {"error": f"Sync failed: {str(e)}"}

    # Routing logic
    def check_cards_remaining(state: StudySessionState):
        if state.get("error"):
            return "sync"
        idx = state.get("current_index", 0)
        due = state.get("due_cards", [])
        if idx < len(due):
            return "human_in_the_loop"
        return "sync"

    workflow = StateGraph(StudySessionState)

    workflow.add_node("initialize", initialize_node)
    workflow.add_node("select", select_node)
    workflow.add_node("human_in_the_loop", human_in_the_loop_node)
    workflow.add_node("evaluate", evaluate_node)
    workflow.add_node("sync", sync_node)

    workflow.set_entry_point("initialize")

    workflow.add_edge("initialize", "select")
    workflow.add_conditional_edges(
        "select",
        check_cards_remaining,
        {"human_in_the_loop": "human_in_the_loop", "sync": "sync"}
    )
    workflow.add_edge("human_in_the_loop", "evaluate")
    workflow.add_edge("evaluate", "select")
    workflow.add_edge("sync", END)

    return workflow.compile()
