package com.example.mcprest;

import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.ServerParameters;
import io.modelcontextprotocol.client.transport.StdioClientTransport;
import io.modelcontextprotocol.spec.McpSchema.CallToolRequest;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import io.modelcontextprotocol.spec.McpSchema.ListToolsResult;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class McpClientStdioTest {

    @Test
    public void testMcpClientStdioIntegration() throws Exception {
        String javaHome = System.getProperty("java.home");
        String javaBin = javaHome + File.separator + "bin" + File.separator + "java";
        String classpath = System.getProperty("java.class.path");
        String className = "com.example.mcprest.McpRestApplication";

        System.out.println("Integration Test (STDIO): Spawning server subprocess...");

        ServerParameters serverParams = ServerParameters.builder(javaBin)
                .args("-cp", classpath, className, "--spring.profiles.active=stdio")
                .build();

        StdioClientTransport transport = new StdioClientTransport(serverParams);

        // Build sync client
        McpSyncClient client = McpClient.sync(transport).build();

        try {
            // Perform initialization handshake
            client.initialize();

            // Assert that tools list is retrieved and contains expected tools
            ListToolsResult toolsResult = client.listTools();
            assertThat(toolsResult.tools()).isNotEmpty();
            boolean hasListTasks = toolsResult.tools().stream().anyMatch(t -> t.name().equals("listTasks"));
            boolean hasAddTask = toolsResult.tools().stream().anyMatch(t -> t.name().equals("addTask"));
            boolean hasDeleteTask = toolsResult.tools().stream().anyMatch(t -> t.name().equals("deleteTask"));

            assertThat(hasListTasks).isTrue();
            assertThat(hasAddTask).isTrue();
            assertThat(hasDeleteTask).isTrue();

            // Assert calling 'listTasks' tool functions
            CallToolResult listResult = client.callTool(new CallToolRequest("listTasks", Map.of()));
            assertThat(listResult.content()).isNotEmpty();

            // Assert calling 'addTask' tool creates a task
            Map<String, Object> addArgs = Map.of(
                    "title", "STDIO Test Task",
                    "description", "Verifying STDIO tool call integrity via subprocess connection"
            );
            CallToolResult addResult = client.callTool(new CallToolRequest("addTask", addArgs));
            assertThat(addResult.content()).isNotEmpty();
            assertThat(addResult.content().toString()).contains("STDIO Test Task");

            // Assert task list reflects the new addition
            CallToolResult updatedListResult = client.callTool(new CallToolRequest("listTasks", Map.of()));
            assertThat(updatedListResult.content().toString()).contains("STDIO Test Task");

        } finally {
            // Ensure connection is cleanly shutdown
            client.closeGracefully();
        }
    }
}
