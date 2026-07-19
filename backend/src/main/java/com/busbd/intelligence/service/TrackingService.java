package com.busbd.intelligence.service;

import com.busbd.intelligence.domain.*;
import com.busbd.intelligence.repository.DriverProfileRepository;
import com.busbd.intelligence.repository.PlatformStore;
import jakarta.transaction.Transactional;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Transactional
public class TrackingService {
    private final PlatformStore store;
    private final DriverProfileRepository drivers;
    private final SimpMessagingTemplate messaging;
    private final Map<UUID, Integer> simulationSteps = new ConcurrentHashMap<>();
    private final Map<String, double[]> cityCoordinates = Map.ofEntries(
            Map.entry("Dhaka", new double[]{23.8103, 90.4125}),
            Map.entry("Cumilla", new double[]{23.4607, 91.1809}),
            Map.entry("Feni", new double[]{22.9409, 91.4034}),
            Map.entry("Chattogram", new double[]{22.3569, 91.7832}),
            Map.entry("Cox's Bazar", new double[]{21.4272, 92.0058}),
            Map.entry("Bhairab", new double[]{24.0524, 90.9764}),
            Map.entry("Sreemangal", new double[]{24.3065, 91.7296}),
            Map.entry("Sylhet", new double[]{24.8949, 91.8687})
    );

    public TrackingService(PlatformStore store, DriverProfileRepository drivers, SimpMessagingTemplate messaging) {
        this.store = store; this.drivers = drivers; this.messaging = messaging;
    }

    public Map<String, Object> updateAuthorized(Authentication authentication, UUID busId, UUID tripId,
                                                 double lat, double lng, double speed, double heading) {
        if (authentication == null || !authentication.isAuthenticated()) throw new SecurityException("Driver authentication is required");
        Trip trip = store.trip(tripId).orElseThrow(() -> new NoSuchElementException("Trip not found"));
        if (!trip.getBusId().equals(busId)) throw new IllegalArgumentException("This bus is not assigned to the selected trip");
        boolean privileged = authentication.getAuthorities().stream().anyMatch(a -> Set.of("ROLE_SUPER_ADMIN", "ROLE_FLEET_MANAGER").contains(a.getAuthority()));
        if (!privileged) {
            UserAccount user = store.userByEmail(authentication.getName()).orElseThrow(() -> new SecurityException("Driver account not found"));
            DriverProfile driver = drivers.findByUserId(user.getId()).orElseThrow(() -> new SecurityException("Driver profile is not linked to this account"));
            if (!Objects.equals(trip.getDriverId(), driver.getId())) throw new SecurityException("This trip is assigned to another driver");
        }
        validateCoordinates(lat, lng, speed, heading);
        return persist(busId, tripId, lat, lng, speed, heading);
    }

    public List<Map<String, Object>> current() { return store.latestLocations().stream().map(this::view).toList(); }

    public Map<String, Object> trip(UUID tripId) {
        Trip trip = store.trip(tripId).orElseThrow(() -> new NoSuchElementException("Trip not found"));
        Bus bus = store.bus(trip.getBusId()).orElseThrow();
        RoutePlan route = store.route(trip.getRouteId()).orElseThrow();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("tripId", trip.getId()); map.put("busId", bus.getId()); map.put("status", trip.getStatus());
        map.put("origin", route.getOrigin()); map.put("destination", route.getDestination()); map.put("stops", csv(route.getStopsCsv()));
        map.put("registrationNumber", bus.getRegistrationNumber()); map.put("bus", bus.getModel());
        map.put("latestLocation", store.latestLocation(bus.getId()).map(this::view).orElse(null));
        return map;
    }

    @Scheduled(fixedDelay = 8000, initialDelay = 5000)
    public void simulate() {
        List<Trip> candidates = store.futureTrips().stream().filter(t -> "SCHEDULED".equals(t.getStatus())).toList();
        if (candidates.isEmpty()) return;
        Trip trip = candidates.getFirst();
        RoutePlan route = store.route(trip.getRouteId()).orElse(null);
        if (route == null) return;
        List<double[]> points = routePoints(route);
        if (points.isEmpty()) return;
        int step = simulationSteps.compute(trip.getBusId(), (id, current) -> current == null ? 0 : (current + 1) % points.size());
        double[] point = points.get(step);
        persist(trip.getBusId(), trip.getId(), point[0], point[1], 52 + step * 4, 135);
    }

