package com.busbd.intelligence.controller;

import com.busbd.intelligence.repository.PlatformStore;
import com.busbd.intelligence.service.AuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    public record LoginRequest(@Email String email, @NotBlank String password) { }

    private final AuthService authService;
    private final PlatformStore store;

    public AuthController(AuthService authService, PlatformStore store) {
        this.authService = authService; this.store = store;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request.email(), request.password());
    }

    @GetMapping("/me")
    public Map<String, Object> me(Authentication authentication) {
        var user = store.userByEmail(authentication.getName()).orElseThrow();
        return Map.of("id", user.getId(), "name", user.getFullName(), "email", user.getEmail(), "role", user.getRole());
    }
}
