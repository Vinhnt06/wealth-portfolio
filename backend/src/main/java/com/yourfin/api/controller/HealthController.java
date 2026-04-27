package com.yourfin.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class HealthController {

    private final Instant startTime = Instant.now();

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("timestamp", Instant.now().toString());
        health.put("uptime", getUptime());
        health.put("service", "YourFin API");
        health.put("version", "1.0.0");
        return ResponseEntity.ok(health);
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        Map<String, Object> status = new HashMap<>();
        status.put("status", "RUNNING");
        status.put("timestamp", Instant.now().toString());
        status.put("uptime", getUptime());
        status.put("service", "YourFin API");
        status.put("version", "1.0.0");
        status.put("environment", "production");

        // Database status
        Map<String, String> database = new HashMap<>();
        database.put("status", "CONNECTED");
        database.put("type", "PostgreSQL");
        status.put("database", database);

        // API endpoints
        Map<String, String> endpoints = new HashMap<>();
        endpoints.put("auth", "/api/auth/*");
        endpoints.put("assets", "/api/assets");
        endpoints.put("market", "/api/market/*");
        endpoints.put("profile", "/api/profile");
        status.put("endpoints", endpoints);

        return ResponseEntity.ok(status);
    }

    private String getUptime() {
        long uptimeSeconds = Instant.now().getEpochSecond() - startTime.getEpochSecond();
        long hours = uptimeSeconds / 3600;
        long minutes = (uptimeSeconds % 3600) / 60;
        long seconds = uptimeSeconds % 60;
        return String.format("%dh %dm %ds", hours, minutes, seconds);
    }
}
