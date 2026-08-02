package com.example.mcprest;

import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientSseClientTransport;
import io.modelcontextprotocol.client.transport.ServerParameters;
import io.modelcontextprotocol.client.transport.StdioClientTransport;
import io.modelcontextprotocol.spec.McpSchema.CallToolRequest;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import io.modelcontextprotocol.spec.McpSchema.ListToolsResult;

import java.io.File;
import java.util.Map;

/**
 * Standalone Java console application that acts as an MCP client.
 * It connects to the running MCP server over HTTP Server-Sent Events (SSE) or
 * launches the server as a subprocess communicating over STDIO,
 * executes initialization, lists tools, and makes tool calls.
 */
public class McpClientApp {

    public static void main(String[] args) {
        boolean stdioMode = false;
        for (String arg : args) {
            if ("--stdio".equalsIgnoreCase(arg)) {
                stdioMode = true;
                break;
            }
        }

        McpSyncClient client;

        if (stdioMode) {
            String javaHome = System.getProperty("java.home");
            String javaBin = javaHome + File.separator + "bin" + File.separator + "java";
            String classpath = System.getProperty("java.class.path");
            String className = "com.example.mcprest.McpRestApplication";

            System.out.println("Starting Java MCP Client in STDIO mode...");
            System.out.println("Launching MCP Server process: " + javaBin);

            ServerParameters serverParams = ServerParameters.builder(javaBin)
                    .args("-cp", classpath, className, "--spring.profiles.active=stdio")
                    .build();

            StdioClientTransport transport = new StdioClientTransport(serverParams);
            client = McpClient.sync(transport).build();
        } else {
            String serverUrl = "http://localhost:8080";
            System.out.println("Starting Java MCP Client in SSE mode...");
            System.out.println("Connecting to MCP Server at: " + serverUrl + "/sse");

            HttpClientSseClientTransport transport = HttpClientSseClientTransport.builder(serverUrl)
                    .sseEndpoint("/sse")
                    .build();

            client = McpClient.sync(transport).build();
        }

        try {
            // 3. Initialize the connection (runs JSON-RPC initialize handshake)
            System.out.println("Initiating JSON-RPC handshake...");
            client.initialize();
            System.out.println("Handshake successful! Connected to MCP Server.");
            System.out.println("--------------------------------------------------");

            // 4. List registered tools
            System.out.println("1. Fetching registered tools...");
            ListToolsResult toolsResult = client.listTools();
            System.out.println("Found " + toolsResult.tools().size() + " tool(s):");
            toolsResult.tools().forEach(tool -> {
                System.out.println(" - Name: " + tool.name());
                System.out.println("   Description: " + tool.description());
                System.out.println("   Schema: " + tool.inputSchema());
            });
            System.out.println("--------------------------------------------------");

            // 5. Invoke listTasks tool
            System.out.println("2. Calling 'listTasks' tool...");
            CallToolResult listResult = client.callTool(new CallToolRequest("listTasks", Map.of()));
            System.out.println("listTasks result:");
            System.out.println(listResult.content());
            System.out.println("--------------------------------------------------");

            // 6. Invoke addTask tool to add a new task
            System.out.println("3. Calling 'addTask' tool to register a new task...");
            Map<String, Object> addArgs = Map.of(
                    "title", "Verify Java MCP Client",
                    "description", "Confirm connection and tool execution from standalone client"
            );
            CallToolResult addResult = client.callTool(new CallToolRequest("addTask", addArgs));
            System.out.println("addTask result:");
            System.out.println(addResult.content());
            System.out.println("--------------------------------------------------");

            // 7. Invoke listTasks tool again to verify task was added
            System.out.println("4. Calling 'listTasks' tool again to verify task creation...");
            listResult = client.callTool(new CallToolRequest("listTasks", Map.of()));
            System.out.println("Updated listTasks result:");
            System.out.println(listResult.content());
            System.out.println("--------------------------------------------------");

            System.out.println("Demo finished successfully!");

        } catch (Exception e) {
            System.err.println("An error occurred during MCP Client execution:");
            e.printStackTrace();
        } finally {
            // 8. Gracefully close connection and release resources
            System.out.println("Closing connection...");
            try {
                client.closeGracefully();
                System.out.println("Connection closed.");
            } catch (Exception e) {
                System.err.println("Error closing client: " + e.getMessage());
            }
        }
    }
}
