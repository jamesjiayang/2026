package com.example.flashcards.service;

import com.example.flashcards.model.Deck;
import com.example.flashcards.model.DocumentResponse;
import com.example.flashcards.model.Flashcard;
import com.example.flashcards.model.SyncResponse;
import com.example.flashcards.repository.FlashcardRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DeckServiceTest {

    private Path tempDbFile;
    private FlashcardRepository flashcardRepository;
    private TestDriveStorageService fakeStorage;
    private DeckService deckService;

    static class TestDriveStorageService implements DriveStorageService {
        private Deck storedDeck = new Deck("master-deck", "CS & Distributed Systems", new ArrayList<>());
        private int writeCount = 0;

        @Override
        public DocumentResponse getDocument(String documentId) {
            return new DocumentResponse(documentId, "test.txt", "sample content", "text/plain");
        }

        @Override
        public Deck readDeck() {
            return storedDeck;
        }

        @Override
        public void writeDeck(Deck deck) {
            this.storedDeck = deck;
            this.writeCount++;
        }

        @Override
        public boolean isCloudConnected() {
            return false;
        }

        public int getWriteCount() {
            return writeCount;
        }

        public void setStoredDeck(Deck storedDeck) {
            this.storedDeck = storedDeck;
        }
    }

    @BeforeEach
    void setUp() throws IOException {
        tempDbFile = Files.createTempFile("test-flashcards-", ".db");
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.sqlite.JDBC");
        dataSource.setUrl("jdbc:sqlite:" + tempDbFile.toAbsolutePath());

        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        flashcardRepository = new FlashcardRepository(jdbcTemplate, objectMapper);
        flashcardRepository.initSchema();

        fakeStorage = new TestDriveStorageService();
        deckService = new DeckService(flashcardRepository, fakeStorage);
        ReflectionTestUtils.setField(deckService, "autoSyncBackup", true);
        ReflectionTestUtils.setField(deckService, "sqliteDbPath", tempDbFile.toAbsolutePath().toString());
    }

    @AfterEach
    void tearDown() {
        try {
            Files.deleteIfExists(tempDbFile);
        } catch (Exception ignored) {
        }
    }

    @Test
    void testGetDueCards_UsesSqliteIndexToFilterCardsDueTodayOrEarlier() throws IOException {
        LocalDate today = LocalDate.now();

        Flashcard dueCard1 = new Flashcard("Q1", "A1");
        dueCard1.setId("1");
        dueCard1.setBoxNumber(1);
        dueCard1.setNextReviewDate(today);

        Flashcard overdueCard = new Flashcard("Q2", "A2");
        overdueCard.setId("2");
        overdueCard.setBoxNumber(2);
        overdueCard.setNextReviewDate(today.minusDays(3));

        Flashcard futureCard = new Flashcard("Q3", "A3");
        futureCard.setId("3");
        futureCard.setBoxNumber(3);
        futureCard.setNextReviewDate(today.plusDays(2));

        // Insert into SQLite
        flashcardRepository.batchUpsertCards(List.of(dueCard1, overdueCard, futureCard), "master-deck");

        List<Flashcard> dueResults = deckService.getDueCards();

        assertEquals(2, dueResults.size(), "Should only return cards due today or in the past");
        assertTrue(dueResults.stream().anyMatch(c -> "1".equals(c.getId())));
        assertTrue(dueResults.stream().anyMatch(c -> "2".equals(c.getId())));
        assertFalse(dueResults.stream().anyMatch(c -> "3".equals(c.getId())));
    }

    @Test
    void testSyncCards_TransactionallyUpsertsInSqliteAndReplicatesToBackup() throws IOException {
        Flashcard existingCard = new Flashcard("Original Q", "Original A");
        existingCard.setId("card-100");
        existingCard.setBoxNumber(1);
        flashcardRepository.batchUpsertCards(List.of(existingCard), "master-deck");

        // Incoming update for existing card (progressed to Box 2)
        Flashcard updatedCard = new Flashcard("Original Q", "Original A");
        updatedCard.setId("card-100");
        updatedCard.setBoxNumber(2);
        updatedCard.setNextReviewDate(LocalDate.now().plusDays(3));

        // Brand new card generated by Python
        Flashcard newCard = new Flashcard("New Q", "New A");
        newCard.setId("card-200");
        newCard.setBoxNumber(1);

        SyncResponse response = deckService.syncCards(List.of(updatedCard, newCard));

        assertEquals("SUCCESS", response.getStatus());
        assertEquals(2, response.getSyncedCount());
        assertEquals(2, response.getTotalDeckCards());

        // Verify SQLite transactional state
        Deck deckInSqlite = deckService.getMasterDeck();
        assertEquals(2, deckInSqlite.getCards().size());
        assertEquals(2, flashcardRepository.countCards("master-deck"));

        Flashcard card100 = deckInSqlite.getCards().stream()
                .filter(c -> "card-100".equals(c.getId()))
                .findFirst().orElseThrow();
        assertEquals(2, card100.getBoxNumber(), "Existing card should have updated box number in SQLite");

        // Verify Google Drive backup target was updated
        assertEquals(1, fakeStorage.getWriteCount(), "writeDeck to backup target should have been called once");
        assertEquals(2, fakeStorage.readDeck().getCards().size());
    }

    @Test
    void testBackupAndRestore_RestoresFromGoogleDriveTarget() throws IOException {
        // Setup backup target with 2 cards
        Flashcard c1 = new Flashcard("Backup Q1", "Backup A1");
        c1.setId("b-1");
        Flashcard c2 = new Flashcard("Backup Q2", "Backup A2");
        c2.setId("b-2");

        Deck backupDeck = new Deck("master-deck", "Backup Deck", List.of(c1, c2));
        fakeStorage.setStoredDeck(backupDeck);

        // Restore from Google Drive backup into SQLite
        Map<String, Object> restoreResult = deckService.restoreFromDrive();
        assertEquals("SUCCESS", restoreResult.get("status"));
        assertEquals(2, restoreResult.get("restored_card_count"));

        // Verify SQLite now has the restored cards
        assertEquals(2, flashcardRepository.countCards("master-deck"));
        Deck masterDeck = deckService.getMasterDeck();
        assertEquals(2, masterDeck.getCards().size());
        assertTrue(masterDeck.getCards().stream().anyMatch(c -> "b-1".equals(c.getId())));

        // Test explicit manual backup
        Map<String, Object> backupResult = deckService.backupToDrive();
        assertEquals("SUCCESS", backupResult.get("status"));
        assertEquals(2, backupResult.get("card_count"));
    }

    @Test
    void testValidateAndSanitize_RejectsInvalidCards() {
        Flashcard blankQuestionCard = new Flashcard("", "Answer");
        assertThrows(IllegalArgumentException.class, () -> deckService.syncCards(List.of(blankQuestionCard)));

        Flashcard blankAnswerCard = new Flashcard("Question", "   ");
        assertThrows(IllegalArgumentException.class, () -> deckService.syncCards(List.of(blankAnswerCard)));
    }
}