    private Map<String, Object> persist(UUID busId, UUID tripId, double lat, double lng, double speed, double heading) {
        VehicleLocation previous = store.latestLocation(busId).orElse(null);
        VehicleLocation location = new VehicleLocation(busId, tripId, lat, lng, speed, heading);
        double anomaly = speed > 110 ? .95 : speed < 1 ? .28 : .05;
        if (previous != null) {
            long seconds = Math.max(1, Duration.between(previous.getRecordedAt(), Instant.now()).toSeconds());
            double jumpKph = distanceKm(previous.getLatitude(), previous.getLongitude(), lat, lng) / (seconds / 3600d);
            if (jumpKph > 160) anomaly = Math.max(anomaly, .92);
        }
        location.setAnomalyScore(anomaly); store.save(location);
        Map<String, Object> event = view(location); messaging.convertAndSend("/topic/locations", event); return event;
    }

    private Map<String, Object> view(VehicleLocation location) {
        Trip trip = store.trip(location.getTripId()).orElse(null);
        Bus bus = trip == null ? null : store.bus(trip.getBusId()).orElse(null);
        RoutePlan route = trip == null ? null : store.route(trip.getRouteId()).orElse(null);
        Instant recorded = Optional.ofNullable(location.getRecordedAt()).orElse(Instant.now());
        long staleSeconds = Math.max(0, Duration.between(recorded, Instant.now()).toSeconds());
        RouteMetrics metrics = route == null ? new RouteMetrics(0, "Unknown", false) : metrics(route, location.getLatitude(), location.getLongitude());
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("busId", location.getBusId()); map.put("tripId", location.getTripId());
        map.put("latitude", location.getLatitude()); map.put("longitude", location.getLongitude());
        map.put("speedKph", location.getSpeedKph()); map.put("heading", location.getHeading());
        map.put("anomalyScore", location.getAnomalyScore()); map.put("recordedAt", recorded);
        map.put("staleSeconds", staleSeconds); map.put("stale", staleSeconds > 30);
        map.put("routeProgress", metrics.progress()); map.put("nextStop", metrics.nextStop()); map.put("routeDeviation", metrics.deviation());
        if (route != null) { map.put("origin", route.getOrigin()); map.put("destination", route.getDestination()); }
        if (bus != null) { map.put("bus", bus.getModel()); map.put("registrationNumber", bus.getRegistrationNumber()); }
        return map;
    }

    private RouteMetrics metrics(RoutePlan route, double lat, double lng) {
        List<String> stops = csv(route.getStopsCsv());
        List<double[]> points = routePoints(route);
        if (points.isEmpty()) return new RouteMetrics(0, route.getDestination(), false);
        int nearest = 0; double nearestDistance = Double.MAX_VALUE;
        for (int i = 0; i < points.size(); i++) {
            double distance = distanceKm(lat, lng, points.get(i)[0], points.get(i)[1]);
            if (distance < nearestDistance) { nearestDistance = distance; nearest = i; }
        }
        double progress = points.size() == 1 ? 1 : Math.min(1, nearest / (double) (points.size() - 1));
        String nextStop = stops.get(Math.min(stops.size() - 1, nearest + 1));
        return new RouteMetrics(progress, nextStop, nearestDistance > 55);
    }

    private List<double[]> routePoints(RoutePlan route) {
        List<double[]> points = new ArrayList<>();
        for (String stop : csv(route.getStopsCsv())) {
            double[] coordinate = cityCoordinates.get(stop);
            if (coordinate != null) points.add(coordinate);
        }
        return points;
    }
    private List<String> csv(String value) {
        if (value == null || value.isBlank()) return List.of();
        return Arrays.stream(value.split(",")).map(String::trim).filter(s -> !s.isBlank()).toList();
    }
    private void validateCoordinates(double lat, double lng, double speed, double heading) {
        if (lat < 20 || lat > 27 || lng < 88 || lng > 93) throw new IllegalArgumentException("GPS coordinate is outside the supported Bangladesh service area");
        if (speed < 0 || speed > 150) throw new IllegalArgumentException("Speed must be between 0 and 150 km/h");
        if (heading < 0 || heading >= 360) throw new IllegalArgumentException("Heading must be between 0 and 359 degrees");
    }
    private double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double earth = 6371; double dLat = Math.toRadians(lat2 - lat1); double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    private record RouteMetrics(double progress, String nextStop, boolean deviation) { }
}
