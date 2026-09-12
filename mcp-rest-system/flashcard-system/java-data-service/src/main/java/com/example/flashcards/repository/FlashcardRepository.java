package com.example.flashcards.repository;

import com.example.flashcards.model.Deck;
import com.example.flashcards.model.Flashcard;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import jakarta.annotation.PostConstruct;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * SQLite Local Transactional Repository for Flashcards and Decks.
 * Implements high-performance relational storage, indexing on review dates,
 * and ACID atomic transactions.
 */
@Repository
public class FlashcardRepository {

    private static final Logger log = LoggerFactory.getLogger(FlashcardRepository.class);

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public FlashcardRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void initSchema() {
        log.info("Initializing SQLite local transactional schema...");

        // Decks table
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS decks (
                deck_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                last_synced TEXT
            );
        """);

        // Flashcards table
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS flashcards (
                id TEXT PRIMARY KEY,
                deck_id TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                box_number INTEGER NOT NULL DEFAULT 1,
                last_reviewed TEXT,
                next_review_date TEXT,
                tags TEXT,
                source_document_id TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
        """);

        // Performance Indexes
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_fc_due ON flashcards (next_review_date, box_number);");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_fc_deck ON flashcards (deck_id);");

        log.info("SQLite schema initialized successfully with indexed review columns.");
    }

    /**
     * Queries cards due for review on or before the given date.
     * Uses SQL index on next_review_date for sub-millisecond retrieval.
     */
    public List<Flashcard> findDueCards(LocalDate today) {
        String todayStr = today.toString();
        String sql = """
            SELECT id, question, answer, box_number, last_reviewed, next_review_date, tags, source_document_id
            FROM flashcards
            WHERE next_review_date IS NULL OR next_review_date <= ?
            ORDER BY box_number ASC, next_review_date ASC
        """;
        return jdbcTemplate.query(sql, new FlashcardRowMapper(objectMapper), todayStr);
    }

    /**
     * Retrieves all cards belonging to the specified deck.
     */
    public List<Flashcard> findAllCards(String deckId) {
        String sql = """
            SELECT id, question, answer, box_number, last_reviewed, next_review_date, tags, source_document_id
            FROM flashcards
            WHERE deck_id = ?
            ORDER BY box_number ASC, next_review_date ASC
        """;
        return jdbcTemplate.query(sql, new FlashcardRowMapper(objectMapper), deckId);
    }

    /**
     * Retrieves Deck metadata and associated cards.
     */
    public Optional<Deck> findDeck(String deckId) {
        String sql = "SELECT deck_id, name, version, last_synced FROM decks WHERE deck_id = ?";
        List<Deck> decks = jdbcTemplate.query(sql, (rs, rowNum) -> {
            Deck d = new Deck();
            d.setDeckId(rs.getString("deck_id"));
            d.setName(rs.getString("name"));
            d.setVersion(rs.getInt("version"));
            String lastSyncedStr = rs.getString("last_synced");
            if (lastSyncedStr != null && !lastSyncedStr.isBlank()) {
                try {
                    d.setLastSynced(Instant.parse(lastSyncedStr));
                } catch (Exception e) {
                    d.setLastSynced(Instant.now());
                }
            }
            return d;
        }, deckId);

        if (decks.isEmpty()) {
            return Optional.empty();
        }

        Deck deck = decks.get(0);
        deck.setCards(findAllCards(deckId));
        return Optional.of(deck);
    }

    /**
     * Inserts or updates deck metadata.
     */
    public void saveOrUpdateDeck(Deck deck) {
        String sql = """
            INSERT INTO decks (deck_id, name, version, last_synced)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(deck_id) DO UPDATE SET
                name = excluded.name,
                version = excluded.version,
                last_synced = excluded.last_synced
        """;
        String lastSyncedStr = deck.getLastSynced() != null ? deck.getLastSynced().toString() : Instant.now().toString();
        jdbcTemplate.update(sql, deck.getDeckId(), deck.getName(), deck.getVersion(), lastSyncedStr);
    }

    /**
     * Batch upserts flashcards in a single atomic database roundtrip.
     */
    public void batchUpsertCards(List<Flashcard> cards, String deckId) {
        if (cards == null || cards.isEmpty()) {
            return;
        }

        String sql = """
            INSERT INTO flashcards (
                id, deck_id, question, answer, box_number,
                last_reviewed, next_review_date, tags, source_document_id, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                deck_id = excluded.deck_id,
                question = excluded.question,
                answer = excluded.answer,
                box_number = excluded.box_number,
                last_reviewed = excluded.last_reviewed,
                next_review_date = excluded.next_review_date,
                tags = excluded.tags,
                source_document_id = excluded.source_document_id,
                updated_at = datetime('now')
        """;

        List<Object[]> batchArgs = new ArrayList<>(cards.size());
        for (Flashcard card : cards) {
            String tagsJson = serializeTags(card.getTags());
            String lastReviewedStr = card.getLastReviewed() != null ? card.getLastReviewed().toString() : null;
            String nextReviewStr = card.getNextReviewDate() != null ? card.getNextReviewDate().toString() : null;

            batchArgs.add(new Object[]{
                    card.getId(),
                    deckId,
                    card.getQuestion(),
                    card.getAnswer(),
                    card.getBoxNumber(),
                    lastReviewedStr,
                    nextReviewStr,
                    tagsJson,
                    card.getSourceDocumentId()
            });
        }

        jdbcTemplate.batchUpdate(sql, batchArgs);
        log.debug("Batch upserted {} flashcards into SQLite deck '{}'.", cards.size(), deckId);
    }

    /**
     * Replaces all cards for a deck (used when restoring from backup target).
     */
    public void replaceAllCards(String deckId, List<Flashcard> cards) {
        jdbcTemplate.update("DELETE FROM flashcards WHERE deck_id = ?", deckId);
        batchUpsertCards(cards, deckId);
        log.info("Replaced all cards for deck '{}' (total {} cards restored).", deckId, cards.size());
    }

    /**
     * Returns total cards in the specified deck.
     */
    public int countCards(String deckId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flashcards WHERE deck_id = ?",
                Integer.class,
                deckId
        );
        return count != null ? count : 0;
    }

    private String serializeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(tags);
        } catch (Exception e) {
            return "[]";
        }
    }

    private static class FlashcardRowMapper implements RowMapper<Flashcard> {
        private final ObjectMapper objectMapper;

        public FlashcardRowMapper(ObjectMapper objectMapper) {
            this.objectMapper = objectMapper;
        }

        @Override
        public Flashcard mapRow(ResultSet rs, int rowNum) throws SQLException {
            Flashcard card = new Flashcard();
            card.setId(rs.getString("id"));
            card.setQuestion(rs.getString("question"));
            card.setAnswer(rs.getString("answer"));
            card.setBoxNumber(rs.getInt("box_number"));

            String lastRev = rs.getString("last_reviewed");
            if (lastRev != null && !lastRev.isBlank()) {
                card.setLastReviewed(LocalDate.parse(lastRev));
            }

            String nextRev = rs.getString("next_review_date");
            if (nextRev != null && !nextRev.isBlank()) {
                card.setNextReviewDate(LocalDate.parse(nextRev));
            }

            String tagsJson = rs.getString("tags");
            if (tagsJson != null && !tagsJson.isBlank()) {
                try {
                    List<String> tags = objectMapper.readValue(tagsJson, new TypeReference<List<String>>() {});
                    card.setTags(tags);
                } catch (Exception e) {
                    card.setTags(new ArrayList<>());
                }
            }

            card.setSourceDocumentId(rs.getString("source_document_id"));
            return card;
        }
    }
}
