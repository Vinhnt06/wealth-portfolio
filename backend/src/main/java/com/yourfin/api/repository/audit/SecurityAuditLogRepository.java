package com.yourfin.api.repository.audit;

import com.yourfin.api.model.audit.SecurityAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SecurityAuditLogRepository extends JpaRepository<SecurityAuditLog, Long> {

    List<SecurityAuditLog> findByIpAddressAndTimestampAfter(String ipAddress, LocalDateTime timestamp);

    List<SecurityAuditLog> findByEventTypeAndTimestampAfter(String eventType, LocalDateTime timestamp);

    List<SecurityAuditLog> findBySeverityAndTimestampAfter(String severity, LocalDateTime timestamp);
}
