package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bookings", indexes = @Index(name = "idx_booking_reference", columnList = "reference", unique = true))
@Getter @Setter @NoArgsConstructor
public class Booking {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false, unique = true, length = 20)
    private String reference;
    @Column(nullable = false)
    private UUID tripId;
    @Column(nullable = false)
    private String passengerName;
    @Column(nullable = false)
    private String passengerEmail;
    private String passengerPhone;
    @Column(nullable = false, length = 300)
    private String seatNumbers;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;
    @Column(nullable = false)
    private String status;
    private String paymentProvider;
    private String paymentReference;
    @Column(length = 1000)
    private String qrPayload;
    private Instant createdAt = Instant.now();

    public Booking(String reference, UUID tripId, String passengerName, String passengerEmail,
                   String passengerPhone, String seatNumbers, BigDecimal totalAmount) {
        this.reference = reference; this.tripId = tripId; this.passengerName = passengerName;
        this.passengerEmail = passengerEmail; this.passengerPhone = passengerPhone;
        this.seatNumbers = seatNumbers; this.totalAmount = totalAmount; this.status = "CONFIRMED";
    }
}
