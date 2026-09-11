package com.example.flashcards.service;

import com.example.flashcards.model.Deck;
import com.example.flashcards.model.DocumentResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.io.IOException;

/**
 * Storage orchestrator.
 * Delegates to Google Drive API if configured, otherwise defaults to local simulated Drive.
 */
@Service
public class StorageManager implements DriveStorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageManager.class);

    private final DriveStorageService googleDriveService;
    private final DriveStorageService localSimulatorService;

    public StorageManager(
            @Qualifier("googleDriveStorage") DriveStorageService googleDriveService,
            @Qualifier("localDriveSimulator") DriveStorageService localSimulatorService) {
        this.googleDriveService = googleDriveService;
        this.localSimulatorService = localSimulatorService;
    }

    private DriveStorageService getActiveStorage() {
        if (googleDriveService.isCloudConnected()) {
            log.debug("Using active Google Drive Cloud Storage.");
            return googleDriveService;
        }
        log.debug("Using Local Simulated Drive Storage (zero-config/offline mode).");
        return localSimulatorService;
    }

    @Override
    public DocumentResponse getDocument(String documentId) throws IOException {
        return getActiveStorage().getDocument(documentId);
    }

    @Override
    public Deck readDeck() throws IOException {
        return getActiveStorage().readDeck();
    }

    @Override
    public void writeDeck(Deck deck) throws IOException {
        getActiveStorage().writeDeck(deck);
    }

    @Override
    public boolean isCloudConnected() {
        return googleDriveService.isCloudConnected();
    }
}
