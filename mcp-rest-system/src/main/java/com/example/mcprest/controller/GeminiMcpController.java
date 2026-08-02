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

    private final ChatModel chatModel;

    public GeminiMcpController(ChatModel chatModel) {
        this.chatModel = chatModel;
    }

    @GetMapping("/api/gemini/ask")
    public String askGemini(@RequestParam String question) {
        // 1. Set up connection parameters to the local MCP Server's SSE endpoint
        HttpClientSseClientTransport transport = HttpClientSseClientTransport.builder("http://localhost:8080")
                .sseEndpoint("/sse")
                .build();

        // 2. Build and initialize the synchronous MCP client
        McpSyncClient mcpClient = McpClient.sync(transport).build();
        try {
            mcpClient.initialize();

            // 3. Adapt MCP client tools into Spring AI ToolCallbacks
            SyncMcpToolCallbackProvider toolProvider = new SyncMcpToolCallbackProvider(mcpClient);

            // 4. Create a ChatClient configured with Gemini and the MCP tools
            ChatClient chatClient = ChatClient.builder(chatModel)
                    .defaultToolCallbacks(toolProvider.getToolCallbacks())
                    .build();

            // 5. Prompt Gemini (which will automatically call listTasks, addTask, or deleteTask as needed)
            return chatClient.prompt(question).call().content();

        } finally {
            // Gracefully close the MCP SSE stream connection
            mcpClient.closeGracefully();
        }
    }
}
