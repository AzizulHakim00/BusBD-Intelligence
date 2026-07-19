package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "drivers")
@Getter @Setter @NoArgsConstructor
public class DriverProfile {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false)
    private UUID operatorId;
    @Column(unique = true)
    private UUID userId;
    @Column(nullable = false)
    private String fullName;
    @Column(nullable = false, unique = true)
    private String licenseNumber;
    private String phone;
    private boolean active = true;
    private double safetyScore = 4.7;

    public DriverProfile(UUID operatorId, String fullName, String licenseNumber, String phone) {
        this.operatorId = operatorId; this.fullName = fullName;
        this.licenseNumber = licenseNumber; this.phone = phone;
    }
}
