package com.example.flashcards.controller;

import com.example.flashcards.model.Deck;
import com.example.flashcards.model.Flashcard;
import com.example.flashcards.model.SyncRequest;
import com.example.flashcards.model.SyncResponse;
import com.example.flashcards.service.DeckService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Controller exposing Deck endpoints for:
 * 1. Due card retrieval (Workflow 2 - Study Session Graph)
 * 2. Card sync and cloud reconciliation (Workflow 1 & 2)
 */
@RestController
@RequestMapping("/api/deck")
@CrossOrigin(origins = "*")
public class DeckController {

    private static final Logger log = LoggerFactory.getLogger(DeckController.class);

    private final DeckService deckService;
    private final ObjectMapper objectMapper;

    public DeckController(DeckService deckService, ObjectMapper objectMapper) {
        this.deckService = deckService;
        this.objectMapper = objectMapper;
    }

    /**
     * GET /api/deck/due
     * Java calculates which cards are due based on timestamp and returns only those cards.
     */
    @GetMapping("/due")
    public ResponseEntity<?> getDueCards() {
        log.info("Received request for due study session cards.");
        try {
            List<Flashcard> dueCards = deckService.getDueCards();
            return ResponseEntity.ok(dueCards);
        } catch (Exception e) {
            log.error("Failed to retrieve due cards: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to read deck from storage", e.getMessage()));
        }
    }

    /**
     * POST /api/deck/sync
     * Python sends updated cards (from generation or study session), and Java merges them safely into Drive file.
     * Supports both JSON array [ {...} ] and wrapped object { "cards": [...] }.
     */
    @PostMapping("/sync")
    public ResponseEntity<?> syncCards(@RequestBody JsonNode payload) {
        log.info("Received deck sync request.");
        try {
            List<Flashcard> incomingCards = new ArrayList<>();

            if (payload.isArray()) {
                // Payload is an array of Flashcards
                incomingCards = objectMapper.convertValue(payload, new TypeReference<List<Flashcard>>() {});
            } else if (payload.isObject()) {
                if (payload.has("cards")) {
                    JsonNode cardsNode = payload.get("cards");
                    incomingCards = objectMapper.convertValue(cardsNode, new TypeReference<List<Flashcard>>() {});
                } else {
                    // Single flashcard object?
                    Flashcard singleCard = objectMapper.treeToValue(payload, Flashcard.class);
                    if (singleCard != null && singleCard.getQuestion() != null) {
                        incomingCards.add(singleCard);
                    }
                }
            }

            SyncResponse response = deckService.syncCards(incomingCards);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("Validation error during card sync: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("Card validation failed", e.getMessage()));
        } catch (IOException e) {
            log.error("Storage error during card sync: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Drive storage failure", e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected error during card sync: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Internal server error", e.getMessage()));
        }
    }

    /**
     * GET /api/deck
     * Returns full master deck metadata and all cards.
     */
    @GetMapping
    public ResponseEntity<?> getMasterDeck() {
        try {
            Deck deck = deckService.getMasterDeck();
            return ResponseEntity.ok(deck);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to read deck", e.getMessage()));
        }
    }

    /**
     * POST /api/deck/backup
     * Triggers an immediate export/backup of the current SQLite master deck to Google Drive target.
     */
    @PostMapping("/backup")
    public ResponseEntity<?> backupToDrive() {
        log.info("Received request to backup SQLite deck to Google Drive target.");
        try {
            var result = deckService.backupToDrive();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Backup failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Backup failed", e.getMessage()));
        }
    }

    /**
     * POST /api/deck/restore
     * Restores local SQLite master deck from Google Drive backup target.
     */
    @PostMapping("/restore")
    public ResponseEntity<?> restoreFromDrive() {
        log.info("Received request to restore SQLite deck from Google Drive backup target.");
        try {
            var result = deckService.restoreFromDrive();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Restore failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Restore failed", e.getMessage()));
        }
    }

    /**
     * GET /api/deck/status
     * Returns storage engine telemetry (SQLite file, card count, Google Drive status).
     */
    @GetMapping("/status")
    public ResponseEntity<?> getStorageStatus() {
        return ResponseEntity.ok(deckService.getStorageStatus());
    }

    public record ErrorResponse(String error, String message) {}
}
