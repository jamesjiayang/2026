package com.example.flashcards.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Strongly-typed representation of the master Deck file (my_deck.json).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class Deck {

    @JsonProperty("deck_id")
    private String deckId = "master-deck";

    @JsonProperty("name")
    private String name = "Personal Study Deck";

    @JsonProperty("version")
    private int version = 1;

    @JsonProperty("last_synced")
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private Instant lastSynced = Instant.now();

    @JsonProperty("cards")
    private List<Flashcard> cards = new ArrayList<>();

    public Deck() {
    }

    public Deck(String deckId, String name, List<Flashcard> cards) {
        this.deckId = deckId;
        this.name = name;
        this.cards = cards != null ? cards : new ArrayList<>();
        this.lastSynced = Instant.now();
    }

    public String getDeckId() {
        return deckId;
    }

    public void setDeckId(String deckId) {
        this.deckId = deckId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }

    public Instant getLastSynced() {
        return lastSynced;
    }

    public void setLastSynced(Instant lastSynced) {
        this.lastSynced = lastSynced;
    }

    public List<Flashcard> getCards() {
        return cards;
    }

    public void setCards(List<Flashcard> cards) {
        this.cards = cards != null ? cards : new ArrayList<>();
    }
}
