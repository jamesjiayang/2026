package com.example.mcprest.repository;

import com.example.mcprest.model.Task;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Repository
public class TaskRepository {
    private final ConcurrentHashMap<Long, Task> tasks = new ConcurrentHashMap<>();
    private final AtomicLong idGenerator = new AtomicLong(1);

    public TaskRepository() {
        // Seed some initial data
        save(new Task(null, "Configure MCP", "Set up Model Context Protocol in Java", true));
        save(new Task(null, "Build REST Endpoints", "Expose HTTP methods to retrieve and create tasks", false));
        save(new Task(null, "Test Integration", "Verify MCP tools and REST endpoints are working together", false));
    }

    public List<Task> findAll() {
        return new ArrayList<>(tasks.values());
    }

    public Optional<Task> findById(Long id) {
        return Optional.ofNullable(tasks.get(id));
    }

    public Task save(Task task) {
        if (task.getId() == null) {
            long newId = idGenerator.getAndIncrement();
            task.setId(newId);
        }
        tasks.put(task.getId(), task);
        return task;
    }

    public boolean deleteById(Long id) {
        return tasks.remove(id) != null;
    }
}
