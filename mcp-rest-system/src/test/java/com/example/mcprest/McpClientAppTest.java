package com.example.mcprest;

import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientSseClientTransport;
import io.modelcontextprotocol.spec.McpSchema.CallToolRequest;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import io.modelcontextprotocol.spec.McpSchema.ListToolsResult;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test that launches the Spring Boot application (with MCP server)
 * on a random port, connects using our Java MCP client transport, and performs
 * assertions on tool registration and execution.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class McpClientAppTest {

    @LocalServerPort
    private int port;

    @Test
    public void testMcpClientIntegration() throws Exception {
        String serverUrl = "http://localhost:" + port;
        System.out.println("Integration Test: Connecting client to " + serverUrl + "/sse");

        // 1. Initialize SSE transport targeting the random spring boot port
        HttpClientSseClientTransport transport = HttpClientSseClientTransport.builder(serverUrl)
                .sseEndpoint("/sse")
                .build();

        // 2. Build sync client
        McpSyncClient client = McpClient.sync(transport).build();

        try {
            // 3. Perform initialization handshake
            client.initialize();

            // 4. Assert that tools list is retrieved and contains expected tools
            ListToolsResult toolsResult = client.listTools();
            assertThat(toolsResult.tools()).isNotEmpty();
            boolean hasListTasks = toolsResult.tools().stream().anyMatch(t -> t.name().equals("listTasks"));
            boolean hasAddTask = toolsResult.tools().stream().anyMatch(t -> t.name().equals("addTask"));
            boolean hasDeleteTask = toolsResult.tools().stream().anyMatch(t -> t.name().equals("deleteTask"));

            assertThat(hasListTasks).isTrue();
            assertThat(hasAddTask).isTrue();
            assertThat(hasDeleteTask).isTrue();

            // 5. Assert calling 'listTasks' tool functions
            CallToolResult listResult = client.callTool(new CallToolRequest("listTasks", Map.of()));
            assertThat(listResult.content()).isNotEmpty();

            // 6. Assert calling 'addTask' tool creates a task
            Map<String, Object> addArgs = Map.of(
                    "title", "Integration Test Task",
                    "description", "Verifying tool call integrity via test connection"
            );
            CallToolResult addResult = client.callTool(new CallToolRequest("addTask", addArgs));
            assertThat(addResult.content()).isNotEmpty();
            assertThat(addResult.content().toString()).contains("Integration Test Task");

            // 7. Assert task list reflects the new addition
            CallToolResult updatedListResult = client.callTool(new CallToolRequest("listTasks", Map.of()));
            assertThat(updatedListResult.content().toString()).contains("Integration Test Task");

        } finally {
            // 8. Ensure connection is cleanly shutdown after assertions
            client.closeGracefully();
        }
    }
}
