package com.busbd.intelligence.service;

import com.busbd.intelligence.domain.Trip;
import com.busbd.intelligence.domain.VehicleLocation;
import com.busbd.intelligence.repository.PlatformStore;
import jakarta.transaction.Transactional;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Transactional
public class TrackingService {
    private final PlatformStore store;
    private final SimpMessagingTemplate messaging;
    private final Map<UUID, Integer> simulationSteps = new ConcurrentHashMap<>();
    private final List<double[]> dhakaChattogram = List.of(
            new double[]{23.8103, 90.4125}, new double[]{23.6297, 90.4976},
            new double[]{23.4607, 91.1809}, new double[]{23.2513, 91.1780},
            new double[]{22.9409, 91.4034}, new double[]{22.3569, 91.7832}
    );

    public TrackingService(PlatformStore store, SimpMessagingTemplate messaging) {
        this.store = store; this.messaging = messaging;
    }

    public Map<String, Object> update(UUID busId, UUID tripId, double lat, double lng, double speed, double heading) {
        VehicleLocation location = new VehicleLocation(busId, tripId, lat, lng, speed, heading);
        location.setAnomalyScore(speed > 110 ? 0.92 : speed < 5 ? 0.35 : 0.08);
        store.save(location);
        Map<String, Object> event = view(location);
        messaging.convertAndSend("/topic/locations", event);
        return event;
    }

    public List<Map<String, Object>> current() {
        return store.latestLocations().stream().map(this::view).toList();
    }

    @Scheduled(fixedDelay = 8000, initialDelay = 5000)
    public void simulate() {
        List<Trip> trips = store.futureTrips();
        if (trips.isEmpty()) return;
        Trip trip = trips.getFirst();
        int step = simulationSteps.compute(trip.getBusId(), (id, current) -> current == null ? 0 : (current + 1) % dhakaChattogram.size());
        double[] point = dhakaChattogram.get(step);
        update(trip.getBusId(), trip.getId(), point[0], point[1], 58 + step * 3, 135);
    }

    private Map<String, Object> view(VehicleLocation v) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("busId", v.getBusId()); map.put("tripId", v.getTripId());
        map.put("latitude", v.getLatitude()); map.put("longitude", v.getLongitude());
        map.put("speedKph", v.getSpeedKph()); map.put("heading", v.getHeading());
        map.put("anomalyScore", v.getAnomalyScore()); map.put("recordedAt", Optional.ofNullable(v.getRecordedAt()).orElse(Instant.now()));
        return map;
    }
}
