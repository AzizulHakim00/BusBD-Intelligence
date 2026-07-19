package com.busbd.intelligence.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SeatLockService {
    public record SeatHold(String id, UUID tripId, Set<String> seats, String owner, Instant expiresAt) { }

    private final Map<String, SeatHold> localHolds = new ConcurrentHashMap<>();
    private final StringRedisTemplate redis;
    private final long lockMinutes;

    public SeatLockService(StringRedisTemplate redis,
                           @Value("${busbd.seat-lock-minutes:5}") long lockMinutes) {
        this.redis = redis;
        this.lockMinutes = lockMinutes;
    }

    public synchronized SeatHold create(UUID tripId, Collection<String> requestedSeats, String owner) {
        cleanup();
        Set<String> normalized = new TreeSet<>();
        requestedSeats.forEach(s -> normalized.add(s.trim().toUpperCase(Locale.ROOT)));
        if (normalized.isEmpty()) throw new IllegalArgumentException("Select at least one seat");
        Set<String> alreadyLocked = lockedSeats(tripId);
        normalized.stream().filter(alreadyLocked::contains).findFirst().ifPresent(s -> {
            throw new IllegalStateException("Seat " + s + " is temporarily locked");
        });
        String id = "HOLD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        SeatHold hold = new SeatHold(id, tripId, normalized, owner, Instant.now().plus(Duration.ofMinutes(lockMinutes)));
        localHolds.put(id, hold);
        try {
            redis.opsForValue().set("busbd:hold:" + id, tripId + "|" + String.join(",", normalized) + "|" + owner,
                    Duration.ofMinutes(lockMinutes));
        } catch (RuntimeException ignored) {
            // Demo/Render mode runs without Redis; local locking remains active.
        }
        return hold;
    }

    public Optional<SeatHold> get(String id) {
        cleanup();
        return Optional.ofNullable(localHolds.get(id));
    }

    public void consume(String id) {
        localHolds.remove(id);
        try { redis.delete("busbd:hold:" + id); } catch (RuntimeException ignored) { }
    }

    public Set<String> lockedSeats(UUID tripId) {
        cleanup();
        Set<String> result = new TreeSet<>();
        localHolds.values().stream().filter(h -> h.tripId().equals(tripId)).forEach(h -> result.addAll(h.seats()));
        return result;
    }

    private void cleanup() {
        Instant now = Instant.now();
        localHolds.entrySet().removeIf(e -> e.getValue().expiresAt().isBefore(now));
    }
}
