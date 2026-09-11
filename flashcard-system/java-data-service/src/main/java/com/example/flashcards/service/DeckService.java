package com.example.flashcards.service;

import com.example.flashcards.model.Deck;
import com.example.flashcards.model.Flashcard;
import com.example.flashcards.model.SyncResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Business logic guardian for Flashcards and Decks.
 * Strictly enforces POJO schema validation, Stream-based due filtering, and safe cloud reconciliation.
 */
@Service
public class DeckService {

    private static final Logger log = LoggerFactory.getLogger(DeckService.class);

    private final DriveStorageService storageManager;

    public DeckService(DriveStorageService storageManager) {
        this.storageManager = storageManager;
    }

    /**
     * Reads the master deck from storage.
     */
    public Deck getMasterDeck() throws IOException {
        return storageManager.readDeck();
    }

    /**
     * Workflow 2 filter logic:
     * Reads my_deck.json via StorageManager, uses Java Streams to filter cards where
     * next_review_date is today or earlier, and returns only those due cards to Python.
     */
    public List<Flashcard> getDueCards() throws IOException {
        Deck deck = storageManager.readDeck();
        LocalDate today = LocalDate.now();

        List<Flashcard> dueCards = deck.getCards().stream()
                .filter(Objects::nonNull)
                .filter(card -> card.getNextReviewDate() == null || !card.getNextReviewDate().isAfter(today))
                .sorted(Comparator.comparing(Flashcard::getBoxNumber)
                        .thenComparing(c -> c.getNextReviewDate() != null ? c.getNextReviewDate() : LocalDate.MIN))
                .collect(Collectors.toList());

        log.info("Calculated due cards for date {}: found {} due cards out of {} total cards in master deck.",
                today, dueCards.size(), deck.getCards().size());

        return dueCards;
    }

    /**
     * Merges updated or newly generated cards into the master deck.
     * Enforces validation:
     * - Validates non-empty question and answer
     * - Clamps boxNumber between 1 and 5
     * - Ensures valid UUID and dates
     * Reconciles in-memory and pushes to Drive.
     */
    public synchronized SyncResponse syncCards(List<Flashcard> incomingCards) throws IOException {
        if (incomingCards == null || incomingCards.isEmpty()) {
            Deck current = storageManager.readDeck();
            return new SyncResponse("NO_OP", "No cards provided to sync.", 0, current.getCards().size());
        }

        Deck masterDeck = storageManager.readDeck();
        if (masterDeck.getCards() == null) {
            masterDeck.setCards(new ArrayList<>());
        }

        Map<String, Flashcard> existingCardsMap = new LinkedHashMap<>();
        for (Flashcard card : masterDeck.getCards()) {
            if (card.getId() != null) {
                existingCardsMap.put(card.getId(), card);
            }
        }

        int syncedCount = 0;
        for (Flashcard incoming : incomingCards) {
            if (incoming == null) {
                continue;
            }

            // Strictly validate data
            validateAndSanitize(incoming);

            if (existingCardsMap.containsKey(incoming.getId())) {
                // Update existing card in place
                Flashcard existing = existingCardsMap.get(incoming.getId());
                existing.setBoxNumber(incoming.getBoxNumber());
                existing.setLastReviewed(incoming.getLastReviewed() != null ? incoming.getLastReviewed() : LocalDate.now());
                existing.setNextReviewDate(incoming.getNextReviewDate());
                if (incoming.getQuestion() != null && !incoming.getQuestion().isBlank()) {
                    existing.setQuestion(incoming.getQuestion().trim());
                }
                if (incoming.getAnswer() != null && !incoming.getAnswer().isBlank()) {
                    existing.setAnswer(incoming.getAnswer().trim());
                }
                if (incoming.getTags() != null && !incoming.getTags().isEmpty()) {
                    existing.setTags(incoming.getTags());
                }
                log.debug("Reconciled existing card: id={}, box={}", existing.getId(), existing.getBoxNumber());
            } else {
                // Brand new card: assign UUID if missing and add to map
                if (incoming.getId() == null || incoming.getId().isBlank()) {
                    incoming.setId(UUID.randomUUID().toString());
                }
                existingCardsMap.put(incoming.getId(), incoming);
                log.debug("Appended new card: id={}, question='{}'", incoming.getId(), incoming.getQuestion());
            }
            syncedCount++;
        }

        // Reconstruct master deck list
        masterDeck.setCards(new ArrayList<>(existingCardsMap.values()));
        masterDeck.setLastSynced(Instant.now());
        masterDeck.setVersion(masterDeck.getVersion() + 1);

        // Upload and sync state back to Google Drive / storage
        storageManager.writeDeck(masterDeck);

        log.info("Sync complete: {} cards processed, total cards now {} in master deck.",
                syncedCount, masterDeck.getCards().size());

        return new SyncResponse("SUCCESS", "Deck safely synchronized with Drive.", syncedCount, masterDeck.getCards().size());
    }

    private void validateAndSanitize(Flashcard card) {
        if (card.getQuestion() == null || card.getQuestion().isBlank()) {
            throw new IllegalArgumentException("Flashcard question cannot be empty or null.");
        }
        if (card.getAnswer() == null || card.getAnswer().isBlank()) {
            throw new IllegalArgumentException("Flashcard answer cannot be empty or null.");
        }

        // Clamp box number between 1 and 5 (Leitner system)
        if (card.getBoxNumber() < 1) {
            card.setBoxNumber(1);
        } else if (card.getBoxNumber() > 5) {
            card.setBoxNumber(5);
        }

        // Default next review date if null
        if (card.getNextReviewDate() == null) {
            card.setNextReviewDate(LocalDate.now());
        }
    }
}
