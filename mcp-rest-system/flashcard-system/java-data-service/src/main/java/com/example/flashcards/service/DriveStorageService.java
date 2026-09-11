package com.example.flashcards.service;

import com.example.flashcards.model.Deck;
import com.example.flashcards.model.DocumentResponse;

import java.io.IOException;

/**
 * Contract for external Google Drive storage.
 * Handles reading source documents and syncing my_deck.json.
 */
public interface DriveStorageService {

    /**
     * Retrieves and parses raw text content of a source document from Google Drive.
     * @param documentId Document ID or file name.
     * @return DocumentResponse containing text content.
     */
    DocumentResponse getDocument(String documentId) throws IOException;

    /**
     * Reads and deserializes my_deck.json from Google Drive into strongly-typed Deck POJO.
     * @return Master Deck POJO.
     */
    Deck readDeck() throws IOException;

    /**
     * Serializes Deck POJO and uploads/saves back to my_deck.json on Google Drive.
     * @param deck Master Deck POJO.
     */
    void writeDeck(Deck deck) throws IOException;

    /**
     * Returns true if this service is actively connected to cloud Google Drive.
     */
    boolean isCloudConnected();
}
