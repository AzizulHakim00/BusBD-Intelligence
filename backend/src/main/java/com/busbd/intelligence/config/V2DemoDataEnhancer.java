package com.busbd.intelligence.config;

import com.busbd.intelligence.repository.PlatformStore;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class V2DemoDataEnhancer {
    private final PlatformStore store;
    public V2DemoDataEnhancer(PlatformStore store) { this.store = store; }

    @EventListener(ApplicationReadyEvent.class)
    public void enhanceSeedData() {
        store.userByEmail("passenger@busbd.local").ifPresent(user -> {
            user.setEmailVerified(true);
            user.setPhone("+8801700000000");
            user.setEmergencyContact("+8801800000000");
            store.save(user);
        });
        store.users().forEach(user -> { if (!user.isEmailVerified()) { user.setEmailVerified(true); store.save(user); } });
        store.buses().forEach(bus -> {
            if (bus.getCoachType().toLowerCase().contains("sleeper")) bus.setSeatLayout("1X1");
            else bus.setSeatLayout("2X2");
            if (bus.getWomenReservedSeats() == null) bus.setWomenReservedSeats(bus.getSeatLayout().equals("1X1") ? "1A,1B" : "1A,1B,1C,1D");
            store.save(bus);
        });
        store.routes().forEach(route -> {
            if (route.getBoardingPointsCsv() == null || route.getBoardingPointsCsv().isBlank()) {
                route.setBoardingPointsCsv(route.getOrigin().equalsIgnoreCase("Dhaka") ? "Arambagh,Kalyanpur,Abdullahpur" : route.getOrigin());
            }
            if (route.getDroppingPointsCsv() == null || route.getDroppingPointsCsv().isBlank()) {
                route.setDroppingPointsCsv(route.getDestination().equalsIgnoreCase("Chattogram") ? "Dampara,AK Khan,Chattogram" : route.getDestination());
            }
            store.save(route);
        });
    }
}
