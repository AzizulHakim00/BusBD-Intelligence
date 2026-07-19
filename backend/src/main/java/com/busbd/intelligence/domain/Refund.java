package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refunds")
@Getter @Setter @NoArgsConstructor
public class Refund {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false, unique = true)
    private UUID bookingId;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;
    @Column(nullable = false)
    private String status;
    private String reason;
    private String providerReference;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();
    private Instant processedAt;

    public Refund(UUID bookingId, BigDecimal amount, String reason) {
        this.bookingId = bookingId; this.amount = amount; this.reason = reason;
        this.status = "COMPLETED"; this.processedAt = Instant.now();
        this.providerReference = "RFD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
