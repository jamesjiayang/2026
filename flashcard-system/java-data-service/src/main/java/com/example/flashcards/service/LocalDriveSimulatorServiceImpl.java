package com.example.flashcards.service;

import com.example.flashcards.model.Deck;
import com.example.flashcards.model.DocumentResponse;
import com.example.flashcards.model.Flashcard;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Local file-based Google Drive simulator.
 * Ensures zero-config startup and testability when Google Drive credentials are not yet configured.
 */
@Service("localDriveSimulator")
public class LocalDriveSimulatorServiceImpl implements DriveStorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalDriveSimulatorServiceImpl.class);

    @Value("${drive.local.store-dir:./drive_store}")
    private String storeDir;

    private final ObjectMapper objectMapper;

    public LocalDriveSimulatorServiceImpl() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
        this.objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    @PostConstruct
    public void init() {
        try {
            Path baseDir = Path.of(storeDir);
            Path docsDir = baseDir.resolve("documents");
            Files.createDirectories(docsDir);

            Path deckPath = baseDir.resolve("my_deck.json");
            if (!Files.exists(deckPath)) {
                log.info("Seeding initial local simulated my_deck.json at {}", deckPath.toAbsolutePath());
                Deck initialDeck = createSeedDeck();
                objectMapper.writeValue(deckPath.toFile(), initialDeck);
            }

            // Seed sample document if not exists
            Path sampleDoc = docsDir.resolve("doc-sample-1.txt");
            if (!Files.exists(sampleDoc)) {
                log.info("Seeding sample document at {}", sampleDoc.toAbsolutePath());
                String sampleText = """
                        # Distributed Systems Fundamentals
                        
                        A distributed system is a collection of autonomous computing entities that communicate over a network
                        and coordinate their actions by passing messages to achieve a common goal.
                        
                        ## Key Concepts
                        1. CAP Theorem: Formulated by Eric Brewer, it states that any distributed data store can only provide
                           at most two of the following three guarantees:
                           - Consistency: Every read receives the most recent write or an error.
                           - Availability: Every request receives a non-error response, without guarantee that it contains the most recent write.
                           - Partition Tolerance: The system continues to operate despite an arbitrary number of messages being dropped or delayed by the network.
                           In network partitions (which are inevitable), a distributed system must choose between Consistency (CP) and Availability (AP).
                        
                        2. Raft Consensus Algorithm:
                           Raft is a consensus algorithm designed to be understandable and fault-tolerant.
                           It decomposes consensus into three subproblems: Leader Election, Log Replication, and Safety.
                           A node in Raft can be in one of three states: Follower, Candidate, or Leader.
                           Leaders send periodic Heartbeats (AppendEntries RPCs with no log entries) to maintain authority.
                        
                        3. Spaced Repetition and Leitner Box System:
                           The Leitner system uses flashcards sorted into boxes based on learner mastery.
                           Cards correctly answered move to higher boxes with exponential review intervals.
                           Cards answered incorrectly are sent back to Box 1 for immediate review.
                        """;
                Files.writeString(sampleDoc, sampleText, StandardCharsets.UTF_8);
            }
        } catch (IOException e) {
            log.error("Failed to initialize local drive store directory: {}", e.getMessage(), e);
        }
    }

    private Deck createSeedDeck() {
        Deck deck = new Deck("master-deck", "CS & Distributed Systems", new ArrayList<>());
        List<Flashcard> cards = new ArrayList<>();

        // Card 1: Due today (Box 1)
        Flashcard c1 = new Flashcard(
                "What three guarantees are contrasted in the CAP Theorem?",
                "Consistency, Availability, and Partition Tolerance (a system can satisfy at most two in the presence of network partitions)."
        );
        c1.setBoxNumber(1);
        c1.setNextReviewDate(LocalDate.now());
        c1.setTags(List.of("distributed-systems", "cap-theorem"));
        cards.add(c1);

        // Card 2: Due yesterday (overdue)
        Flashcard c2 = new Flashcard(
                "What are the three possible states of a node in the Raft consensus algorithm?",
                "Follower, Candidate, and Leader."
        );
        c2.setBoxNumber(2);
        c2.setNextReviewDate(LocalDate.now().minusDays(1));
        c2.setTags(List.of("raft", "consensus"));
        cards.add(c2);

        // Card 3: Future review (not due today)
        Flashcard c3 = new Flashcard(
                "What happens to a flashcard in the Leitner system when answered incorrectly?",
                "It is demoted back to Box 1 for immediate daily review."
        );
        c3.setBoxNumber(3);
        c3.setNextReviewDate(LocalDate.now().plusDays(5));
        c3.setTags(List.of("learning-theory", "leitner"));
        cards.add(c3);

        deck.setCards(cards);
        return deck;
    }

    @Override
    public DocumentResponse getDocument(String documentId) throws IOException {
        Path filePath = findDocumentPath(documentId);

        if (filePath == null || !Files.exists(filePath)) {
            throw new IOException("Document not found in drive store: " + documentId);
        }

        String content = Files.readString(filePath, StandardCharsets.UTF_8);
        return new DocumentResponse(documentId, filePath.getFileName().toString(), content, "text/plain");
    }

    private Path findDocumentPath(String documentId) {
        List<Path> searchDirs = List.of(
                Path.of(storeDir, "documents"),
                Path.of("..", storeDir, "documents"),
                Path.of("../drive_store/documents"),
                Path.of("./drive_store/documents")
        );

        for (Path dir : searchDirs) {
            if (!Files.exists(dir)) {
                continue;
            }
            Path direct = dir.resolve(documentId);
            if (Files.exists(direct) && Files.isRegularFile(direct)) {
                return direct;
            }
            Path withTxt = dir.resolve(documentId + ".txt");
            if (Files.exists(withTxt) && Files.isRegularFile(withTxt)) {
                return withTxt;
            }
            Path withMd = dir.resolve(documentId + ".md");
            if (Files.exists(withMd) && Files.isRegularFile(withMd)) {
                return withMd;
            }
        }
        return null;
    }

    @Override
    public Deck readDeck() throws IOException {
        Path deckPath = resolveDeckPath();
        if (deckPath == null || !Files.exists(deckPath)) {
            return createSeedDeck();
        }
        return objectMapper.readValue(deckPath.toFile(), Deck.class);
    }

    @Override
    public void writeDeck(Deck deck) throws IOException {
        Path deckPath = resolveDeckPath();
        if (deckPath == null) {
            deckPath = Path.of(storeDir, "my_deck.json");
        }
        Files.createDirectories(deckPath.getParent());
        objectMapper.writeValue(deckPath.toFile(), deck);
        log.info("Successfully updated {} with {} cards", deckPath.toAbsolutePath(), deck.getCards().size());
    }

    private Path resolveDeckPath() {
        List<Path> candidatePaths = List.of(
                Path.of(storeDir, "my_deck.json"),
                Path.of("..", storeDir, "my_deck.json"),
                Path.of("../drive_store/my_deck.json"),
                Path.of("./drive_store/my_deck.json")
        );
        for (Path p : candidatePaths) {
            if (Files.exists(p)) {
                return p;
            }
        }
        return Path.of(storeDir, "my_deck.json");
    }

    @Override
    public boolean isCloudConnected() {
        return false;
    }
}
