package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
@Getter @Setter @NoArgsConstructor
public class AuditLog {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    private String actor;
    private String action;
    private String resourceType;
    private String resourceId;
    @Column(length = 2000)
    private String details;
    private Instant createdAt = Instant.now();

    public AuditLog(String actor, String action, String resourceType, String resourceId, String details) {
        this.actor = actor; this.action = action; this.resourceType = resourceType;
        this.resourceId = resourceId; this.details = details;
    }
}
