package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "transport_operators")
@Getter @Setter @NoArgsConstructor
public class TransportOperator {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false, unique = true, length = 140)
    private String name;
    private String code;
    private String phone;
    private String email;
    private boolean approved = true;
    private Instant createdAt = Instant.now();

    public TransportOperator(String name, String code, String phone, String email) {
        this.name = name; this.code = code; this.phone = phone; this.email = email;
    }
}
