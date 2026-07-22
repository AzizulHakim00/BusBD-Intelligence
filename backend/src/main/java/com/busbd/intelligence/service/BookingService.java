package com.busbd.intelligence.service;

import com.busbd.intelligence.domain.*;
import com.busbd.intelligence.repository.PlatformStore;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.qrcode.QRCodeWriter;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;

@Service
@Transactional
public class BookingService {
    public record PassengerCommand(String fullName, String passengerType, String gender, String seatNumber, String phone) { }
    public record BookingCommand(String holdId, String passengerName, String passengerEmail, String passengerPhone,
                                 String paymentProvider, String boardingPoint, String droppingPoint, String promoCode,
                                 String idempotencyKey, List<PassengerCommand> passengers) { }

    private final PlatformStore store;
    private final SeatLockService seatLocks;
    private final TicketService tickets;
    private final SecureRandom random = new SecureRandom();
    private final long fullRefundHours;
    private final long partialRefundHours;

    public BookingService(PlatformStore store, SeatLockService seatLocks, TicketService tickets,
                          @Value("${busbd.cancellation.full-refund-hours:24}") long fullRefundHours,
                          @Value("${busbd.cancellation.partial-refund-hours:6}") long partialRefundHours) {
        this.store = store;
        this.seatLocks = seatLocks;
        this.tickets = tickets;
        this.fullRefundHours = fullRefundHours;
        this.partialRefundHours = partialRefundHours;
    }

    public Map<String, Object> seatMap(UUID tripId) {
        Trip trip = store.trip(tripId).orElseThrow(() -> new NoSuchElementException("Trip not found"));
        Bus bus = store.bus(trip.getBusId()).orElseThrow(() -> new NoSuchElementException("Bus not found"));
        Set<String> booked = new TreeSet<>();
        store.reservationsForTrip(tripId).forEach(r -> booked.add(r.getSeatNumber()));
        Set<String> locked = seatLocks.lockedSeats(tripId);
        Set<String> blocked = csvSet(bus.getBlockedSeats());
        Set<String> women = csvSet(bus.getWomenReservedSeats());
        List<Map<String, Object>> seats = new ArrayList<>();
        for (int i = 1; i <= bus.getSeatCount(); i++) {
            SeatCoordinate coordinate = seatCoordinate(i, bus.getSeatLayout());
            String seat = coordinate.label();
            String status = booked.contains(seat) ? "BOOKED" : locked.contains(seat) ? "LOCKED" : blocked.contains(seat) ? "BLOCKED" : "AVAILABLE";
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("number", seat);
            item.put("status", status);
            item.put("row", coordinate.row());
            item.put("column", coordinate.column());
            item.put("aisleAfter", coordinate.aisleAfter());
            item.put("category", women.contains(seat) ? "WOMEN_RESERVED" : bus.getCoachType().toLowerCase().contains("sleeper") ? "SLEEPER" : "REGULAR");
            item.put("price", trip.getFare());
            seats.add(item);
        }
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("tripId", tripId);
        view.put("coachType", bus.getCoachType());
        view.put("seatLayout", bus.getSeatLayout());
        view.put("seatCount", bus.getSeatCount());
        view.put("lockMinutes", 5);
        view.put("seats", seats);
        return view;
    }

    public SeatLockService.SeatHold hold(UUID tripId, Collection<String> seats, String owner) {
        Trip trip = store.trip(tripId).orElseThrow(() -> new NoSuchElementException("Trip not found"));
        if (!"SCHEDULED".equals(trip.getStatus())) throw new IllegalStateException("This trip is not open for booking");
        Set<String> booked = new HashSet<>();
        store.reservationsForTrip(tripId).forEach(r -> booked.add(r.getSeatNumber()));
        seats.stream().map(s -> s.toUpperCase(Locale.ROOT)).filter(booked::contains).findFirst()
                .ifPresent(s -> { throw new IllegalStateException("Seat " + s + " has already been booked"); });
        Bus bus = store.bus(trip.getBusId()).orElseThrow();
        Set<String> valid = new HashSet<>();
        for (int i = 1; i <= bus.getSeatCount(); i++) valid.add(seatCoordinate(i, bus.getSeatLayout()).label());
        seats.stream().map(s -> s.toUpperCase(Locale.ROOT)).filter(s -> !valid.contains(s)).findFirst()
                .ifPresent(s -> { throw new IllegalArgumentException("Seat " + s + " does not exist on this bus"); });
        return seatLocks.create(tripId, seats, owner);
    }

