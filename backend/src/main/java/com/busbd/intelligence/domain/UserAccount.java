package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_users", indexes = @Index(name = "idx_user_email", columnList = "email", unique = true))
@Getter @Setter @NoArgsConstructor
public class UserAccount {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false, length = 120)
    private String fullName;
    @Column(nullable = false, unique = true, length = 160)
    private String email;
    @Column(nullable = false, length = 100)
    private String passwordHash;
    @Column(nullable = false, length = 40)
    private String role;
    @Column(nullable = false)
    private boolean active = true;
    @Column(nullable = false)
    private boolean emailVerified = false;
    private String phone;
    private String emergencyContact;
    @Column(nullable = false, length = 10)
    private String preferredLanguage = "EN";
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    public UserAccount(String fullName, String email, String passwordHash, String role) {
        this.fullName = fullName;
        this.email = email.toLowerCase();
        this.passwordHash = passwordHash;
        this.role = role;
    }

    @PreUpdate
    void touch() { updatedAt = Instant.now(); }
}
