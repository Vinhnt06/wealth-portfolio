package com.yourfin.api.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final Map<String, Bucket> cache = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String key = getClientKey(request);
        Bucket bucket = resolveBucket(key, request);

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Too many requests. Please try again later.\",\"timestamp\":"
                    + System.currentTimeMillis() + "}");
        }
    }

    private Bucket resolveBucket(String key, HttpServletRequest request) {
        return cache.computeIfAbsent(key, k -> createBucket(request));
    }

    private Bucket createBucket(HttpServletRequest request) {
        String path = request.getRequestURI();

        // Different rate limits for different endpoints
        if (path.startsWith("/api/auth/login")) {
            // Login: 5 requests per minute
            return Bucket.builder()
                    .addLimit(Bandwidth.classic(5, Refill.intervally(5, Duration.ofMinutes(1))))
                    .build();
        } else if (path.startsWith("/api/market")) {
            // Market data: 60 requests per minute
            return Bucket.builder()
                    .addLimit(Bandwidth.classic(60, Refill.intervally(60, Duration.ofMinutes(1))))
                    .build();
        } else {
            // Default: 100 requests per minute
            return Bucket.builder()
                    .addLimit(Bandwidth.classic(100, Refill.intervally(100, Duration.ofMinutes(1))))
                    .build();
        }
    }

    private String getClientKey(HttpServletRequest request) {
        // Use IP address as key
        String clientIp = request.getHeader("X-Forwarded-For");
        if (clientIp == null || clientIp.isEmpty()) {
            clientIp = request.getRemoteAddr();
        }
        return clientIp + ":" + request.getRequestURI();
    }
}
