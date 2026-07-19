package com.busbd.intelligence.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Service
public class JwtService {
    private final ObjectMapper mapper;
    private final byte[] secret;
    private final long expirationMinutes;

    public JwtService(ObjectMapper mapper,
                      @Value("${busbd.jwt.secret}") String secret,
                      @Value("${busbd.jwt.expiration-minutes:480}") long expirationMinutes) {
        this.mapper = mapper;
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.expirationMinutes = expirationMinutes;
    }

    public String issue(String subject, String role, String name) {
        try {
            var header = Map.of("alg", "HS256", "typ", "JWT");
            var now = Instant.now();
            var payload = new LinkedHashMap<String, Object>();
            payload.put("sub", subject);
            payload.put("role", role);
            payload.put("name", name);
            payload.put("iat", now.getEpochSecond());
            payload.put("exp", now.plusSeconds(expirationMinutes * 60).getEpochSecond());
            String unsigned = encode(mapper.writeValueAsBytes(header)) + "." + encode(mapper.writeValueAsBytes(payload));
            return unsigned + "." + encode(sign(unsigned));
        } catch (Exception e) {
            throw new IllegalStateException("Unable to issue access token", e);
        }
    }

    public Optional<Map<String, Object>> verify(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) return Optional.empty();
            String unsigned = parts[0] + "." + parts[1];
            if (!java.security.MessageDigest.isEqual(sign(unsigned), Base64.getUrlDecoder().decode(parts[2]))) return Optional.empty();
            Map<String, Object> claims = mapper.readValue(Base64.getUrlDecoder().decode(parts[1]), new TypeReference<>() {});
            Number exp = (Number) claims.get("exp");
            if (exp == null || Instant.now().getEpochSecond() >= exp.longValue()) return Optional.empty();
            return Optional.of(claims);
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private byte[] sign(String value) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret, "HmacSHA256"));
        return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
    }

    private String encode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
