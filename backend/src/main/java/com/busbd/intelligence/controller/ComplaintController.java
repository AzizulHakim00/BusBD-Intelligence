package com.busbd.intelligence.controller;

import com.busbd.intelligence.domain.Complaint;
import com.busbd.intelligence.repository.PlatformStore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/complaints")
public class ComplaintController {
    public record ComplaintRequest(@Email String email, @NotBlank String category, @NotBlank String message) { }
    private final PlatformStore store;

    public ComplaintController(PlatformStore store) { this.store = store; }

    @PostMapping
    public Complaint create(@Valid @RequestBody ComplaintRequest request) {
        Complaint complaint = new Complaint(request.email(), request.category(), request.message());
        String lower = request.message().toLowerCase();
        complaint.setAiClassification(lower.contains("refund") ? "REFUND" : lower.contains("lost") ? "LOST_AND_FOUND" : "GENERAL_SUPPORT");
        return store.save(complaint);
    }
}
