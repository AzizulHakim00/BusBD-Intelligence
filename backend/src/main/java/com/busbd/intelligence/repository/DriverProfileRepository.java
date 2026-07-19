package com.busbd.intelligence.repository;

import com.busbd.intelligence.domain.DriverProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface DriverProfileRepository extends JpaRepository<DriverProfile, UUID> {
    Optional<DriverProfile> findByUserId(UUID userId);
}
