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
    public record PassengerRequest(@NotBlank String fullName, String passengerType, String gender, @NotBlank String seatNumber, String phone) { }
    public record ConfirmRequest(@NotBlank String holdId, @NotBlank String passengerName, @Email String passengerEmail,
                                 String passengerPhone, String paymentProvider, String boardingPoint, String droppingPoint,
                                 String promoCode, String idempotencyKey, List<PassengerRequest> passengers) { }
    public record CancelRequest(String reason) { }
    public record VerifyRequest(@NotBlank String token) { }

    private final BookingService bookingService;
    public BookingController(BookingService bookingService) { this.bookingService = bookingService; }

    @GetMapping("/trips/{tripId}/seats")
    public Map<String, Object> seats(@PathVariable UUID tripId) { return bookingService.seatMap(tripId); }
    @PostMapping("/seat-holds")
    public SeatLockService.SeatHold hold(@Valid @RequestBody HoldRequest request) {
        return bookingService.hold(request.tripId(), request.seats(), request.ownerEmail());
    }
    @PostMapping("/bookings")
    public Map<String, Object> confirm(@Valid @RequestBody ConfirmRequest request,
                                       @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyHeader) {
        List<BookingService.PassengerCommand> passengers = request.passengers() == null ? List.of() : request.passengers().stream()
                .map(p -> new BookingService.PassengerCommand(p.fullName(), p.passengerType(), p.gender(), p.seatNumber(), p.phone())).toList();
        String idempotency = Optional.ofNullable(idempotencyHeader).filter(s -> !s.isBlank()).orElse(request.idempotencyKey());
        return bookingService.confirm(new BookingService.BookingCommand(request.holdId(), request.passengerName(), request.passengerEmail(),
                request.passengerPhone(), request.paymentProvider(), request.boardingPoint(), request.droppingPoint(), request.promoCode(), idempotency, passengers));
    }
    @GetMapping("/bookings/{reference}")
    public Map<String, Object> booking(@PathVariable String reference) { return bookingService.booking(reference); }
    @GetMapping("/bookings")
    public List<Map<String, Object>> mine(Authentication authentication) { return bookingService.bookingsForUser(authentication.getName()); }
    @PostMapping("/bookings/{reference}/cancel")
    public Map<String, Object> cancel(@PathVariable String reference, @RequestBody(required = false) CancelRequest request, Authentication authentication) {
        boolean privileged = authentication.getAuthorities().stream().anyMatch(a -> Set.of("ROLE_SUPER_ADMIN", "ROLE_OPERATOR_STAFF", "ROLE_SUPPORT_AGENT").contains(a.getAuthority()));
        return bookingService.cancel(reference, authentication.getName(), privileged, request == null ? null : request.reason());
    }
    @PostMapping("/tickets/verify")
    public Map<String, Object> verify(@Valid @RequestBody VerifyRequest request) { return bookingService.verifyTicket(request.token()); }
}
