-- Security Audit Log Table
CREATE TABLE security_audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_id VARCHAR(255),
    endpoint VARCHAR(255),
    details TEXT,
    timestamp TIMESTAMP NOT NULL,
    severity VARCHAR(20) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_audit_log_ip ON security_audit_log(ip_address);
CREATE INDEX idx_audit_log_event ON security_audit_log(event_type);
CREATE INDEX idx_audit_log_severity ON security_audit_log(severity);
CREATE INDEX idx_audit_log_timestamp ON security_audit_log(timestamp);
