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
    public List<Task> listTasks() {
        return taskRepository.findAll();
    }

    @Tool(description = "Add a new task to the system")
    public Task addTask(
            @ToolParam(description = "The title of the task") String title,
            @ToolParam(description = "A detailed description of the task") String description) {
        Task task = new Task(null, title, description != null ? description : "", false);
        return taskRepository.save(task);
    }

    @Tool(description = "Delete a task from the system by its unique ID")
    public String deleteTask(
            @ToolParam(description = "The unique ID of the task to delete") Long id) {
        boolean deleted = taskRepository.deleteById(id);
        if (deleted) {
            return "Task with ID " + id + " was successfully deleted.";
        } else {
            return "Task with ID " + id + " was not found.";
        }
    }
}
