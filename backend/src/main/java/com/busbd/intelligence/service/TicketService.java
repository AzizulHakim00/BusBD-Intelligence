package com.busbd.intelligence.service;

import com.busbd.intelligence.domain.Booking;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;

@Service
public class TicketService {
    private final byte[] secret;
    public TicketService(@Value("${busbd.ticket.secret}") String secret) { this.secret = secret.getBytes(StandardCharsets.UTF_8); }

    public String issue(Booking booking) {
        String payload = booking.getReference() + "|" + booking.getTripId() + "|" + booking.getSeatNumbers();
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return "BBDT." + encoded + "." + sign(encoded);
    }

    public Map<String, Object> verify(String token) {
        if (token == null || !token.startsWith("BBDT.")) return Map.of("valid", false, "reason", "Invalid ticket format");
        String[] parts = token.split("\\.");
        if (parts.length != 3 || !MessageDigest.isEqual(sign(parts[1]).getBytes(StandardCharsets.UTF_8), parts[2].getBytes(StandardCharsets.UTF_8))) {
            return Map.of("valid", false, "reason", "Ticket signature is invalid");
        }
        String[] values = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8).split("\\|", 3);
        if (values.length != 3) return Map.of("valid", false, "reason", "Ticket payload is invalid");
        return Map.of("valid", true, "reference", values[0], "tripId", values[1], "seats", values[2]);
    }

    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new IllegalStateException("Unable to sign ticket", e); }
    }
}
