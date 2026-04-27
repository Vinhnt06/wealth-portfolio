package com.yourfin.api.service;

import com.yourfin.api.model.audit.SecurityAuditLog;
import com.yourfin.api.repository.audit.SecurityAuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class SecurityAuditService {

    private static final Logger logger = LoggerFactory.getLogger(SecurityAuditService.class);

    private final SecurityAuditLogRepository auditLogRepository;

    public SecurityAuditService(SecurityAuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void logFailedLogin(String ipAddress, String email) {
        SecurityAuditLog log = new SecurityAuditLog("FAILED_LOGIN", ipAddress, "WARNING");
        log.setUserId(email);
        log.setDetails("Failed login attempt for email: " + email);
        auditLogRepository.save(log);
        logger.warn("Failed login attempt from IP: {} for email: {}", ipAddress, email);
    }

    public void logUnauthorizedAccess(String ipAddress, String endpoint, String userId) {
        SecurityAuditLog log = new SecurityAuditLog("UNAUTHORIZED_ACCESS", ipAddress, "WARNING");
        log.setUserId(userId);
        log.setEndpoint(endpoint);
        log.setDetails("Unauthorized access attempt to: " + endpoint);
        auditLogRepository.save(log);
        logger.warn("Unauthorized access from IP: {} to endpoint: {}", ipAddress, endpoint);
    }

    public void logRateLimitViolation(String ipAddress, String endpoint) {
        SecurityAuditLog log = new SecurityAuditLog("RATE_LIMIT_EXCEEDED", ipAddress, "WARNING");
        log.setEndpoint(endpoint);
        log.setDetails("Rate limit exceeded for endpoint: " + endpoint);
        auditLogRepository.save(log);
        logger.warn("Rate limit exceeded from IP: {} for endpoint: {}", ipAddress, endpoint);
    }

    public void logSuspiciousActivity(String ipAddress, String details) {
        SecurityAuditLog log = new SecurityAuditLog("SUSPICIOUS_ACTIVITY", ipAddress, "CRITICAL");
        log.setDetails(details);
        auditLogRepository.save(log);
        logger.error("Suspicious activity detected from IP: {} - {}", ipAddress, details);
    }

    public void logSuccessfulLogin(String ipAddress, String userId) {
        SecurityAuditLog log = new SecurityAuditLog("SUCCESSFUL_LOGIN", ipAddress, "INFO");
        log.setUserId(userId);
        log.setDetails("Successful login");
        auditLogRepository.save(log);
        logger.info("Successful login from IP: {} for user: {}", ipAddress, userId);
    }
}
