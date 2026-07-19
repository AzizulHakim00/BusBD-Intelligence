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

    public SeatLockService(StringRedisTemplate redis, @Value("${busbd.seat-lock-minutes:5}") long lockMinutes) {
        this.redis = redis; this.lockMinutes = lockMinutes;
    }

    public synchronized SeatHold create(UUID tripId, Collection<String> requestedSeats, String owner) {
        cleanup();
        Set<String> normalized = normalize(requestedSeats);
        if (normalized.isEmpty()) throw new IllegalArgumentException("Select at least one seat");
        String id = "HOLD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(lockMinutes));
        SeatHold hold = new SeatHold(id, tripId, normalized, owner == null ? "guest" : owner.toLowerCase(Locale.ROOT), expiresAt);
        List<String> acquiredKeys = new ArrayList<>();
        try {
            for (String seat : normalized) {
                String key = seatKey(tripId, seat);
                Boolean acquired = redis.opsForValue().setIfAbsent(key, id, Duration.ofMinutes(lockMinutes));
                if (!Boolean.TRUE.equals(acquired)) {
                    acquiredKeys.forEach(redis::delete);
                    throw new IllegalStateException("Seat " + seat + " is temporarily locked");
                }
                acquiredKeys.add(key);
            }
            redis.opsForValue().set(holdKey(id), encode(hold), Duration.ofMinutes(lockMinutes));
        } catch (IllegalStateException e) { throw e; }
        catch (RuntimeException redisUnavailable) {
            Set<String> locked = localLockedSeats(tripId);
            normalized.stream().filter(locked::contains).findFirst().ifPresent(s -> { throw new IllegalStateException("Seat " + s + " is temporarily locked"); });
        }
        localHolds.put(id, hold);
        return hold;
    }

    public Optional<SeatHold> get(String id) {
        cleanup();
        SeatHold local = localHolds.get(id);
        if (local != null) return Optional.of(local);
        try {
            String encoded = redis.opsForValue().get(holdKey(id));
            if (encoded != null) {
                SeatHold hold = decode(id, encoded); localHolds.put(id, hold); return Optional.of(hold);
            }
        } catch (RuntimeException ignored) { }
        return Optional.empty();
    }

    public void consume(String id) {
        get(id).ifPresent(hold -> hold.seats().forEach(seat -> { try { redis.delete(seatKey(hold.tripId(), seat)); } catch (RuntimeException ignored) { } }));
        localHolds.remove(id);
        try { redis.delete(holdKey(id)); } catch (RuntimeException ignored) { }
    }

    public Set<String> lockedSeats(UUID tripId) {
        cleanup();
        Set<String> result = localLockedSeats(tripId);
        try {
            Set<String> keys = redis.keys("busbd:seat:" + tripId + ":*");
            if (keys != null) keys.forEach(key -> result.add(key.substring(key.lastIndexOf(':') + 1)));
        } catch (RuntimeException ignored) { }
        return result;
    }

    private Set<String> localLockedSeats(UUID tripId) {
        Set<String> result = new TreeSet<>();
        localHolds.values().stream().filter(h -> h.tripId().equals(tripId)).forEach(h -> result.addAll(h.seats()));
        return result;
    }
    private Set<String> normalize(Collection<String> requestedSeats) {
        Set<String> normalized = new TreeSet<>();
        if (requestedSeats != null) requestedSeats.forEach(s -> { if (s != null && !s.isBlank()) normalized.add(s.trim().toUpperCase(Locale.ROOT)); });
        return normalized;
    }
    private String encode(SeatHold h) { return h.tripId() + ";" + h.expiresAt().toEpochMilli() + ";" + h.owner().replace(";", "") + ";" + String.join(",", h.seats()); }
    private SeatHold decode(String id, String value) {
        String[] parts = value.split(";", 4);
        return new SeatHold(id, UUID.fromString(parts[0]), new TreeSet<>(Arrays.asList(parts[3].split(","))), parts[2], Instant.ofEpochMilli(Long.parseLong(parts[1])));
    }
    private String seatKey(UUID tripId, String seat) { return "busbd:seat:" + tripId + ":" + seat; }
    private String holdKey(String id) { return "busbd:hold:" + id; }
    private void cleanup() { Instant now = Instant.now(); localHolds.entrySet().removeIf(e -> e.getValue().expiresAt().isBefore(now)); }
}
