package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bookings", indexes = {
        @Index(name = "idx_booking_reference", columnList = "reference", unique = true),
        @Index(name = "idx_booking_email", columnList = "passenger_email"),
        @Index(name = "idx_booking_trip", columnList = "trip_id")
})
@Getter @Setter @NoArgsConstructor
public class Booking {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false, unique = true, length = 20)
    private String reference;
    @Column(nullable = false)
    private UUID tripId;
    private UUID userId;
    @Column(nullable = false)
    private String passengerName;
    @Column(nullable = false)
    private String passengerEmail;
    private String passengerPhone;
    @Column(nullable = false, length = 300)
    private String seatNumbers;
    @Column(nullable = false)
    private String boardingPoint;
    @Column(nullable = false)
    private String droppingPoint;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal subtotal;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;
    private String promoCode;
    @Column(nullable = false)
    private String status;
    @Column(nullable = false)
    private String paymentStatus = "PAID";
    private String paymentProvider;
    private String paymentReference;
    @Column(unique = true)
    private String idempotencyKey;
    @Column(length = 1000)
    private String qrPayload;
    private String cancellationReason;
    @Column(nullable = false)
    private String refundStatus = "NOT_REQUESTED";
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal refundAmount = BigDecimal.ZERO;
    private Instant cancelledAt;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    public Booking(String reference, UUID tripId, String passengerName, String passengerEmail,
                   String passengerPhone, String seatNumbers, String boardingPoint, String droppingPoint,
                   BigDecimal subtotal, BigDecimal discountAmount, BigDecimal totalAmount) {
        this.reference = reference; this.tripId = tripId; this.passengerName = passengerName;
        this.passengerEmail = passengerEmail.toLowerCase(); this.passengerPhone = passengerPhone;
        this.seatNumbers = seatNumbers; this.boardingPoint = boardingPoint; this.droppingPoint = droppingPoint;
        this.subtotal = subtotal; this.discountAmount = discountAmount; this.totalAmount = totalAmount;
        this.status = "CONFIRMED";
    }

    @PreUpdate
    void touch() { updatedAt = Instant.now(); }
}
