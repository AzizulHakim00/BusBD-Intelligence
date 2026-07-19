package com.busbd.intelligence.config;

import com.busbd.intelligence.domain.*;
import com.busbd.intelligence.repository.PlatformStore;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Configuration
public class DataSeeder {
    @Bean
    CommandLineRunner seedData(PlatformStore store, PasswordEncoder encoder) {
        return args -> {
            if (!store.users().isEmpty()) return;

            store.save(new UserAccount("BusBD Super Admin", "admin@busbd.local", encoder.encode("Admin123!"), "SUPER_ADMIN"));
            store.save(new UserAccount("Green Line Operator", "operator@busbd.local", encoder.encode("Operator123!"), "OPERATOR_STAFF"));
            store.save(new UserAccount("Fleet Manager", "fleet@busbd.local", encoder.encode("Fleet123!"), "FLEET_MANAGER"));
            store.save(new UserAccount("Driver Demo", "driver@busbd.local", encoder.encode("Driver123!"), "DRIVER"));
            store.save(new UserAccount("Passenger Demo", "passenger@busbd.local", encoder.encode("Passenger123!"), "PASSENGER"));
            store.save(new UserAccount("Support Agent", "support@busbd.local", encoder.encode("Support123!"), "SUPPORT_AGENT"));

            TransportOperator green = store.save(new TransportOperator("Green Line Paribahan", "GL", "+8801711000001", "ops@greenline.demo"));
            TransportOperator shohagh = store.save(new TransportOperator("Shohagh Paribahan", "SH", "+8801711000002", "ops@shohagh.demo"));

            store.save(new Counter(green.getId(), "Arambagh Counter", "Dhaka", "Arambagh, Motijheel", "+8801711000101"));
            store.save(new Counter(green.getId(), "Dampara Counter", "Chattogram", "Dampara Bus Terminal", "+8801711000102"));
            store.save(new Counter(shohagh.getId(), "Kalyanpur Counter", "Dhaka", "Kalyanpur", "+8801711000201"));

            DriverProfile driver1 = store.save(new DriverProfile(green.getId(), "Md. Rahim Uddin", "DHA-DRV-1001", "+8801811000001"));
            DriverProfile driver2 = store.save(new DriverProfile(shohagh.getId(), "Md. Karim Mia", "DHA-DRV-1002", "+8801811000002"));

            Bus bus1 = store.save(new Bus(green.getId(), "DHAKA-METRO-B-15-2088", "Scania K410", "AC Business", 40));
            bus1.setAmenities("WiFi,USB,Blanket,Water"); store.save(bus1);
            Bus bus2 = store.save(new Bus(shohagh.getId(), "DHAKA-METRO-B-14-1777", "Hyundai Universe", "AC", 36));
            bus2.setAmenities("WiFi,USB,Water"); store.save(bus2);
            Bus bus3 = store.save(new Bus(green.getId(), "DHAKA-METRO-B-16-3001", "Volvo B11R", "Sleeper", 32));
            bus3.setAmenities("Sleeper,USB,Blanket"); store.save(bus3);

            RoutePlan r1 = store.save(new RoutePlan("Dhaka", "Chattogram", 264, "Dhaka,Cumilla,Feni,Chattogram"));
            RoutePlan r2 = store.save(new RoutePlan("Dhaka", "Cox's Bazar", 390, "Dhaka,Cumilla,Feni,Chattogram,Cox's Bazar"));
            RoutePlan r3 = store.save(new RoutePlan("Dhaka", "Sylhet", 240, "Dhaka,Bhairab,Sreemangal,Sylhet"));

            OffsetDateTime today = OffsetDateTime.now().plusDays(1).withHour(22).withMinute(30).withSecond(0).withNano(0);
            Trip t1 = new Trip(bus1.getId(), r1.getId(), driver1.getId(), today, today.plusHours(8).plusMinutes(40), new BigDecimal("1600"), 40);
            t1.setBoardingPoint("Arambagh"); t1.setDroppingPoint("Dampara"); store.save(t1);
            Trip t2 = new Trip(bus2.getId(), r1.getId(), driver2.getId(), today.plusMinutes(45), today.plusHours(9).plusMinutes(25), new BigDecimal("1800"), 36);
            t2.setBoardingPoint("Kalyanpur"); t2.setDroppingPoint("Dampara"); t2.setDelayRisk(0.18); store.save(t2);
            Trip t3 = new Trip(bus3.getId(), r2.getId(), driver1.getId(), today.plusDays(1), today.plusDays(1).plusHours(11), new BigDecimal("2200"), 32);
            t3.setBoardingPoint("Arambagh"); t3.setDroppingPoint("Cox's Bazar Terminal"); store.save(t3);
            Trip t4 = new Trip(bus2.getId(), r3.getId(), driver2.getId(), today.plusDays(2).minusHours(2), today.plusDays(2).plusHours(4), new BigDecimal("1400"), 36);
            store.save(t4);
        };
    }
}
