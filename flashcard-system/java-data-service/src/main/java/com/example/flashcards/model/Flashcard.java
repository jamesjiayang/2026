package com.example.flashcards.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Strongly-typed representation of a single Flashcard.
 * Adheres to Leitner spaced-repetition attributes.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class Flashcard {

    @JsonProperty("id")
    private String id;

    @JsonProperty("question")
    private String question;

    @JsonProperty("answer")
    private String answer;

    @JsonProperty("box_number")
    private int boxNumber = 1;

    @JsonProperty("last_reviewed")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate lastReviewed;

    @JsonProperty("next_review_date")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate nextReviewDate;

    @JsonProperty("tags")
    private List<String> tags = new ArrayList<>();

    @JsonProperty("source_document_id")
    private String sourceDocumentId;

    public Flashcard() {
        this.id = UUID.randomUUID().toString();
        this.nextReviewDate = LocalDate.now();
    }

    public Flashcard(String question, String answer) {
        this();
        this.question = question;
        this.answer = answer;
    }

    public Flashcard(String id, String question, String answer, int boxNumber, LocalDate lastReviewed, LocalDate nextReviewDate, List<String> tags, String sourceDocumentId) {
        this.id = id != null ? id : UUID.randomUUID().toString();
        this.question = question;
        this.answer = answer;
        this.boxNumber = Math.max(1, Math.min(boxNumber, 5));
        this.lastReviewed = lastReviewed;
        this.nextReviewDate = nextReviewDate;
        this.tags = tags != null ? tags : new ArrayList<>();
        this.sourceDocumentId = sourceDocumentId;
    }

    // Getters and Setters

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public int getBoxNumber() {
        return boxNumber;
    }

    public void setBoxNumber(int boxNumber) {
        this.boxNumber = Math.max(1, Math.min(boxNumber, 5));
    }

    public LocalDate getLastReviewed() {
        return lastReviewed;
    }

    public void setLastReviewed(LocalDate lastReviewed) {
        this.lastReviewed = lastReviewed;
    }

    public LocalDate getNextReviewDate() {
        return nextReviewDate;
    }

    public void setNextReviewDate(LocalDate nextReviewDate) {
        this.nextReviewDate = nextReviewDate;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags != null ? tags : new ArrayList<>();
    }

    public String getSourceDocumentId() {
        return sourceDocumentId;
    }

    public void setSourceDocumentId(String sourceDocumentId) {
        this.sourceDocumentId = sourceDocumentId;
    }

    @Override
    public String toString() {
        return "Flashcard{" +
                "id='" + id + '\'' +
                ", question='" + question + '\'' +
                ", boxNumber=" + boxNumber +
                ", nextReviewDate=" + nextReviewDate +
                '}';
    }
}
