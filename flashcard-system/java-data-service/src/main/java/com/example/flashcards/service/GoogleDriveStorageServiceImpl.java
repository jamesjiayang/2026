package com.example.flashcards.service;

import com.example.flashcards.model.Deck;
import com.example.flashcards.model.DocumentResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.ByteArrayContent;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.drive.model.File;
import com.google.api.services.drive.model.FileList;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

/**
 * Storage service connected to Google Drive API v3.
 * Manages OAuth2 / Service Account authentication, document extraction, and my_deck.json cloud syncing.
 */
@Service("googleDriveStorage")
public class GoogleDriveStorageServiceImpl implements DriveStorageService {

    private static final Logger log = LoggerFactory.getLogger(GoogleDriveStorageServiceImpl.class);
    private static final String APPLICATION_NAME = "Polyglot-Flashcard-Data-Service";
    private static final String DECK_FILE_NAME = "my_deck.json";

    @Value("${google.drive.credentials-path:}")
    private String credentialsPath;

    @Value("${google.drive.enabled:false}")
    private boolean driveEnabled;

    private final ObjectMapper objectMapper;
    private Drive driveService;

    public GoogleDriveStorageServiceImpl() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
        this.objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    public synchronized Drive getDriveClient() throws IOException {
        if (driveService != null) {
            return driveService;
        }

        if (!driveEnabled || credentialsPath == null || credentialsPath.isBlank()) {
            throw new IOException("Google Drive integration is not enabled or credentials-path is unset.");
        }

        java.io.File credFile = new java.io.File(credentialsPath);
        if (!credFile.exists()) {
            throw new FileNotFoundException("Google Drive credentials file not found at: " + credentialsPath);
        }

        try {
            final NetHttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();
            GoogleCredentials credentials = GoogleCredentials.fromStream(new FileInputStream(credFile))
                    .createScoped(Collections.singletonList(DriveScopes.DRIVE));

            this.driveService = new Drive.Builder(httpTransport, GsonFactory.getDefaultInstance(), new HttpCredentialsAdapter(credentials))
                    .setApplicationName(APPLICATION_NAME)
                    .build();

            log.info("Google Drive API v3 client successfully authenticated.");
            return this.driveService;
        } catch (Exception e) {
            throw new IOException("Failed to initialize Google Drive client: " + e.getMessage(), e);
        }
    }

    @Override
    public DocumentResponse getDocument(String documentId) throws IOException {
        Drive drive = getDriveClient();
        File fileMeta = drive.files().get(documentId).setFields("id, name, mimeType").execute();

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        if ("application/vnd.google-apps.document".equals(fileMeta.getMimeType())) {
            // Export Google Doc to plain text
            drive.files().export(documentId, "text/plain").executeMediaAndDownloadTo(outputStream);
        } else {
            drive.files().get(documentId).executeMediaAndDownloadTo(outputStream);
        }

        String content = outputStream.toString(StandardCharsets.UTF_8);
        return new DocumentResponse(fileMeta.getId(), fileMeta.getName(), content, fileMeta.getMimeType());
    }

    @Override
    public Deck readDeck() throws IOException {
        Drive drive = getDriveClient();
        String fileId = findDeckFileId(drive);

        if (fileId == null) {
            log.warn("my_deck.json not found on Google Drive, initializing new deck.");
            return new Deck();
        }

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        drive.files().get(fileId).executeMediaAndDownloadTo(outputStream);
        return objectMapper.readValue(outputStream.toByteArray(), Deck.class);
    }

    @Override
    public void writeDeck(Deck deck) throws IOException {
        Drive drive = getDriveClient();
        String fileId = findDeckFileId(drive);
        byte[] bytes = objectMapper.writeValueAsBytes(deck);
        ByteArrayContent mediaContent = new ByteArrayContent("application/json", bytes);

        if (fileId == null) {
            // Create new file
            File fileMetadata = new File();
            fileMetadata.setName(DECK_FILE_NAME);
            File uploaded = drive.files().create(fileMetadata, mediaContent).setFields("id").execute();
            log.info("Created new {} on Google Drive with id {}", DECK_FILE_NAME, uploaded.getId());
        } else {
            // Update existing file
            drive.files().update(fileId, null, mediaContent).execute();
            log.info("Updated existing {} on Google Drive (file id: {})", DECK_FILE_NAME, fileId);
        }
    }

    @Override
    public boolean isCloudConnected() {
        if (!driveEnabled || credentialsPath == null || credentialsPath.isBlank()) {
            return false;
        }
        return new java.io.File(credentialsPath).exists();
    }

    private String findDeckFileId(Drive drive) throws IOException {
        FileList result = drive.files().list()
                .setQ("name = '" + DECK_FILE_NAME + "' and trashed = false")
                .setSpaces("drive")
                .setFields("files(id, name)")
                .execute();

        List<File> files = result.getFiles();
        if (files != null && !files.isEmpty()) {
            return files.get(0).getId();
        }
        return null;
    }
}
