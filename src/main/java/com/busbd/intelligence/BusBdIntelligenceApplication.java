package com.busbd.intelligence;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;

@SpringBootApplication
@RestController
@RequestMapping("/api")
public class BusBdIntelligenceApplication {
    private final List<Bus> buses = new CopyOnWriteArrayList<>(List.of(
            new Bus(1L,"DHAKA-METRO-B-15-4821","Green Line","ON_TIME",23.8103,90.4125,47,12,"Mohakhali",31,40),
            new Bus(2L,"DHAKA-METRO-B-14-7732","Shohagh Paribahan","DELAYED",23.7509,90.3935,24,28,"Sayedabad",28,36),
            new Bus(3L,"CHATTA-METRO-B-11-3029","Hanif Enterprise","ON_TIME",22.3569,91.7832,52,8,"Dampara",39,44),
            new Bus(4L,"DHAKA-METRO-B-16-1094","Ena Transport","BOARDING",23.8759,90.3795,0,16,"Abdullahpur",19,40),
            new Bus(5L,"COXS-B-08-8891","Saintmartin Paribahan","ON_TIME",21.4272,92.0058,42,22,"Kolatoli",35,38)
    ));

    public static void main(String[] args) { SpringApplication.run(BusBdIntelligenceApplication.class, args); }

    @GetMapping("/dashboard")
    public Map<String,Object> dashboard(){
        long active=buses.stream().filter(b->!"OFFLINE".equals(b.status())).count();
        long delayed=buses.stream().filter(b->"DELAYED".equals(b.status())).count();
        return Map.of("activeBuses",active,"totalRoutes",5,"liveTrips",3,"passengersToday",12486,"onTimeRate",91.8,"revenueToday",2864500,"alerts",delayed,"modelVersion","ETA-BD 2.4");
    }

    @GetMapping("/buses") public List<Bus> buses(){ return buses; }

    @GetMapping("/trips")
    public List<Trip> trips(){
        var now=LocalDateTime.now();
        return List.of(
                new Trip("TRP-1001","DHK-CTG-01","Green Line",now.plusMinutes(35),9,"LOW"),
                new Trip("TRP-1002","DHK-CXB-02","Shohagh Paribahan",now.plusHours(1),8,"MEDIUM"),
                new Trip("TRP-1003","CTG-CXB-05","Hanif Enterprise",now.minusMinutes(30),5,"LOW"),
                new Trip("TRP-1004","DHK-SYL-03","Ena Transport",now.plusHours(2),21,"LOW")
        );
    }

    @PostMapping("/recommendations")
    public ResponseEntity<?> recommend(@Valid @RequestBody RecommendationRequest r){
        String route=(r.destination().toLowerCase().contains("cox"))?"DHK-CXB-02":"DHK-CTG-01";
        return ResponseEntity.ok(Map.of(
                "recommendation","Best balanced option","routeCode",route,"operator","Green Line",
                "departure",LocalDateTime.now().plusHours(1).toString(),"estimatedArrival",LocalDateTime.now().plusHours(7).toString(),
                "fareBdt",route.contains("CXB")?1800:1200,"availableSeats",9,"delayRisk","LOW",
                "explanation","Ranked using route duration, seat availability, fare and delay risk."
        ));
    }

    @PostMapping("/simulation/tick")
    public List<Bus> tick(){
        Random random=new Random();
        for(int i=0;i<buses.size();i++){
            Bus b=buses.get(i);
            buses.set(i,new Bus(b.id(),b.registrationNumber(),b.operatorName(),b.status(),
                    b.latitude()+(random.nextDouble()-.5)*.006,b.longitude()+(random.nextDouble()-.5)*.006,
                    Math.max(0,Math.min(80,b.speedKph()+random.nextInt(-3,4))),Math.max(1,b.etaMinutes()-1),
                    b.nextStop(),b.occupiedSeats(),b.capacity()));
        }
        return buses;
    }

    public record Bus(Long id,String registrationNumber,String operatorName,String status,double latitude,double longitude,double speedKph,int etaMinutes,String nextStop,int occupiedSeats,int capacity){}
    public record Trip(String tripCode,String routeCode,String operator,LocalDateTime departureTime,int availableSeats,String riskLevel){}
    public record RecommendationRequest(@NotBlank String origin,@NotBlank String destination,String preference,Integer passengerCount){}
}
