package com.busbd.intelligence.controller;

import com.busbd.intelligence.service.BookingService;
import com.busbd.intelligence.service.SeatLockService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
public class BookingController {
    public record HoldRequest(UUID tripId, @NotEmpty List<String> seats, @Email String ownerEmail) { }
    public record ConfirmRequest(@NotBlank String holdId, @NotBlank String passengerName,
                                 @Email String passengerEmail, String passengerPhone, String paymentProvider) { }

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) { this.bookingService = bookingService; }

    @GetMapping("/trips/{tripId}/seats")
    public Map<String, Object> seats(@PathVariable UUID tripId) { return bookingService.seatMap(tripId); }

    @PostMapping("/seat-holds")
    public SeatLockService.SeatHold hold(@Valid @RequestBody HoldRequest request) {
        return bookingService.hold(request.tripId(), request.seats(), request.ownerEmail());
    }

    @PostMapping("/bookings")
    public Map<String, Object> confirm(@Valid @RequestBody ConfirmRequest request) {
        return bookingService.confirm(new BookingService.BookingCommand(request.holdId(), request.passengerName(),
                request.passengerEmail(), request.passengerPhone(), request.paymentProvider()));
    }

    @GetMapping("/bookings/{reference}")
    public Map<String, Object> booking(@PathVariable String reference) { return bookingService.booking(reference); }

    @PostMapping("/bookings/{reference}/cancel")
    public Map<String, Object> cancel(@PathVariable String reference, Authentication authentication) {
        return bookingService.cancel(reference, authentication.getName());
    }
}
