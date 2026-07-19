package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "routes")
@Getter @Setter @NoArgsConstructor
public class RoutePlan {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false)
    private String origin;
    @Column(nullable = false)
    private String destination;
    private double distanceKm;
    @Column(length = 1200)
    private String stopsCsv;
    private boolean active = true;

    public RoutePlan(String origin, String destination, double distanceKm, String stopsCsv) {
        this.origin = origin; this.destination = destination;
        this.distanceKm = distanceKm; this.stopsCsv = stopsCsv;
    }
}
