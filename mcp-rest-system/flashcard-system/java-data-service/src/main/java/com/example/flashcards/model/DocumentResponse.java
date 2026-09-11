package com.example.flashcards.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * DTO representing raw document text returned to Python.
 */
public class DocumentResponse {

    @JsonProperty("id")
    private String id;

    @JsonProperty("name")
    private String name;

    @JsonProperty("content")
    private String content;

    @JsonProperty("mime_type")
    private String mimeType;

    public DocumentResponse() {
    }

    public DocumentResponse(String id, String name, String content, String mimeType) {
        this.id = id;
        this.name = name;
        this.content = content;
        this.mimeType = mimeType;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }
}
