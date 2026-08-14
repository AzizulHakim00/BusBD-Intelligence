package com.busbd.intelligence.controller;

import com.busbd.intelligence.domain.*;
import com.busbd.intelligence.repository.PlatformStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/public")
public class PublicController {
    private final PlatformStore store;
    private final String databaseUrl;
    private final String redisUrl;
    public PublicController(PlatformStore store,
                            @Value("${spring.datasource.url:}") String databaseUrl,
                            @Value("${spring.data.redis.url:}") String redisUrl) {
        this.store = store;
        this.databaseUrl = databaseUrl;
        this.redisUrl = redisUrl;
    }

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        boolean persistent = databaseUrl.startsWith("jdbc:postgresql:");
        boolean redisBacked = redisUrl.startsWith("redis://") || redisUrl.startsWith("rediss://");
        return Map.of("districtsConnected", 62, "verifiedOperators", store.count(TransportOperator.class),
                "buses", store.count(Bus.class), "scheduledTrips", store.futureTrips().size(),
                "etaAccuracy", 91, "networkStatus", "HEALTHY",
                "storage", persistent ? "POSTGRES_PERSISTENT" : "DEMO_IN_MEMORY",
                "persistent", persistent,
                "seatLocking", redisBacked ? "REDIS_BACKED" : "IN_MEMORY");
    }
    @GetMapping("/operators") public List<TransportOperator> operators() { return store.operators(); }
    @GetMapping("/routes") public List<RoutePlan> routes() { return store.routes(); }
    @GetMapping("/trips")
    public List<Map<String, Object>> trips(@RequestParam(required = false) String origin,
                                           @RequestParam(required = false) String destination) {
        return store.futureTrips().stream().map(this::tripView)
                .filter(t -> origin == null || origin.isBlank() || String.valueOf(t.get("origin")).equalsIgnoreCase(origin))
                .filter(t -> destination == null || destination.isBlank() || String.valueOf(t.get("destination")).equalsIgnoreCase(destination)).toList();
    }

    private Map<String, Object> tripView(Trip trip) {
        Bus bus = store.bus(trip.getBusId()).orElseThrow();
        RoutePlan route = store.route(trip.getRouteId()).orElseThrow();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", trip.getId()); map.put("busId", bus.getId()); map.put("operatorId", bus.getOperatorId());
        map.put("operator", operatorName(bus.getOperatorId())); map.put("bus", bus.getModel());
        map.put("registrationNumber", bus.getRegistrationNumber()); map.put("coachType", bus.getCoachType());
        map.put("seatLayout", bus.getSeatLayout()); map.put("amenities", csv(bus.getAmenities()));
        map.put("origin", route.getOrigin()); map.put("destination", route.getDestination()); map.put("stops", csv(route.getStopsCsv()));
        map.put("boardingPoints", points(route.getBoardingPointsCsv(), trip.getBoardingPoint(), route.getOrigin()));
        map.put("droppingPoints", points(route.getDroppingPointsCsv(), trip.getDroppingPoint(), route.getDestination()));
        map.put("departureTime", trip.getDepartureTime()); map.put("arrivalTime", trip.getArrivalTime());
        map.put("fare", trip.getFare()); map.put("availableSeats", trip.getAvailableSeats());
        map.put("delayRisk", trip.getDelayRisk()); map.put("status", trip.getStatus());
        map.put("boardingPoint", trip.getBoardingPoint()); map.put("droppingPoint", trip.getDroppingPoint());
        return map;
    }
    private List<String> points(String csv, String tripDefault, String routeDefault) {
        LinkedHashSet<String> values = new LinkedHashSet<>(csv(csv));
        if (tripDefault != null && !tripDefault.isBlank()) values.add(tripDefault);
        if (values.isEmpty()) values.add(routeDefault);
        return new ArrayList<>(values);
    }
    private List<String> csv(String value) {
        if (value == null || value.isBlank()) return List.of();
        return Arrays.stream(value.split(",")).map(String::trim).filter(s -> !s.isBlank()).toList();
    }
    private String operatorName(UUID id) {
        return store.operators().stream().filter(o -> o.getId().equals(id)).map(TransportOperator::getName).findFirst().orElse("Unknown");
    }
}
