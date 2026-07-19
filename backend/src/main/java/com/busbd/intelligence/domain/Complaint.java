package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "complaints")
@Getter @Setter @NoArgsConstructor
public class Complaint {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false)
    private String passengerEmail;
    @Column(nullable = false)
    private String category;
    @Column(nullable = false, length = 2500)
    private String message;
    @Column(nullable = false)
    private String status = "OPEN";
    private String aiClassification;
    private Instant createdAt = Instant.now();

    public Complaint(String passengerEmail, String category, String message) {
        this.passengerEmail = passengerEmail; this.category = category; this.message = message;
    }
}
