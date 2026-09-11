import json
import logging
import os
import re
from typing import List, Dict, Any, Tuple
from app.models.card_models import Flashcard

logger = logging.getLogger("GeminiTutor")


class GeminiTutor:
    """
    AI Processing Engine powered by Google Gemini (with deterministic fallback).
    Handles:
    - Flashcard draft generation from raw source text
    - Flashcard review and refinement
    - Spaced-repetition answer evaluation & grading
    """

    def __init__(self, api_key: str = None, model_name: str = "gemini-2.5-flash"):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model_name = model_name or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.client = None

        if self.api_key and self.api_key.strip():
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key.strip())
                logger.info(f"Gemini client initialized with model {self.model_name}")
            except Exception as e:
                logger.warning(f"Could not initialize Google GenAI client: {e}. Running in local simulation mode.")
                self.client = None
        else:
            logger.info("No GEMINI_API_KEY provided. Using local intelligent tutor simulator.")

    def generate_cards(self, raw_text: str, document_id: str = "doc") -> List[Flashcard]:
        """
        Generates draft flashcards from raw document text.
        """
        if self.client:
            try:
                prompt = f"""
You are an expert tutor creating study flashcards.
Given the following educational text, generate 3 to 5 high-yield, conceptual flashcards.
Format your output strictly as a JSON array of objects with keys "question", "answer", and "tags".
Do not include markdown backticks around the json or any commentary.

Document Text:
{raw_text}
"""
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                )
                text = response.text.strip()
                # Clean up any potential markdown formatting
                if text.startswith("```"):
                    text = re.sub(r"^```(?:json)?\s*", "", text)
                    text = re.sub(r"\s*```$", "", text)
                
                items = json.loads(text)
                cards = []
                for item in items:
                    card = Flashcard(
                        question=item["question"],
                        answer=item["answer"],
                        tags=item.get("tags", ["generated", document_id]),
                        source_document_id=document_id
                    )
                    cards.append(card)
                logger.info(f"Gemini generated {len(cards)} draft cards.")
                return cards
            except Exception as e:
                logger.error(f"Gemini generation call failed: {e}. Falling back to rule-based extractor.")

        # Fallback heuristic generator
        return self._fallback_generate_cards(raw_text, document_id)

    def review_cards(self, draft_cards: List[Flashcard]) -> List[Flashcard]:
        """
        Reviews and refines draft flashcards for conciseness and clarity.
        """
        if self.client and draft_cards:
            try:
                cards_json = json.dumps([{"question": c.question, "answer": c.answer} for c in draft_cards])
                prompt = f"""
Review and polish these draft flashcards for maximum clarity, conciseness, and precision.
Return strictly a JSON array of objects with "question" and "answer".
No commentary, no markdown code blocks.

Drafts:
{cards_json}
"""
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                )
                text = response.text.strip()
                if text.startswith("```"):
                    text = re.sub(r"^```(?:json)?\s*", "", text)
                    text = re.sub(r"\s*```$", "", text)

                items = json.loads(text)
                reviewed = []
                for i, item in enumerate(items):
                    orig = draft_cards[min(i, len(draft_cards)-1)]
                    reviewed.append(Flashcard(
                        id=orig.id,
                        question=item["question"],
                        answer=item["answer"],
                        box_number=orig.box_number,
                        tags=orig.tags + ["reviewed"],
                        source_document_id=orig.source_document_id
                    ))
                logger.info(f"Gemini reviewed {len(reviewed)} cards.")
                return reviewed
            except Exception as e:
                logger.warning(f"Gemini review call failed: {e}. Using sanitized drafts.")

        # Fallback: sanitize and trim cards
        for card in draft_cards:
            card.question = card.question.strip()
            card.answer = card.answer.strip()
            if "reviewed" not in card.tags:
                card.tags.append("reviewed")
        return draft_cards

    def evaluate_answer(self, question: str, reference_answer: str, user_answer: str) -> Dict[str, Any]:
        """
        Evaluates the user's answer against the reference flashcard answer.
        Returns a dictionary with:
        - is_correct: bool
        - feedback: str
        - score: int (0 to 100)
        """
        if self.client:
            try:
                prompt = f"""
You are an encouraging and rigorous AI tutor evaluating a student's answer to a flashcard.
Flashcard Question: {question}
Reference Answer: {reference_answer}
Student Answer: {user_answer}

Evaluate if the student demonstrates understanding of the core concept.
Format your output strictly as a JSON object with:
{{
  "is_correct": true or false,
  "score": integer between 0 and 100,
  "feedback": "constructive 1-2 sentence feedback explaining what was right or missing"
}}
Do not include markdown fences or any other text.
"""
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                )
                text = response.text.strip()
                if text.startswith("```"):
                    text = re.sub(r"^```(?:json)?\s*", "", text)
                    text = re.sub(r"\s*```$", "", text)

                data = json.loads(text)
                return {
                    "is_correct": bool(data.get("is_correct", False)),
                    "score": int(data.get("score", 75 if data.get("is_correct") else 30)),
                    "feedback": data.get("feedback", "Good effort!")
                }
            except Exception as e:
                logger.warning(f"Gemini evaluation failed: {e}. Using semantic heuristic evaluation.")

        # Heuristic evaluator
        return self._fallback_evaluate_answer(reference_answer, user_answer)

    def _fallback_generate_cards(self, raw_text: str, document_id: str) -> List[Flashcard]:
        cards = []
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        
        # Look for headers or bullet points
        for i, line in enumerate(lines):
            if ":" in line and len(line) > 15:
                parts = line.split(":", 1)
                q = f"What is {parts[0].strip(' -#1234567890.')}?"
                a = parts[1].strip()
                if len(a) > 10:
                    cards.append(Flashcard(
                        question=q,
                        answer=a,
                        tags=["extracted", document_id],
                        source_document_id=document_id
                    ))
            elif line.startswith("#"):
                topic = line.strip("# ")
                if i + 1 < len(lines):
                    next_line = lines[i + 1]
                    if not next_line.startswith("#") and len(next_line) > 20:
                        cards.append(Flashcard(
                            question=f"Define or explain {topic}:",
                            answer=next_line,
                            tags=["extracted", document_id],
                            source_document_id=document_id
                        ))

        if not cards:
            cards.append(Flashcard(
                question=f"Summary of document {document_id}:",
                answer=raw_text[:200] + "...",
                tags=["summary", document_id],
                source_document_id=document_id
            ))
        return cards[:5]

    def _fallback_evaluate_answer(self, reference_answer: str, user_answer: str) -> Dict[str, Any]:
        ref_words = set(re.findall(r'\w+', reference_answer.lower()))
        usr_words = set(re.findall(r'\w+', user_answer.lower()))

        # Remove common stop words
        stop_words = {"the", "a", "an", "is", "are", "and", "or", "in", "on", "of", "to", "for", "with", "it", "that", "this"}
        ref_keywords = ref_words - stop_words
        usr_keywords = usr_words - stop_words

        if not ref_keywords:
            overlap_ratio = 1.0
        else:
            overlap = ref_keywords.intersection(usr_keywords)
            overlap_ratio = len(overlap) / len(ref_keywords)

        is_correct = overlap_ratio >= 0.35 or len(user_answer.strip()) > 20 and overlap_ratio >= 0.20
        score = int(min(100, max(20, overlap_ratio * 100 + 20)))

        if is_correct:
            feedback = f"Great work! Your answer captured key concepts. Reference: {reference_answer}"
        else:
            feedback = f"Not quite. Key points to remember: {reference_answer}"

        return {
            "is_correct": is_correct,
            "score": score,
            "feedback": feedback
        }
