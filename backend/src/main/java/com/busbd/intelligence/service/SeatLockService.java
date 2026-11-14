package com.busbd.intelligence.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class SeatLockService {
    public record SeatHold(String id, UUID tripId, Set<String> seats, String owner, Instant expiresAt) { }

    private static final DefaultRedisScript<Long> RELEASE_IF_OWNER = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            Long.class);

    private final StringRedisTemplate redis;
    private final long lockMinutes;

    public SeatLockService(StringRedisTemplate redis, @Value("${busbd.seat-lock-minutes:5}") long lockMinutes) {
        this.redis = redis;
        this.lockMinutes = lockMinutes;
    }

    public synchronized SeatHold create(UUID tripId, Collection<String> requestedSeats, String owner) {
        Set<String> normalized = normalize(requestedSeats);
        if (normalized.isEmpty()) throw new IllegalArgumentException("Select at least one seat");
        if (owner == null || owner.isBlank()) throw new IllegalArgumentException("A passenger email is required to hold seats");

        String id = "HOLD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        Duration ttl = Duration.ofMinutes(lockMinutes);
        SeatHold hold = new SeatHold(id, tripId, normalized, owner.trim().toLowerCase(Locale.ROOT), Instant.now().plus(ttl));
        List<String> acquiredKeys = new ArrayList<>();
        try {
            for (String seat : normalized) {
                String key = seatKey(tripId, seat);
                Boolean acquired = redis.opsForValue().setIfAbsent(key, id, ttl);
                if (!Boolean.TRUE.equals(acquired)) {
                    releaseAcquired(acquiredKeys, id);
                    throw new IllegalStateException("Seat " + seat + " is temporarily locked");
                }
                acquiredKeys.add(key);
            }
            redis.opsForValue().set(holdKey(id), encode(hold), ttl);
            return hold;
        } catch (IllegalStateException conflict) {
            throw conflict;
        } catch (RuntimeException unavailable) {
            releaseAcquired(acquiredKeys, id);
            throw new IllegalStateException("Seat reservation is temporarily unavailable. Please try again.", unavailable);
        }
    }

    public Optional<SeatHold> get(String id) {
        try {
            String encoded = redis.opsForValue().get(holdKey(id));
            if (encoded == null) return Optional.empty();
            SeatHold hold = decode(id, encoded);
            if (hold.expiresAt().isBefore(Instant.now())) return Optional.empty();
            return Optional.of(hold);
        } catch (RuntimeException unavailable) {
            throw new IllegalStateException("Seat reservation service is temporarily unavailable. Please try again.", unavailable);
        }
    }

    public void consume(String id) {
        Optional<SeatHold> optional = get(id);
        if (optional.isEmpty()) return;
        SeatHold hold = optional.get();
        try {
            for (String seat : hold.seats()) {
                redis.execute(RELEASE_IF_OWNER, List.of(seatKey(hold.tripId(), seat)), id);
            }
            redis.delete(holdKey(id));
        } catch (RuntimeException unavailable) {
            throw new IllegalStateException("Could not safely finalize the seat reservation. Please retry.", unavailable);
        }
    }

    public Set<String> lockedSeats(UUID tripId) {
        try {
            Set<String> keys = redis.keys("busbd:seat:" + tripId + ":*");
            Set<String> result = new TreeSet<>();
            if (keys != null) keys.forEach(key -> result.add(key.substring(key.lastIndexOf(':') + 1)));
            return result;
        } catch (RuntimeException unavailable) {
            throw new IllegalStateException("Seat availability is temporarily unavailable. Please try again.", unavailable);
        }
    }

    private void releaseAcquired(List<String> keys, String id) {
        for (String key : keys) {
            try {
                redis.execute(RELEASE_IF_OWNER, List.of(key), id);
            } catch (RuntimeException ignored) {
                // Redis TTL is the final cleanup if the service is recovering.
            }
        }
    }

    private Set<String> normalize(Collection<String> requestedSeats) {
        Set<String> normalized = new TreeSet<>();
        if (requestedSeats != null) requestedSeats.forEach(s -> {
            if (s != null && !s.isBlank()) normalized.add(s.trim().toUpperCase(Locale.ROOT));
        });
        return normalized;
    }

    private String encode(SeatHold hold) {
        return hold.tripId() + ";" + hold.expiresAt().toEpochMilli() + ";" + hold.owner().replace(";", "") + ";" + String.join(",", hold.seats());
    }

    private SeatHold decode(String id, String value) {
        String[] parts = value.split(";", 4);
        if (parts.length != 4) throw new IllegalStateException("Invalid seat hold record");
        return new SeatHold(id, UUID.fromString(parts[0]),
                new TreeSet<>(Arrays.asList(parts[3].split(","))), parts[2],
                Instant.ofEpochMilli(Long.parseLong(parts[1])));
    }

    private String seatKey(UUID tripId, String seat) { return "busbd:seat:" + tripId + ":" + seat; }
    private String holdKey(String id) { return "busbd:hold:" + id; }
}
