package com.busbd.intelligence.service;

import com.busbd.intelligence.domain.UserAccount;
import com.busbd.intelligence.repository.PlatformStore;
import com.busbd.intelligence.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class AuthService {
    private final PlatformStore store;
    private final PasswordEncoder encoder;
    private final JwtService jwtService;

    public AuthService(PlatformStore store, PasswordEncoder encoder, JwtService jwtService) {
        this.store = store; this.encoder = encoder; this.jwtService = jwtService;
    }

    public Map<String, Object> login(String email, String password) {
        UserAccount user = store.userByEmail(email).orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));
        if (!user.isActive() || !encoder.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }
        return Map.of(
                "token", jwtService.issue(user.getEmail(), user.getRole(), user.getFullName()),
                "user", Map.of("id", user.getId(), "name", user.getFullName(), "email", user.getEmail(), "role", user.getRole())
        );
    }
}
