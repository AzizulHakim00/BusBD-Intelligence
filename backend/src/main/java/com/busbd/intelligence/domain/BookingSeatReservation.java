package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "booking_seat_reservations", uniqueConstraints = @UniqueConstraint(name = "uq_trip_seat", columnNames = {"trip_id", "seat_number"}))
@Getter @Setter @NoArgsConstructor
public class BookingSeatReservation {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false)
    private UUID bookingId;
    @Column(nullable = false)
    private UUID tripId;
    @Column(nullable = false)
    private String seatNumber;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public BookingSeatReservation(UUID bookingId, UUID tripId, String seatNumber) {
        this.bookingId = bookingId; this.tripId = tripId; this.seatNumber = seatNumber;
    }
}
