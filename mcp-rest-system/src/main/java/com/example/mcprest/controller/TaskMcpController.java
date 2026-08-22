package com.example.mcprest.controller;

import com.example.mcprest.model.Task;
import com.example.mcprest.repository.TaskRepository;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class TaskMcpController {
    private final TaskRepository taskRepository;

    public TaskMcpController(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Tool(description = "List all tasks currently tracked by the system")
    public java.util.Map<String, Object> listTasks() {
        return java.util.Map.of("tasks", taskRepository.findAll());
    }

    @Tool(description = "Add a new task to the system")
    public Task addTask(
            @ToolParam(description = "The title of the task") String title,
            @ToolParam(description = "A detailed description of the task") String description) {
        Task task = new Task(null, title, description != null ? description : "", false);
        return taskRepository.save(task);
    }

    @Tool(description = "Delete a task from the system by its unique integer ID")
    public java.util.Map<String, Object> deleteTask(
            @ToolParam(description = "The unique integer ID of the task to delete (e.g. 1, 2)") String id) {
        try {
            long taskId = (long) Double.parseDouble(id.trim());
            boolean deleted = taskRepository.deleteById(taskId);
            if (deleted) {
                return java.util.Map.of("success", true, "message", "Task with ID " + taskId + " was successfully deleted.");
            } else {
                return java.util.Map.of("success", false, "message", "Task with ID " + taskId + " was not found.");
            }
        } catch (NumberFormatException e) {
            return java.util.Map.of("success", false, "message", "Invalid task ID format: " + id);
        }
    }
}
