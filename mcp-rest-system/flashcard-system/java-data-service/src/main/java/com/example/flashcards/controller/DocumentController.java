package com.example.flashcards.controller;

import com.example.flashcards.model.DocumentResponse;
import com.example.flashcards.service.StorageManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

/**
 * Controller exposing document extraction endpoint for Workflow 1 (The Generation Graph).
 */
@RestController
@RequestMapping("/api/documents")
@CrossOrigin(origins = "*")
public class DocumentController {

    private static final Logger log = LoggerFactory.getLogger(DocumentController.class);

    private final StorageManager storageManager;

    public DocumentController(StorageManager storageManager) {
        this.storageManager = storageManager;
    }

    /**
     * GET /api/documents/{id}
     * Returns raw text extracted from Google Drive (or local fallback) for Python's generation graph.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getDocument(@PathVariable("id") String id) {
        log.info("Request to fetch document: id={}", id);
        try {
            DocumentResponse doc = storageManager.getDocument(id);
            return ResponseEntity.ok(doc);
        } catch (IOException e) {
            log.error("Failed to retrieve document id={}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("Document not found: " + id, e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected error retrieving document id={}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Error retrieving document", e.getMessage()));
        }
    }

    public record ErrorResponse(String error, String message) {}
}
