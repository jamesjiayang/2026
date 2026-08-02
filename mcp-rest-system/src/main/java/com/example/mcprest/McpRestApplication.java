package com.example.mcprest;

import com.example.mcprest.controller.TaskMcpController;
import org.springframework.ai.tool.ToolCallbackProvider;
import org.springframework.ai.tool.method.MethodToolCallbackProvider;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class McpRestApplication {
    public static void main(String[] args) {
        SpringApplication.run(McpRestApplication.class, args);
    }

    @Bean
    public ToolCallbackProvider taskMcpTools(TaskMcpController taskMcpController) {
        return MethodToolCallbackProvider.builder()
                .toolObjects(taskMcpController)
                .build();
    }
}
