package com.busbd.intelligence.controller;

import com.busbd.intelligence.service.AuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    public record LoginRequest(@Email String email, @NotBlank String password) { }
    public record RegisterRequest(@NotBlank String fullName, @Email String email, @Size(min = 8) String password,
                                  String phone, String preferredLanguage) { }
    public record ProfileRequest(String fullName, String phone, String emergencyContact, String preferredLanguage) { }
    private final AuthService authService;
    public AuthController(AuthService authService) { this.authService = authService; }

    @PostMapping("/register")
    public Map<String, Object> register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(new AuthService.RegisterCommand(request.fullName(), request.email(), request.password(), request.phone(), request.preferredLanguage()));
    }
    @PostMapping("/login") public Map<String, Object> login(@Valid @RequestBody LoginRequest request) { return authService.login(request.email(), request.password()); }
    @GetMapping("/me") public Map<String, Object> me(Authentication authentication) { return authService.profile(authentication.getName()); }
    @PutMapping("/me")
    public Map<String, Object> update(@RequestBody ProfileRequest request, Authentication authentication) {
        return authService.updateProfile(authentication.getName(), new AuthService.ProfileCommand(request.fullName(), request.phone(), request.emergencyContact(), request.preferredLanguage()));
    }
}
