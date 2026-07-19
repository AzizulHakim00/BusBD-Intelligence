package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "booking_passengers", indexes = @Index(name = "idx_booking_passenger_booking", columnList = "booking_id"))
@Getter @Setter @NoArgsConstructor
public class BookingPassenger {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false)
    private UUID bookingId;
    @Column(nullable = false)
    private String fullName;
    @Column(nullable = false)
    private String passengerType = "ADULT";
    private String gender;
    @Column(nullable = false)
    private String seatNumber;
    private String phone;

    public BookingPassenger(UUID bookingId, String fullName, String passengerType, String gender, String seatNumber, String phone) {
        this.bookingId = bookingId; this.fullName = fullName; this.passengerType = passengerType;
        this.gender = gender; this.seatNumber = seatNumber; this.phone = phone;
    }
}
