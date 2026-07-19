package com.busbd.intelligence.controller;

import com.busbd.intelligence.service.TrackingService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/tracking")
public class TrackingController {
    public record LocationUpdate(UUID busId, UUID tripId, double latitude, double longitude, double speedKph, double heading) { }
    private final TrackingService tracking;
    public TrackingController(TrackingService tracking) { this.tracking = tracking; }

    @GetMapping("/locations") public List<Map<String, Object>> current() { return tracking.current(); }
    @GetMapping("/trips/{tripId}") public Map<String, Object> trip(@PathVariable UUID tripId) { return tracking.trip(tripId); }

    @PostMapping("/locations")
    @PreAuthorize("hasAnyRole('DRIVER','FLEET_MANAGER','SUPER_ADMIN')")
    public Map<String, Object> update(@Valid @RequestBody LocationUpdate request, Authentication authentication) {
        return tracking.updateAuthorized(authentication, request.busId(), request.tripId(), request.latitude(), request.longitude(), request.speedKph(), request.heading());
    }
}
