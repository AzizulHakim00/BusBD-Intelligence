package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "buses")
@Getter @Setter @NoArgsConstructor
public class Bus {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false)
    private UUID operatorId;
    @Column(nullable = false, unique = true)
    private String registrationNumber;
    @Column(nullable = false)
    private String model;
    @Column(nullable = false)
    private String coachType;
    @Column(nullable = false)
    private int seatCount;
    private boolean active = true;
    private String amenities;
    private double healthScore = 92.0;

    public Bus(UUID operatorId, String registrationNumber, String model, String coachType, int seatCount) {
        this.operatorId = operatorId; this.registrationNumber = registrationNumber;
        this.model = model; this.coachType = coachType; this.seatCount = seatCount;
    }
}
