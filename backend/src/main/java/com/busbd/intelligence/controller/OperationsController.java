package com.busbd.intelligence.controller;

import com.busbd.intelligence.domain.*;
import com.busbd.intelligence.repository.PlatformStore;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/operations")
@PreAuthorize("hasAnyRole('OPERATOR_STAFF','FLEET_MANAGER','SUPER_ADMIN','SUPPORT_AGENT')")
public class OperationsController {
    public record BusRequest(UUID operatorId, String registrationNumber, String model, String coachType, int seatCount) { }
    public record RouteRequest(String origin, String destination, double distanceKm, String stopsCsv) { }
    public record TripRequest(UUID busId, UUID routeId, UUID driverId, OffsetDateTime departureTime,
                              OffsetDateTime arrivalTime, BigDecimal fare) { }

    private final PlatformStore store;

    public OperationsController(PlatformStore store) { this.store = store; }

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        BigDecimal revenue = store.bookings().stream().filter(b -> "CONFIRMED".equals(b.getStatus()))
                .map(Booking::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return Map.of(
                "operators", store.count(TransportOperator.class), "buses", store.count(Bus.class),
                "drivers", store.count(DriverProfile.class), "routes", store.count(RoutePlan.class),
                "trips", store.count(Trip.class), "bookings", store.count(Booking.class),
                "openComplaints", store.complaints().stream().filter(c -> "OPEN".equals(c.getStatus())).count(),
                "revenue", revenue
        );
    }

    @GetMapping("/buses") public List<Bus> buses() { return store.buses(); }
    @GetMapping("/drivers") public List<DriverProfile> drivers() { return store.drivers(); }
    @GetMapping("/counters") public List<Counter> counters() { return store.counters(); }
    @GetMapping("/bookings") public List<Booking> bookings() { return store.bookings(); }
    @GetMapping("/complaints") public List<Complaint> complaints() { return store.complaints(); }

    @PostMapping("/buses")
    @PreAuthorize("hasAnyRole('OPERATOR_STAFF','FLEET_MANAGER','SUPER_ADMIN')")
    public Bus createBus(@Valid @RequestBody BusRequest r) {
        return store.save(new Bus(r.operatorId(), r.registrationNumber(), r.model(), r.coachType(), r.seatCount()));
    }

    @PostMapping("/routes")
    @PreAuthorize("hasAnyRole('OPERATOR_STAFF','SUPER_ADMIN')")
    public RoutePlan createRoute(@Valid @RequestBody RouteRequest r) {
        return store.save(new RoutePlan(r.origin(), r.destination(), r.distanceKm(), r.stopsCsv()));
    }

    @PostMapping("/trips")
    @PreAuthorize("hasAnyRole('OPERATOR_STAFF','FLEET_MANAGER','SUPER_ADMIN')")
    public Trip createTrip(@Valid @RequestBody TripRequest r) {
        Bus bus = store.bus(r.busId()).orElseThrow();
        return store.save(new Trip(r.busId(), r.routeId(), r.driverId(), r.departureTime(), r.arrivalTime(), r.fare(), bus.getSeatCount()));
    }

    @PostMapping("/audit")
    public AuditLog audit(@RequestBody Map<String, String> payload, Authentication auth) {
        return store.save(new AuditLog(auth.getName(), payload.getOrDefault("action", "MANUAL_NOTE"),
                payload.getOrDefault("resourceType", "System"), payload.getOrDefault("resourceId", "-"),
                payload.getOrDefault("details", "")));
    }
}
