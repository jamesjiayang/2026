package com.example.flashcards.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

/**
 * Response returned to Python after deck sync reconciliation.
 */
public class SyncResponse {

    @JsonProperty("status")
    private String status;

    @JsonProperty("message")
    private String message;

    @JsonProperty("synced_count")
    private int syncedCount;

    @JsonProperty("total_deck_cards")
    private int totalDeckCards;

    @JsonProperty("timestamp")
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private Instant timestamp = Instant.now();

    public SyncResponse() {
    }

    public SyncResponse(String status, String message, int syncedCount, int totalDeckCards) {
        this.status = status;
        this.message = message;
        this.syncedCount = syncedCount;
        this.totalDeckCards = totalDeckCards;
        this.timestamp = Instant.now();
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public int getSyncedCount() {
        return syncedCount;
    }

    public void setSyncedCount(int syncedCount) {
        this.syncedCount = syncedCount;
    }

    public int getTotalDeckCards() {
        return totalDeckCards;
    }

    public void setTotalDeckCards(int totalDeckCards) {
        this.totalDeckCards = totalDeckCards;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }
}
