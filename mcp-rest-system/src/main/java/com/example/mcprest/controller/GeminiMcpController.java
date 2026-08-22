package com.example.mcprest.controller;

import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientSseClientTransport;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.mcp.SyncMcpToolCallbackProvider;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GeminiMcpController {

    private final ChatClient chatClient;

    public GeminiMcpController(ChatModel chatModel, TaskMcpController taskMcpController) {
        this.chatClient = ChatClient.builder(chatModel)
                .defaultTools(taskMcpController)
                .build();
    }

    @GetMapping("/api/gemini/ask")
    public String askGemini(@RequestParam("question") String question) {
        return chatClient.prompt(question).call().content();
    }
}
