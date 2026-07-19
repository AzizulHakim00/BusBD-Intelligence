package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "vehicle_locations")
@Getter @Setter @NoArgsConstructor
public class VehicleLocation {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false)
    private UUID busId;
    private UUID tripId;
    private double latitude;
    private double longitude;
    private double speedKph;
    private double heading;
    private double anomalyScore;
    private Instant recordedAt = Instant.now();

    public VehicleLocation(UUID busId, UUID tripId, double latitude, double longitude, double speedKph, double heading) {
        this.busId = busId; this.tripId = tripId; this.latitude = latitude;
        this.longitude = longitude; this.speedKph = speedKph; this.heading = heading;
    }
}
