package com.example.flashcards.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

/**
 * Payload sent by Python to sync cards into master deck.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class SyncRequest {

    @JsonProperty("cards")
    private List<Flashcard> cards = new ArrayList<>();

    public SyncRequest() {
    }

    public SyncRequest(List<Flashcard> cards) {
        this.cards = cards != null ? cards : new ArrayList<>();
    }

    public List<Flashcard> getCards() {
        return cards;
    }

    public void setCards(List<Flashcard> cards) {
        this.cards = cards != null ? cards : new ArrayList<>();
    }
}
