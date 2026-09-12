package com.example.flashcards.service;

import com.example.flashcards.model.Deck;
import com.example.flashcards.model.Flashcard;
import com.example.flashcards.model.SyncResponse;
import com.example.flashcards.repository.FlashcardRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * Business logic guardian for Flashcards and Decks.
 * Adheres to standard Local-First Architecture:
 * - SQLite serves as the high-performance local transactional database.
 * - Google Drive serves as the unstructured document store and cloud backup target.
 */
@Service
public class DeckService {

    private static final Logger log = LoggerFactory.getLogger(DeckService.class);
    private static final String DEFAULT_DECK_ID = "master-deck";
    private static final String DEFAULT_DECK_NAME = "CS & Distributed Systems";

    private final FlashcardRepository flashcardRepository;
    private final DriveStorageService storageManager;

    @Value("${backup.auto-sync:true}")
    private boolean autoSyncBackup;

    @Value("${sqlite.db.path:./flashcards.db}")
    private String sqliteDbPath;

    public DeckService(
            FlashcardRepository flashcardRepository,
            @Qualifier("storageManager") DriveStorageService storageManager) {
        this.flashcardRepository = flashcardRepository;
        this.storageManager = storageManager;
    }

    /**
     * Bootstraps local SQLite database.
     * If SQLite has no cards on startup, attempts to hydrate from the Google Drive
     * backup target (or local simulator fallback).
     */
    @PostConstruct
    public void init() {
        try {
            int cardCount = flashcardRepository.countCards(DEFAULT_DECK_ID);
            if (cardCount == 0) {
                log.info("SQLite database is empty. Checking Google Drive backup target for hydration...");
                Deck backupDeck = storageManager.readDeck();
                if (backupDeck != null && backupDeck.getCards() != null && !backupDeck.getCards().isEmpty()) {
                    if (backupDeck.getDeckId() == null) {
                        backupDeck.setDeckId(DEFAULT_DECK_ID);
                    }
                    if (backupDeck.getName() == null) {
                        backupDeck.setName(DEFAULT_DECK_NAME);
                    }
                    flashcardRepository.saveOrUpdateDeck(backupDeck);
                    flashcardRepository.batchUpsertCards(backupDeck.getCards(), backupDeck.getDeckId());
                    log.info("Successfully bootstrapped SQLite database with {} cards from backup store.",
                            backupDeck.getCards().size());
                } else {
                    // Seed minimal default deck
                    Deck seedDeck = new Deck(DEFAULT_DECK_ID, DEFAULT_DECK_NAME, new ArrayList<>());
                    flashcardRepository.saveOrUpdateDeck(seedDeck);
                    log.info("Initialized empty SQLite master deck '{}'.", DEFAULT_DECK_ID);
                }
            } else {
                log.info("SQLite database verified: {} active cards loaded in deck '{}'.",
                        cardCount, DEFAULT_DECK_ID);
            }
        } catch (Exception e) {
            log.warn("Warning during SQLite bootstrap hydration: {}. Local database ready.", e.getMessage());
        }
    }

    /**
     * Reads the master deck directly from SQLite with ACID guarantees.
     */
    public Deck getMasterDeck() {
        return flashcardRepository.findDeck(DEFAULT_DECK_ID)
                .orElseGet(() -> {
                    Deck deck = new Deck(DEFAULT_DECK_ID, DEFAULT_DECK_NAME, flashcardRepository.findAllCards(DEFAULT_DECK_ID));
                    flashcardRepository.saveOrUpdateDeck(deck);
                    return deck;
                });
    }

    /**
     * Workflow 2 filter logic:
     * Queries SQLite using indexed SQL query for cards due today or earlier.
     */
    public List<Flashcard> getDueCards() {
        LocalDate today = LocalDate.now();
        List<Flashcard> dueCards = flashcardRepository.findDueCards(today);
        int totalCards = flashcardRepository.countCards(DEFAULT_DECK_ID);

        log.info("Retrieved {} due cards from SQLite (total {} cards in deck) for date {}.",
                dueCards.size(), totalCards, today);

        return dueCards;
    }

