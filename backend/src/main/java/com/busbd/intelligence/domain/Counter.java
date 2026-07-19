package com.busbd.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "counters")
@Getter @Setter @NoArgsConstructor
public class Counter {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false)
    private UUID operatorId;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private String district;
    private String address;
    private String phone;
    private boolean active = true;

    public Counter(UUID operatorId, String name, String district, String address, String phone) {
        this.operatorId = operatorId; this.name = name; this.district = district;
        this.address = address; this.phone = phone;
    }
}
