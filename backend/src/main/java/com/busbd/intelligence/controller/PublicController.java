package com.busbd.intelligence.controller;

import com.busbd.intelligence.domain.*;
import com.busbd.intelligence.repository.PlatformStore;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/public")
public class PublicController {
    private final PlatformStore store;

    public PublicController(PlatformStore store) { this.store = store; }

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        return Map.of(
                "districtsConnected", 62,
                "verifiedOperators", store.count(TransportOperator.class),
                "buses", store.count(Bus.class),
                "scheduledTrips", store.futureTrips().size(),
                "etaAccuracy", 91,
                "networkStatus", "HEALTHY"
        );
    }

    @GetMapping("/operators")
    public List<TransportOperator> operators() { return store.operators(); }

    @GetMapping("/routes")
    public List<RoutePlan> routes() { return store.routes(); }

    @GetMapping("/trips")
    public List<Map<String, Object>> trips(@RequestParam(required = false) String origin,
                                           @RequestParam(required = false) String destination) {
        return store.futureTrips().stream().map(this::tripView)
                .filter(t -> origin == null || String.valueOf(t.get("origin")).equalsIgnoreCase(origin))
                .filter(t -> destination == null || String.valueOf(t.get("destination")).equalsIgnoreCase(destination))
                .toList();
    }

    private Map<String, Object> tripView(Trip trip) {
        Bus bus = store.bus(trip.getBusId()).orElseThrow();
        RoutePlan route = store.route(trip.getRouteId()).orElseThrow();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", trip.getId()); map.put("busId", bus.getId());
        map.put("operatorId", bus.getOperatorId()); map.put("operator", operatorName(bus.getOperatorId()));
        map.put("bus", bus.getModel()); map.put("coachType", bus.getCoachType());
        map.put("origin", route.getOrigin()); map.put("destination", route.getDestination());
        map.put("stops", Arrays.asList(route.getStopsCsv().split(",")));
        map.put("departureTime", trip.getDepartureTime()); map.put("arrivalTime", trip.getArrivalTime());
        map.put("fare", trip.getFare()); map.put("availableSeats", trip.getAvailableSeats());
        map.put("delayRisk", trip.getDelayRisk()); map.put("status", trip.getStatus());
        map.put("boardingPoint", trip.getBoardingPoint()); map.put("droppingPoint", trip.getDroppingPoint());
        return map;
    }

    private String operatorName(UUID id) {
        return store.operators().stream().filter(o -> o.getId().equals(id)).map(TransportOperator::getName).findFirst().orElse("Unknown");
    }
}
