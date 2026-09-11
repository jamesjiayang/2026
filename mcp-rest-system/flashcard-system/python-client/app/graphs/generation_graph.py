import logging
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END
from app.client.java_client import JavaDataServiceClient
from app.llm.gemini_tutor import GeminiTutor
from app.models.card_models import Flashcard

logger = logging.getLogger("GenerationGraph")


class GenerationState(TypedDict):
    """State for Workflow 1: Flashcard Generation Graph."""
    document_id: str
    raw_text: Optional[str]
    draft_cards: List[Flashcard]
    final_cards: List[Flashcard]
    sync_result: Optional[dict]
    error: Optional[str]


def create_generation_graph(java_client: JavaDataServiceClient, tutor: GeminiTutor):
    """
    Builds and compiles Workflow 1: The "Generation" Graph.
    Nodes:
    1. Retrieve Node (Python -> Java): Fetches document text from Java service.
    2. Generate Node (Python): Gemini processes raw text into draft flashcards.
    3. Review Node (Python): Gemini reviews and refines draft flashcards.
    4. Save Node (Python -> Java): Sends approved final_cards to Java sync endpoint.
    """

    def retrieve_node(state: GenerationState) -> dict:
        doc_id = state.get("document_id")
        logger.info(f"[Retrieve Node] Fetching document '{doc_id}' from Java layer...")
        try:
            doc_resp = java_client.fetch_document(doc_id)
            return {"raw_text": doc_resp.content, "error": None}
        except Exception as e:
            logger.error(f"[Retrieve Node] Error fetching document: {e}")
            return {"error": f"Retrieve failed: {str(e)}"}

    def generate_node(state: GenerationState) -> dict:
        if state.get("error"):
            return {}
        raw_text = state.get("raw_text", "")
        doc_id = state.get("document_id", "doc")
        logger.info(f"[Generate Node] Processing {len(raw_text)} characters of text with Gemini...")
        try:
            drafts = tutor.generate_cards(raw_text, doc_id)
            return {"draft_cards": drafts}
        except Exception as e:
            logger.error(f"[Generate Node] Error generating cards: {e}")
            return {"error": f"Generation failed: {str(e)}"}

    def review_node(state: GenerationState) -> dict:
        if state.get("error"):
            return {}
        drafts = state.get("draft_cards", [])
        logger.info(f"[Review Node] Reviewing and refining {len(drafts)} draft cards...")
        try:
            reviewed = tutor.review_cards(drafts)
            return {"final_cards": reviewed}
        except Exception as e:
            logger.error(f"[Review Node] Error reviewing cards: {e}")
            return {"final_cards": drafts}

    def save_node(state: GenerationState) -> dict:
        if state.get("error"):
            return {}
        final_cards = state.get("final_cards", [])
        logger.info(f"[Save Node] Sending {len(final_cards)} final approved cards to Java layer...")
        try:
            sync_resp = java_client.sync_deck(final_cards)
            logger.info(f"[Save Node] Java sync status: {sync_resp.status}, total deck cards: {sync_resp.total_deck_cards}")
            return {"sync_result": sync_resp.model_dump()}
        except Exception as e:
            logger.error(f"[Save Node] Error saving cards to Java service: {e}")
            return {"error": f"Save failed: {str(e)}"}

    # Route conditionally if error occurs
    def check_error(state: GenerationState):
        if state.get("error"):
            return END
        return "continue"

    workflow = StateGraph(GenerationState)

    workflow.add_node("retrieve", retrieve_node)
    workflow.add_node("generate", generate_node)
    workflow.add_node("review", review_node)
    workflow.add_node("save", save_node)

    workflow.set_entry_point("retrieve")

    workflow.add_conditional_edges(
        "retrieve",
        check_error,
        {"continue": "generate", END: END}
    )
    workflow.add_conditional_edges(
        "generate",
        check_error,
        {"continue": "review", END: END}
    )
    workflow.add_edge("review", "save")
    workflow.add_edge("save", END)

    return workflow.compile()
