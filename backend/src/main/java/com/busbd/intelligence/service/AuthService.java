package com.busbd.intelligence.service;

import com.busbd.intelligence.domain.AuditLog;
import com.busbd.intelligence.domain.UserAccount;
import com.busbd.intelligence.repository.PlatformStore;
import com.busbd.intelligence.security.JwtService;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@Transactional
public class AuthService {
    public record RegisterCommand(String fullName, String email, String password, String phone, String preferredLanguage) { }
    public record ProfileCommand(String fullName, String phone, String emergencyContact, String preferredLanguage) { }
    private final PlatformStore store;
    private final PasswordEncoder encoder;
    private final JwtService jwtService;
    private final boolean demoMode;

    public AuthService(PlatformStore store, PasswordEncoder encoder, JwtService jwtService,
                       @Value("${busbd.demo-mode:true}") boolean demoMode) {
        this.store = store; this.encoder = encoder; this.jwtService = jwtService; this.demoMode = demoMode;
    }

    public Map<String, Object> register(RegisterCommand command) {
        if (store.userByEmail(command.email()).isPresent()) throw new IllegalArgumentException("An account already exists for this email");
        if (command.password() == null || command.password().length() < 8) throw new IllegalArgumentException("Password must contain at least 8 characters");
        UserAccount user = new UserAccount(command.fullName().trim(), command.email().trim(), encoder.encode(command.password()), "PASSENGER");
        user.setPhone(command.phone());
        user.setPreferredLanguage(normalizeLanguage(command.preferredLanguage()));
        user.setEmailVerified(demoMode);
        store.save(user);
        store.save(new AuditLog(user.getEmail(), "PASSENGER_REGISTERED", "UserAccount", user.getId().toString(), "emailVerified=" + user.isEmailVerified()));
        return authenticated(user, demoMode ? "Registration complete. Demo mode verified the email automatically." : "Registration complete. Email verification is required.");
    }

    public Map<String, Object> login(String email, String password) {
        UserAccount user = store.userByEmail(email).orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));
        if (!user.isActive() || !encoder.matches(password, user.getPasswordHash())) throw new IllegalArgumentException("Invalid email or password");
        return authenticated(user, "Login successful");
    }

    public Map<String, Object> profile(String email) { return userView(store.userByEmail(email).orElseThrow()); }

    public Map<String, Object> updateProfile(String email, ProfileCommand command) {
        UserAccount user = store.userByEmail(email).orElseThrow();
        if (command.fullName() != null && !command.fullName().isBlank()) user.setFullName(command.fullName().trim());
        user.setPhone(command.phone()); user.setEmergencyContact(command.emergencyContact());
        user.setPreferredLanguage(normalizeLanguage(command.preferredLanguage()));
        store.save(user);
        store.save(new AuditLog(email, "PROFILE_UPDATED", "UserAccount", user.getId().toString(), "Passenger profile updated"));
        return userView(user);
    }

    private Map<String, Object> authenticated(UserAccount user, String message) {
        return Map.of("token", jwtService.issue(user.getEmail(), user.getRole(), user.getFullName()), "user", userView(user), "message", message);
    }
    private Map<String, Object> userView(UserAccount user) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", user.getId()); view.put("name", user.getFullName()); view.put("email", user.getEmail());
        view.put("role", user.getRole()); view.put("phone", user.getPhone()); view.put("emergencyContact", user.getEmergencyContact());
        view.put("preferredLanguage", user.getPreferredLanguage()); view.put("emailVerified", user.isEmailVerified()); view.put("createdAt", user.getCreatedAt());
        return view;
    }
    private String normalizeLanguage(String value) { return "BN".equalsIgnoreCase(value) ? "BN" : "EN"; }
}