    public Map<String, Object> confirm(BookingCommand command) {
        Optional<Booking> prior = store.bookingByIdempotencyKey(command.idempotencyKey());
        if (prior.isPresent()) return bookingView(prior.get());
        SeatLockService.SeatHold hold = seatLocks.get(command.holdId())
                .orElseThrow(() -> new IllegalStateException("Seat hold expired. Please select seats again."));
        Trip trip = store.trip(hold.tripId()).orElseThrow(() -> new NoSuchElementException("Trip not found"));
        Bus bus = store.bus(trip.getBusId()).orElseThrow();
        RoutePlan route = store.route(trip.getRouteId()).orElseThrow();
        Set<String> booked = new HashSet<>();
        store.reservationsForTrip(trip.getId()).forEach(r -> booked.add(r.getSeatNumber()));
        hold.seats().stream().filter(booked::contains).findFirst()
                .ifPresent(s -> { throw new IllegalStateException("Seat " + s + " is no longer available"); });

        String boarding = choosePoint(command.boardingPoint(), trip.getBoardingPoint(), route.getBoardingPointsCsv(), route.getOrigin(), "boarding");
        String dropping = choosePoint(command.droppingPoint(), trip.getDroppingPoint(), route.getDroppingPointsCsv(), route.getDestination(), "dropping");
        List<PassengerCommand> passengers = normalizePassengers(command, hold.seats());
        validateWomenSeats(bus, passengers);
        BigDecimal subtotal = trip.getFare().multiply(BigDecimal.valueOf(hold.seats().size()));
        BigDecimal discount = childDiscount(trip.getFare(), passengers).add(promoDiscount(subtotal, command.promoCode()));
        if (discount.compareTo(subtotal.multiply(new BigDecimal("0.30"))) > 0) discount = subtotal.multiply(new BigDecimal("0.30"));
        discount = discount.setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.subtract(discount).setScale(2, RoundingMode.HALF_UP);

        String reference = nextReference();
        Booking booking = new Booking(reference, trip.getId(), command.passengerName(), command.passengerEmail(),
                command.passengerPhone(), String.join(",", hold.seats()), boarding, dropping, subtotal, discount, total);
        store.userByEmail(command.passengerEmail()).ifPresent(u -> booking.setUserId(u.getId()));
        booking.setPromoCode(blankToNull(command.promoCode()));
        booking.setIdempotencyKey(blankToNull(command.idempotencyKey()));
        booking.setPaymentProvider(Optional.ofNullable(command.paymentProvider()).filter(s -> !s.isBlank()).orElse("MOCK"));
        booking.setPaymentStatus("PAID");
        booking.setPaymentReference("PAY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        store.save(booking);
        store.flush();
        for (String seat : hold.seats()) store.save(new BookingSeatReservation(booking.getId(), trip.getId(), seat));
        for (PassengerCommand passenger : passengers) {
            store.save(new BookingPassenger(booking.getId(), passenger.fullName(), normalizeType(passenger.passengerType()),
                    normalizeGender(passenger.gender()), passenger.seatNumber().toUpperCase(Locale.ROOT), passenger.phone()));
        }
        booking.setQrPayload(tickets.issue(booking));
        store.save(booking);
        store.flush();
        trip.setAvailableSeats(Math.max(0, trip.getAvailableSeats() - hold.seats().size()));
        store.save(trip);
        store.save(new AuditLog(command.passengerEmail(), "BOOKING_CONFIRMED", "Booking", reference,
                "Seats=" + booking.getSeatNumbers() + ", amount=" + total + ", boarding=" + boarding + ", dropping=" + dropping));
        seatLocks.consume(command.holdId());
        return bookingView(booking);
    }

    public Map<String, Object> booking(String reference) {
        return bookingView(store.bookingByReference(reference).orElseThrow(() -> new NoSuchElementException("Booking not found")));
    }

    public List<Map<String, Object>> bookingsForUser(String email) {
        return store.bookingsByEmail(email).stream().map(this::bookingView).toList();
    }

    public Map<String, Object> cancel(String reference, String actor, boolean privileged, String reason) {
        Booking booking = store.bookingByReference(reference).orElseThrow(() -> new NoSuchElementException("Booking not found"));
        if (!privileged && !booking.getPassengerEmail().equalsIgnoreCase(actor)) throw new SecurityException("You cannot cancel another passenger's booking");
        if ("CANCELLED".equals(booking.getStatus())) return bookingView(booking);
        Trip trip = store.trip(booking.getTripId()).orElseThrow();
        long hours = Duration.between(OffsetDateTime.now(), trip.getDepartureTime()).toHours();
        if (hours < partialRefundHours) throw new IllegalStateException("Online cancellation is closed less than " + partialRefundHours + " hours before departure");
        BigDecimal rate = hours >= fullRefundHours ? new BigDecimal("0.90") : new BigDecimal("0.70");
        BigDecimal refundAmount = booking.getTotalAmount().multiply(rate).setScale(2, RoundingMode.HALF_UP);
        booking.setStatus("CANCELLED");
        booking.setCancellationReason(Optional.ofNullable(reason).orElse("Passenger cancellation"));
        booking.setCancelledAt(Instant.now());
        booking.setRefundStatus("COMPLETED");
        booking.setRefundAmount(refundAmount);
        store.save(booking);
        store.save(new Refund(booking.getId(), refundAmount, booking.getCancellationReason()));
        store.deleteReservationsForBooking(booking.getId());
        trip.setAvailableSeats(Math.min(store.bus(trip.getBusId()).orElseThrow().getSeatCount(),
                trip.getAvailableSeats() + booking.getSeatNumbers().split(",").length));
        store.save(trip);
        store.save(new AuditLog(actor, "BOOKING_CANCELLED", "Booking", reference, "Mock refund completed: " + refundAmount));
        return bookingView(booking);
    }

    public Map<String, Object> verifyTicket(String token) {
        Map<String, Object> signature = tickets.verify(token);
        if (!Boolean.TRUE.equals(signature.get("valid"))) return signature;
        Booking booking = store.bookingByReference(String.valueOf(signature.get("reference"))).orElse(null);
        if (booking == null) return Map.of("valid", false, "reason", "Booking was not found");
        Map<String, Object> result = new LinkedHashMap<>(signature);
        result.put("bookingStatus", booking.getStatus());
        result.put("passengerName", booking.getPassengerName());
        result.put("boardingPoint", booking.getBoardingPoint());
        result.put("droppingPoint", booking.getDroppingPoint());
        result.put("travelAllowed", "CONFIRMED".equals(booking.getStatus()) && "PAID".equals(booking.getPaymentStatus()));
        return result;
    }

    private Map<String, Object> bookingView(Booking b) {
        Trip trip = store.trip(b.getTripId()).orElseThrow();
        RoutePlan route = store.route(trip.getRouteId()).orElseThrow();
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("reference", b.getReference());
        view.put("tripId", b.getTripId());
        view.put("passengerName", b.getPassengerName());
        view.put("passengerEmail", b.getPassengerEmail());
        view.put("passengerPhone", b.getPassengerPhone());
        view.put("seats", Arrays.asList(b.getSeatNumbers().split(",")));
        view.put("boardingPoint", b.getBoardingPoint());
        view.put("droppingPoint", b.getDroppingPoint());
        view.put("origin", route.getOrigin());
        view.put("destination", route.getDestination());
        view.put("departureTime", trip.getDepartureTime());
        view.put("arrivalTime", trip.getArrivalTime());
        view.put("subtotal", b.getSubtotal());
        view.put("discountAmount", b.getDiscountAmount());
        view.put("totalAmount", b.getTotalAmount());
        view.put("promoCode", b.getPromoCode());
        view.put("status", b.getStatus());
        view.put("paymentStatus", b.getPaymentStatus());
        view.put("paymentProvider", b.getPaymentProvider());
        view.put("paymentReference", b.getPaymentReference());
        view.put("refundStatus", b.getRefundStatus());
        view.put("refundAmount", b.getRefundAmount());
        view.put("createdAt", b.getCreatedAt());
        view.put("passengers", store.passengersForBooking(b.getId()));
        view.put("ticketToken", b.getQrPayload());
        view.put("qrCode", qrDataUri(b.getQrPayload()));
        return view;
    }

    private List<PassengerCommand> normalizePassengers(BookingCommand command, Set<String> heldSeats) {
        List<PassengerCommand> input = command.passengers() == null ? List.of() : command.passengers();
        Map<String, PassengerCommand> bySeat = new HashMap<>();
        input.forEach(p -> {
            if (p.seatNumber() != null) bySeat.put(p.seatNumber().toUpperCase(Locale.ROOT), p);
        });
        List<PassengerCommand> result = new ArrayList<>();
        for (String seat : heldSeats) {
            PassengerCommand p = bySeat.get(seat);
            if (p == null) p = new PassengerCommand(command.passengerName(), "ADULT", "", seat, command.passengerPhone());
            if (p.fullName() == null || p.fullName().isBlank()) throw new IllegalArgumentException("Passenger name is required for seat " + seat);
            result.add(new PassengerCommand(p.fullName().trim(), normalizeType(p.passengerType()),
                    normalizeGender(p.gender()), seat, p.phone()));
        }
        return result;
    }

    private void validateWomenSeats(Bus bus, List<PassengerCommand> passengers) {
        Set<String> womenSeats = csvSet(bus.getWomenReservedSeats());
        passengers.stream().filter(p -> womenSeats.contains(p.seatNumber()) && "MALE".equals(p.gender())).findFirst()
                .ifPresent(p -> { throw new IllegalArgumentException("Seat " + p.seatNumber() + " is reserved for women passengers"); });
    }

    private String choosePoint(String requested, String tripDefault, String csv, String routeDefault, String type) {
        String chosen = Optional.ofNullable(requested).filter(s -> !s.isBlank())
                .orElse(Optional.ofNullable(tripDefault).filter(s -> !s.isBlank()).orElse(routeDefault));
        Set<String> allowed = csvSet(csv);
        addPoint(allowed, routeDefault);
        addPoint(allowed, tripDefault);
        if (!allowed.isEmpty() && allowed.stream().noneMatch(p -> p.equalsIgnoreCase(chosen))) {
            throw new IllegalArgumentException("Invalid " + type + " point");
        }
        return chosen;
    }

    private void addPoint(Set<String> points, String point) {
        if (point != null && !point.isBlank()) points.add(point.trim());
    }

    private BigDecimal childDiscount(BigDecimal fare, List<PassengerCommand> passengers) {
        long children = passengers.stream().filter(p -> "CHILD".equals(normalizeType(p.passengerType()))).count();
        return fare.multiply(new BigDecimal("0.15")).multiply(BigDecimal.valueOf(children));
    }

    private BigDecimal promoDiscount(BigDecimal subtotal, String promo) {
        return "BUSBD10".equalsIgnoreCase(Optional.ofNullable(promo).orElse(""))
                ? subtotal.multiply(new BigDecimal("0.10")) : BigDecimal.ZERO;
    }

    private String normalizeType(String value) { return "CHILD".equalsIgnoreCase(value) ? "CHILD" : "ADULT"; }
    private String normalizeGender(String value) {
        if ("FEMALE".equalsIgnoreCase(value)) return "FEMALE";
        if ("MALE".equalsIgnoreCase(value)) return "MALE";
        return "";
    }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private String nextReference() {
        for (int i = 0; i < 20; i++) {
            String reference = "BBD" + (100000 + random.nextInt(900000));
            if (store.bookingByReference(reference).isEmpty()) return reference;
        }
        return "BBD" + System.currentTimeMillis();
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

    private Set<String> csvSet(String csv) {
        Set<String> result = new LinkedHashSet<>();
        if (csv != null && !csv.isBlank()) {
            Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isBlank()).forEach(result::add);
        }
        return result;
    }

    private SeatCoordinate seatCoordinate(int index, String layout) {
        String normalized = Optional.ofNullable(layout).orElse("2X2").toUpperCase(Locale.ROOT);
        int columns = switch (normalized) { case "1X1" -> 2; case "2X1" -> 3; default -> 4; };
        int row = (index - 1) / columns + 1;
        int column = (index - 1) % columns;
        char letter = (char) ('A' + column);
        int aisleAfter = switch (normalized) { case "1X1" -> 1; case "2X1" -> 2; default -> 2; };
        return new SeatCoordinate(row + String.valueOf(letter), row, String.valueOf(letter), column + 1 == aisleAfter);
    }

    private record SeatCoordinate(String label, int row, String column, boolean aisleAfter) { }
}
