# Walkthrough: Java MCP & RESTful Service

We have implemented a task management system in Java that functions both as a standard **RESTful service** and as a **Model Context Protocol (MCP) server**.

Additionally, we have added an integration with **Google AI / Gemini** (acting as an MCP client) to demonstrate how the LLM can consume these MCP tools to manage tasks.

Here is a summary of the implementation and details on how to run and verify it.

---

## Key Components Created

### 1. Maven Project Configuration
- **[pom.xml](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/pom.xml)**: Configured Spring Boot `3.4.3` and Spring AI `1.0.0-M8`. Added the Spring Milestones repository and overrode plugin versions to run successfully under Maven `3.6.2`. Integrated `spring-ai-starter-model-vertex-ai-gemini` to support Gemini ChatModel capabilities.

### 2. Application Settings
- **[application.properties](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/resources/application.properties)**: 
  - Configures the server port to `8080` and the MCP protocol transport as `STREAMABLE` (HTTP Server-Sent Events).
  - Sets up the Vertex AI Gemini properties (`spring.ai.vertex.ai.gemini.project-id` and `spring.ai.vertex.ai.gemini.location`) with safe default environment variables and defaults (`dummy-project` / `us-central1`) to allow local integration tests to load the Spring ApplicationContext without failing.

### 3. Java Source Code
- **[Task.java](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/java/com/example/mcprest/model/Task.java)**: A POJO model representing a task (`id`, `title`, `description`, `completed`).
- **[TaskRepository.java](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/java/com/example/mcprest/repository/TaskRepository.java)**: A thread-safe, in-memory repository using a `ConcurrentHashMap` and seeded with default tasks.
- **[TaskRestController.java](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/java/com/example/mcprest/controller/TaskRestController.java)**: Exposes standard HTTP REST endpoints under `/api/tasks` for listing, retrieving, creating, and deleting tasks.
- **[TaskMcpController.java](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/java/com/example/mcprest/controller/TaskMcpController.java)**: Uses Spring AI's unified `@Tool` and `@ToolParam` annotations to register methods as MCP tools (`listTasks`, `addTask`, `deleteTask`).
- **[GeminiMcpController.java](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/java/com/example/mcprest/controller/GeminiMcpController.java)**: Exposes a new `/api/gemini/ask` endpoint that dynamically connects to the local MCP server over SSE, gathers tools via `SyncMcpToolCallbackProvider`, and binds them to the Gemini `ChatClient` so the LLM can execute prompts using local task management tools.
- **[McpRestApplication.java](file:///C:/Users/james/.gemini/antigravity/scratch/mcp-rest-system/src/main/java/com/example/mcprest/McpRestApplication.java)**: The standard Spring Boot main application class.

---

## Verification and Testing

### Compilation and Tests
We verified the codebase compiles and passes all JUnit integration tests successfully using:
```bash
mvn clean test
```

All 3 tests run and pass without context load errors:
```text
[INFO] Results:
[INFO] 
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
```

---

## How to Run & Manually Verify

### 1. GCP Authentication (Vertex AI)
Since Vertex AI is Google Cloud's enterprise AI platform, it does not use a direct API key. Instead, you can authenticate using a service account JSON file without needing `gcloud` installed:
1. In the GCP Console, create a service account and grant it **Vertex AI User** permissions.
2. Generate and download a **Service Account JSON key file**.
3. In your terminal, set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to your JSON file:
   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your\credentials.json"
   $env:SPRING_AI_VERTEX_AI_GEMINI_PROJECT_ID="your-gcp-project-id"
   ```

### 2. Launch the Application
Start the Spring Boot application:
```powershell
mvn spring-boot:run
```

### 3. Test the RESTful Service & MCP Tools
- **List all tasks:**
  ```bash
  curl http://localhost:8080/api/tasks
  ```

- **Query Gemini to manage tasks:**
  Invoke the Gemini-MCP endpoint with a task management prompt:
  ```bash
  curl "http://localhost:8080/api/gemini/ask?question=Add+a+new+task+to+buy+milk+and+bread"
  ```
  Gemini will call the `addTask` tool exposed by your local MCP server to register the task, and then reply with confirmation.
