package com.busbd.intelligence.controller;

import com.busbd.intelligence.service.DriverService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/driver")
@PreAuthorize("hasRole('DRIVER')")
public class DriverController {
    public record IncidentRequest(UUID tripId, String category, String severity, @NotBlank String message) { }
    private final DriverService drivers;
    public DriverController(DriverService drivers) { this.drivers = drivers; }

    @GetMapping("/assignments") public List<Map<String, Object>> assignments(Authentication authentication) { return drivers.assignments(authentication.getName()); }
    @PostMapping("/trips/{tripId}/start") public Map<String, Object> start(@PathVariable UUID tripId, Authentication authentication) { return drivers.start(authentication.getName(), tripId); }
    @PostMapping("/trips/{tripId}/end") public Map<String, Object> end(@PathVariable UUID tripId, Authentication authentication) { return drivers.end(authentication.getName(), tripId); }
    @PostMapping("/incidents") public Map<String, Object> incident(@Valid @RequestBody IncidentRequest request, Authentication authentication) {
        return drivers.incident(authentication.getName(), request.tripId(), request.category(), request.severity(), request.message());
    }
}
