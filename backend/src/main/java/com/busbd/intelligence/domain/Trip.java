package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "trips")
@Getter @Setter @NoArgsConstructor
public class Trip {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false)
    private UUID busId;
    @Column(nullable = false)
    private UUID routeId;
    private UUID driverId;
    @Column(nullable = false)
    private OffsetDateTime departureTime;
    @Column(nullable = false)
    private OffsetDateTime arrivalTime;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal fare;
    @Column(nullable = false)
    private String status = "SCHEDULED";
    private String boardingPoint;
    private String droppingPoint;
    private int availableSeats;
    private double delayRisk = 0.12;

    public Trip(UUID busId, UUID routeId, UUID driverId, OffsetDateTime departureTime,
                OffsetDateTime arrivalTime, BigDecimal fare, int availableSeats) {
        this.busId = busId; this.routeId = routeId; this.driverId = driverId;
        this.departureTime = departureTime; this.arrivalTime = arrivalTime;
        this.fare = fare; this.availableSeats = availableSeats;
    }
}