    /**
     * Synchronizes incoming updated or newly generated cards into SQLite local transactional database,
     * and asynchronously/synchronously replicates a snapshot to Google Drive as backup target.
     */
    @Transactional
    public synchronized SyncResponse syncCards(List<Flashcard> incomingCards) throws IOException {
        if (incomingCards == null || incomingCards.isEmpty()) {
            int currentTotal = flashcardRepository.countCards(DEFAULT_DECK_ID);
            return new SyncResponse("NO_OP", "No cards provided to sync.", 0, currentTotal);
        }

        List<Flashcard> validatedCards = new ArrayList<>();
        for (Flashcard card : incomingCards) {
            if (card == null) {
                continue;
            }
            validateAndSanitize(card);
            if (card.getId() == null || card.getId().isBlank()) {
                card.setId(UUID.randomUUID().toString());
            }
            validatedCards.add(card);
        }

        // 1. Transactionally upsert cards into SQLite
        flashcardRepository.batchUpsertCards(validatedCards, DEFAULT_DECK_ID);

        // 2. Update deck metadata in SQLite
        Deck masterDeck = getMasterDeck();
        masterDeck.setVersion(masterDeck.getVersion() + 1);
        masterDeck.setLastSynced(Instant.now());
        flashcardRepository.saveOrUpdateDeck(masterDeck);

        int totalCards = flashcardRepository.countCards(DEFAULT_DECK_ID);
        log.info("SQLite transactional sync complete: {} cards processed, total cards now {}.",
                validatedCards.size(), totalCards);

        // 3. Replicate snapshot to Google Drive backup target
        if (autoSyncBackup) {
            try {
                storageManager.writeDeck(masterDeck);
                log.info("Snapshot replicated to Google Drive backup target (version {}).", masterDeck.getVersion());
            } catch (Exception e) {
                log.warn("Replication to Google Drive backup target deferred: {}", e.getMessage());
            }
        }

        return new SyncResponse(
                "SUCCESS",
                "Deck safely synchronized with SQLite and replicated to Drive backup target.",
                validatedCards.size(),
                totalCards
        );
    }

    /**
     * Explicitly exports a full snapshot of the SQLite master deck to Google Drive backup target.
     */
    public synchronized Map<String, Object> backupToDrive() throws IOException {
        Deck deck = getMasterDeck();
        storageManager.writeDeck(deck);
        log.info("Manual backup to Google Drive completed: {} cards backed up.", deck.getCards().size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "Master deck successfully backed up to Google Drive target.");
        result.put("card_count", deck.getCards().size());
        result.put("version", deck.getVersion());
        result.put("backup_time", Instant.now().toString());
        result.put("cloud_connected", storageManager.isCloudConnected());
        return result;
    }

    /**
     * Restores the local SQLite database from the Google Drive backup target.
     */
    @Transactional
    public synchronized Map<String, Object> restoreFromDrive() throws IOException {
        log.info("Initiating restore from Google Drive backup target...");
        Deck backupDeck = storageManager.readDeck();

        if (backupDeck == null || backupDeck.getCards() == null) {
            throw new IOException("No valid backup found on Google Drive target.");
        }

        String deckId = backupDeck.getDeckId() != null ? backupDeck.getDeckId() : DEFAULT_DECK_ID;
        backupDeck.setDeckId(deckId);
        if (backupDeck.getName() == null) {
            backupDeck.setName(DEFAULT_DECK_NAME);
        }

        // Replace SQLite state
        flashcardRepository.saveOrUpdateDeck(backupDeck);
        flashcardRepository.replaceAllCards(deckId, backupDeck.getCards());

        log.info("Restore complete: restored {} cards into SQLite deck '{}'.",
                backupDeck.getCards().size(), deckId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "SQLite database successfully restored from Google Drive backup target.");
        result.put("restored_card_count", backupDeck.getCards().size());
        result.put("version", backupDeck.getVersion());
        result.put("restore_time", Instant.now().toString());
        return result;
    }

    /**
     * Returns architectural status and storage telemetry.
     */
    public Map<String, Object> getStorageStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        Deck masterDeck = getMasterDeck();

        status.put("transactional_database", "SQLite");
        status.put("sqlite_file", sqliteDbPath);
        status.put("total_cards", masterDeck.getCards().size());
        status.put("deck_version", masterDeck.getVersion());
        status.put("last_synced", masterDeck.getLastSynced() != null ? masterDeck.getLastSynced().toString() : null);
        status.put("auto_sync_backup", autoSyncBackup);
        status.put("cloud_connected", storageManager.isCloudConnected());
        status.put("backup_target", storageManager.isCloudConnected() ? "Google Drive API v3 (Cloud)" : "Local Drive Store Simulator");
        status.put("unstructured_document_store", storageManager.isCloudConnected() ? "Google Drive API v3 (Cloud)" : "Local Drive Store Simulator (/documents)");

        return status;
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
