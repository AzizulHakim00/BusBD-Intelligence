package com.busbd.intelligence.service;

import com.busbd.intelligence.domain.*;
import com.busbd.intelligence.repository.DriverProfileRepository;
import com.busbd.intelligence.repository.PlatformStore;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@Transactional
public class DriverService {
    private final PlatformStore store;
    private final DriverProfileRepository drivers;
    private final TrackingService tracking;
    public DriverService(PlatformStore store, DriverProfileRepository drivers, TrackingService tracking) {
        this.store = store; this.drivers = drivers; this.tracking = tracking;
    }

    public List<Map<String, Object>> assignments(String email) {
        DriverProfile driver = driver(email);
        return store.trips().stream().filter(t -> Objects.equals(t.getDriverId(), driver.getId()))
                .sorted(Comparator.comparing(Trip::getDepartureTime)).map(t -> assignmentView(driver, t)).toList();
    }

    public Map<String, Object> start(String email, UUID tripId) {
        DriverProfile driver = driver(email); Trip trip = assignedTrip(driver, tripId);
        if ("COMPLETED".equals(trip.getStatus()) || "CANCELLED".equals(trip.getStatus())) throw new IllegalStateException("This trip cannot be started");
        trip.setStatus("IN_PROGRESS"); trip.setStartedAt(OffsetDateTime.now()); store.save(trip);
        store.save(new AuditLog(email, "TRIP_STARTED", "Trip", tripId.toString(), "Driver mobile workspace"));
        return assignmentView(driver, trip);
    }

    public Map<String, Object> end(String email, UUID tripId) {
        DriverProfile driver = driver(email); Trip trip = assignedTrip(driver, tripId);
        if (!"IN_PROGRESS".equals(trip.getStatus())) throw new IllegalStateException("Start the trip before ending it");
        trip.setStatus("COMPLETED"); trip.setEndedAt(OffsetDateTime.now()); store.save(trip);
        store.save(new AuditLog(email, "TRIP_COMPLETED", "Trip", tripId.toString(), "Driver mobile workspace"));
        return assignmentView(driver, trip);
    }

    public Map<String, Object> incident(String email, UUID tripId, String category, String severity, String message) {
        DriverProfile driver = driver(email); Trip trip = assignedTrip(driver, tripId);
        if (message == null || message.isBlank()) throw new IllegalArgumentException("Incident message is required");
        String details = "severity=" + normalizeSeverity(severity) + ", category=" + Optional.ofNullable(category).orElse("General") + ", message=" + message.trim();
        AuditLog audit = store.save(new AuditLog(email, "DRIVER_INCIDENT", "Trip", trip.getId().toString(), details));
        return Map.of("id", audit.getId(), "tripId", tripId, "status", "REPORTED", "severity", normalizeSeverity(severity));
    }

    private DriverProfile driver(String email) {
        UserAccount user = store.userByEmail(email).orElseThrow(() -> new SecurityException("Driver account not found"));
        return drivers.findByUserId(user.getId()).orElseThrow(() -> new SecurityException("Driver profile is not linked to this account"));
    }
    private Trip assignedTrip(DriverProfile driver, UUID tripId) {
        Trip trip = store.trip(tripId).orElseThrow(() -> new NoSuchElementException("Trip not found"));
        if (!Objects.equals(trip.getDriverId(), driver.getId())) throw new SecurityException("This trip is assigned to another driver");
        return trip;
    }
    private Map<String, Object> assignmentView(DriverProfile driver, Trip trip) {
        Bus bus = store.bus(trip.getBusId()).orElseThrow(); RoutePlan route = store.route(trip.getRouteId()).orElseThrow();
        List<Booking> bookings = store.bookingsForTrip(trip.getId());
        List<Map<String, Object>> manifest = new ArrayList<>();
        for (Booking booking : bookings) store.passengersForBooking(booking.getId()).forEach(passenger -> manifest.add(Map.of(
                "fullName", passenger.getFullName(), "seatNumber", passenger.getSeatNumber(), "passengerType", passenger.getPassengerType(),
                "gender", Optional.ofNullable(passenger.getGender()).orElse(""), "phone", Optional.ofNullable(passenger.getPhone()).orElse("")
        )));
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("tripId", trip.getId()); map.put("busId", trip.getBusId()); map.put("driverId", driver.getId()); map.put("status", trip.getStatus());
        map.put("origin", route.getOrigin()); map.put("destination", route.getDestination()); map.put("stops", csv(route.getStopsCsv()));
        map.put("departureTime", trip.getDepartureTime()); map.put("arrivalTime", trip.getArrivalTime());
        map.put("operator", operatorName(bus.getOperatorId())); map.put("bus", bus.getModel()); map.put("registrationNumber", bus.getRegistrationNumber()); map.put("coachType", bus.getCoachType());
        map.put("passengerCount", manifest.size()); map.put("bookedSeats", bookings.stream().mapToInt(b -> b.getSeatNumbers().split(",").length).sum()); map.put("manifest", manifest);
        map.put("latestLocation", store.latestLocation(bus.getId()).map(v -> tracking.current().stream().filter(l -> Objects.equals(l.get("busId"), bus.getId())).findFirst().orElse(null)).orElse(null));
        return map;
    }
    private String operatorName(UUID id) { return store.operators().stream().filter(o -> o.getId().equals(id)).map(TransportOperator::getName).findFirst().orElse("Unknown operator"); }
    private List<String> csv(String value) { return value == null || value.isBlank() ? List.of() : Arrays.stream(value.split(",")).map(String::trim).toList(); }
    private String normalizeSeverity(String severity) { return Set.of("LOW", "MEDIUM", "HIGH", "EMERGENCY").contains(String.valueOf(severity).toUpperCase()) ? severity.toUpperCase() : "MEDIUM"; }
}
