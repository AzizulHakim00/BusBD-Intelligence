package com.busbd.intelligence.service;

import com.busbd.intelligence.domain.*;
import com.busbd.intelligence.repository.PlatformStore;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.qrcode.QRCodeWriter;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;

@Service
@Transactional
public class BookingService {
    public record BookingCommand(String holdId, String passengerName, String passengerEmail,
                                 String passengerPhone, String paymentProvider) { }

    private final PlatformStore store;
    private final SeatLockService seatLocks;
    private final SecureRandom random = new SecureRandom();

    public BookingService(PlatformStore store, SeatLockService seatLocks) {
        this.store = store; this.seatLocks = seatLocks;
    }

    public Map<String, Object> seatMap(UUID tripId) {
        Trip trip = store.trip(tripId).orElseThrow(() -> new NoSuchElementException("Trip not found"));
        Bus bus = store.bus(trip.getBusId()).orElseThrow(() -> new NoSuchElementException("Bus not found"));
        Set<String> booked = new TreeSet<>();
        store.bookingsForTrip(tripId).forEach(b -> booked.addAll(Arrays.asList(b.getSeatNumbers().split(","))));
        Set<String> locked = seatLocks.lockedSeats(tripId);
        List<Map<String, Object>> seats = new ArrayList<>();
        for (int i = 1; i <= bus.getSeatCount(); i++) {
            String seat = seatLabel(i);
            String status = booked.contains(seat) ? "BOOKED" : locked.contains(seat) ? "LOCKED" : "AVAILABLE";
            seats.add(Map.of("number", seat, "status", status));
        }
        return Map.of("tripId", tripId, "coachType", bus.getCoachType(), "seatCount", bus.getSeatCount(), "seats", seats);
    }

    public SeatLockService.SeatHold hold(UUID tripId, Collection<String> seats, String owner) {
        Set<String> booked = new HashSet<>();
        store.bookingsForTrip(tripId).forEach(b -> booked.addAll(Arrays.asList(b.getSeatNumbers().split(","))));
        seats.stream().map(String::toUpperCase).filter(booked::contains).findFirst().ifPresent(s -> {
            throw new IllegalStateException("Seat " + s + " has already been booked");
        });
        return seatLocks.create(tripId, seats, owner);
    }

    public Map<String, Object> confirm(BookingCommand command) {
        SeatLockService.SeatHold hold = seatLocks.get(command.holdId())
                .orElseThrow(() -> new IllegalStateException("Seat hold expired. Please select seats again."));
        Trip trip = store.trip(hold.tripId()).orElseThrow(() -> new NoSuchElementException("Trip not found"));
        Set<String> booked = new HashSet<>();
        store.bookingsForTrip(trip.getId()).forEach(b -> booked.addAll(Arrays.asList(b.getSeatNumbers().split(","))));
        hold.seats().stream().filter(booked::contains).findFirst().ifPresent(s -> {
            throw new IllegalStateException("Seat " + s + " is no longer available");
        });

        BigDecimal total = trip.getFare().multiply(BigDecimal.valueOf(hold.seats().size()));
        String reference = "BBD" + (100000 + random.nextInt(900000));
        Booking booking = new Booking(reference, trip.getId(), command.passengerName(), command.passengerEmail(),
                command.passengerPhone(), String.join(",", hold.seats()), total);
        booking.setPaymentProvider(Optional.ofNullable(command.paymentProvider()).orElse("MOCK"));
        booking.setPaymentReference("PAY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        booking.setQrPayload("BUSBD|" + reference + "|" + trip.getId() + "|" + booking.getSeatNumbers());
        store.save(booking);
        trip.setAvailableSeats(Math.max(0, trip.getAvailableSeats() - hold.seats().size()));
        store.save(trip);
        store.save(new AuditLog(command.passengerEmail(), "BOOKING_CONFIRMED", "Booking", reference,
                "Seats=" + booking.getSeatNumbers() + ", amount=" + total));
        seatLocks.consume(command.holdId());
        return bookingView(booking);
    }

    public Map<String, Object> booking(String reference) {
        return bookingView(store.bookingByReference(reference).orElseThrow(() -> new NoSuchElementException("Booking not found")));
    }

    public Map<String, Object> cancel(String reference, String actor) {
        Booking booking = store.bookingByReference(reference).orElseThrow(() -> new NoSuchElementException("Booking not found"));
        if ("CANCELLED".equals(booking.getStatus())) return bookingView(booking);
        booking.setStatus("CANCELLED");
        store.save(booking);
        Trip trip = store.trip(booking.getTripId()).orElseThrow();
        trip.setAvailableSeats(trip.getAvailableSeats() + booking.getSeatNumbers().split(",").length);
        store.save(trip);
        store.save(new AuditLog(actor, "BOOKING_CANCELLED", "Booking", reference, "Mock refund initiated"));
        return bookingView(booking);
    }

    private Map<String, Object> bookingView(Booking b) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("reference", b.getReference());
        view.put("tripId", b.getTripId());
        view.put("passengerName", b.getPassengerName());
        view.put("passengerEmail", b.getPassengerEmail());
        view.put("seats", Arrays.asList(b.getSeatNumbers().split(",")));
        view.put("totalAmount", b.getTotalAmount());
        view.put("status", b.getStatus());
        view.put("paymentProvider", b.getPaymentProvider());
        view.put("paymentReference", b.getPaymentReference());
        view.put("createdAt", b.getCreatedAt());
        view.put("qrCode", qrDataUri(b.getQrPayload()));
        return view;
    }

    private String qrDataUri(String payload) {
        try {
            var matrix = new QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, 240, 240);
            var out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", out);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(out.toByteArray());
        } catch (Exception e) {
            return Base64.getEncoder().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        }
    }

    private String seatLabel(int index) {
        int row = (index - 1) / 4 + 1;
        char column = (char) ('A' + (index - 1) % 4);
        return row + String.valueOf(column);
    }
}
