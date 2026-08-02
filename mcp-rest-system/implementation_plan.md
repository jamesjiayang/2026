# Implementation Plan - Java MCP & RESTful Service

This plan outlines the creation of a simple Spring Boot system that functions both as a RESTful service and as an MCP (Model Context Protocol) server. We will build a task management application where tasks can be managed either via REST endpoints (by traditional clients) or via MCP tools (by LLMs/AI agents).

Additionally, we are adding an integration with **Google AI / Gemini** (acting as an MCP client) to demonstrate how the LLM can consume these MCP tools to manage tasks.

## User Review Required

> [!IMPORTANT]
> - We will be using **Spring Boot 3.4.x** and **Spring AI 1.0.0-M8** (or the latest milestone) which has built-in support for MCP servers.
> - Because Spring AI is in milestone phase, the project's `pom.xml` will configure the **Spring Milestone repository** (`https://repo.spring.io/milestone`).
> - We will configure the MCP transport to use **Streamable HTTP (SSE)**. This allows external MCP clients to interact with the application over HTTP.
> - We recommend setting `C:\Users\james\.gemini\antigravity\scratch\mcp-rest-system` as the active workspace once the project directory is initialized.
> - **Gemini API Key**: You must provide a valid Gemini API key by setting `spring.ai.google.genai.api-key` in `application.properties` or via the `SPRING_AI_GOOGLE_GENAI_API_KEY` environment variable.

## Proposed Changes

We will create a new Maven project structure under:
`C:\Users\james\.gemini\antigravity\scratch\mcp-rest-system`

### Project Configuration

#### [MODIFY] [pom.xml](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/pom.xml)
- Declares Spring Boot starter parent and Spring AI BOM.
- Includes `spring-boot-starter-web` and `spring-ai-starter-mcp-server-webmvc`.
- Includes `spring-ai-starter-mcp-client` for connecting to MCP servers.
- **[NEW DEPS]** Add `spring-ai-google-genai-starter` to support Gemini ChatModel.
- Includes Spring Milestones repository.

#### [MODIFY] [application.properties](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/resources/application.properties)
- Configures port `8080`.
- Enables MCP streamable protocol (`spring.ai.mcp.server.protocol=STREAMABLE`).
- Adds Gemini model and API key properties.

### Core Java Source Code

#### [NEW] [Task.java](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/java/com/example/mcprest/model/Task.java)
- A simple representation of a Task: `id`, `title`, `description`, and `completed`.

#### [NEW] [TaskRepository.java](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/java/com/example/mcprest/repository/TaskRepository.java)
- An in-memory, thread-safe store for tasks using a `ConcurrentHashMap`.

#### [NEW] [TaskRestController.java](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/java/com/example/mcprest/controller/TaskRestController.java)
- Exposes standard RESTful API endpoints:
  - `GET /api/tasks` - List all tasks.
  - `POST /api/tasks` - Add a new task.
  - `DELETE /api/tasks/{id}` - Delete a task.

#### [NEW] [TaskMcpController.java](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/java/com/example/mcprest/controller/TaskMcpController.java)
- Uses Spring AI's `@McpTool` annotation to expose methods as MCP tools:
  - `listTasks()` - Exposes task listing.
  - `addTask(...)` - Exposes task creation.
  - `deleteTask(...)` - Exposes task deletion.

#### [NEW] [GeminiMcpController.java](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/java/com/example/mcprest/controller/GeminiMcpController.java)
- Connects to the local MCP server over SSE, retrieves tools via `SyncMcpToolCallbackProvider`, and binds them to Gemini using Spring AI's `ChatClient`. Exposes `/api/gemini/ask` for prompting the LLM.

#### [MODIFY] [McpRestApplication.java](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/java/com/example/mcprest/McpRestApplication.java)
- Spring Boot Main Application entrypoint.

## Verification Plan

### Automated Tests
- We will include JUnit integration tests:
  - Verify REST API endpoints respond correctly.
  - Verify MCP Server configuration registers tools correctly.

### Manual Verification
1. Set the environment variable `SPRING_AI_GOOGLE_GENAI_API_KEY` to your Gemini key.
2. Run the application via command line:
   ```bash
   mvn spring-boot:run
   ```
3. Test the RESTful endpoints using `curl` or browser requests:
   - Create task: `curl -X POST -H "Content-Type: application/json" -d "{\"title\":\"Build Java MCP\",\"description\":\"Implement Java MCP service\",\"completed\":false}" http://localhost:8080/api/tasks`
   - Retrieve tasks: `curl http://localhost:8080/api/tasks`
4. Test the Gemini-MCP client endpoint:
   - Run: `curl "http://localhost:8080/api/gemini/ask?question=Add+a+new+task+to+buy+milk+and+bread"`
   - Check if the task was successfully added using the REST API.
