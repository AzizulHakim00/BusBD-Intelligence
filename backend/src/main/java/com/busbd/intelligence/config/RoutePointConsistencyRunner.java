package com.busbd.intelligence.config;

import com.busbd.intelligence.domain.RoutePlan;
import com.busbd.intelligence.domain.Trip;
import com.busbd.intelligence.repository.PlatformStore;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Keeps route-level allowed points consistent with trip-level defaults.
 *
 * Older demonstration data contains valid trip defaults such as Arambagh and
 * Dampara that were not copied into the route CSV columns. Search correctly
 * exposed those defaults, but booking rejected them during validation. This
 * runner repairs both H2 demo data and existing PostgreSQL data safely and
 * idempotently after all seed runners have completed.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class RoutePointConsistencyRunner implements ApplicationRunner {
    private final PlatformStore store;

    public RoutePointConsistencyRunner(PlatformStore store) {
        this.store = store;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (Trip trip : store.trips()) {
            RoutePlan route = store.route(trip.getRouteId()).orElse(null);
            if (route == null) continue;

            String boarding = appendPoint(route.getBoardingPointsCsv(), route.getOrigin(), trip.getBoardingPoint());
            String dropping = appendPoint(route.getDroppingPointsCsv(), route.getDestination(), trip.getDroppingPoint());

            boolean changed = !same(route.getBoardingPointsCsv(), boarding) || !same(route.getDroppingPointsCsv(), dropping);
            if (changed) {
                route.setBoardingPointsCsv(boarding);
                route.setDroppingPointsCsv(dropping);
                store.save(route);
            }
        }
        store.flush();
    }

    private String appendPoint(String existing, String routeDefault, String tripDefault) {
        Set<String> points = new LinkedHashSet<>();
        addCsv(points, existing);
        add(points, routeDefault);
        add(points, tripDefault);
        return String.join(",", points);
    }

    private void addCsv(Set<String> points, String value) {
        if (value == null || value.isBlank()) return;
        for (String item : value.split(",")) add(points, item);
    }

    private void add(Set<String> points, String value) {
        if (value == null) return;
        String clean = value.trim();
        if (clean.isBlank()) return;
        boolean exists = points.stream().anyMatch(item -> item.equalsIgnoreCase(clean));
        if (!exists) points.add(clean);
    }

    private boolean same(String first, String second) {
        return normalize(first).equals(normalize(second));
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
