from __future__ import annotations

from datetime import datetime
from math import exp
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(
    title="BusBD Intelligence ML Service",
    version="1.0.0",
    description="Demonstration ETA, demand, delay-risk, anomaly and recommendation APIs.",
)


class EtaRequest(BaseModel):
    distance_remaining_km: float = Field(ge=0)
    average_speed_kph: float = Field(gt=0)
    traffic_index: float = Field(default=1.0, ge=0.5, le=3.0)
    stop_count: int = Field(default=0, ge=0)


class DelayRequest(BaseModel):
    route_distance_km: float = Field(gt=0)
    departure_hour: int = Field(ge=0, le=23)
    rain_probability: float = Field(default=0.0, ge=0, le=1)
    traffic_index: float = Field(default=1.0, ge=0.5, le=3.0)
    historical_delay_minutes: float = Field(default=12, ge=0)


class DemandRequest(BaseModel):
    route: str
    day_of_week: int = Field(ge=0, le=6)
    days_until_departure: int = Field(ge=0, le=90)
    current_bookings: int = Field(ge=0)
    capacity: int = Field(gt=0)


class GpsRequest(BaseModel):
    speed_kph: float = Field(ge=0)
    acceleration_mps2: float = 0
    route_deviation_meters: float = Field(default=0, ge=0)
    location_age_seconds: int = Field(default=0, ge=0)


class TripCandidate(BaseModel):
    trip_id: str
    fare: float = Field(gt=0)
    duration_minutes: int = Field(gt=0)
    delay_risk: float = Field(ge=0, le=1)
    operator_rating: float = Field(ge=0, le=5)
    available_seats: int = Field(ge=0)


class RecommendRequest(BaseModel):
    preference: Literal["balanced", "cheapest", "fastest", "reliable"] = "balanced"
    trips: list[TripCandidate]


@app.get("/health")
def health() -> dict:
    return {"status": "healthy", "service": "busbd-ml", "time": datetime.utcnow().isoformat()}


@app.post("/predict/eta")
def eta(req: EtaRequest) -> dict:
    driving_minutes = req.distance_remaining_km / max(req.average_speed_kph, 1) * 60 * req.traffic_index
    stop_penalty = req.stop_count * 4.5
    predicted = round(driving_minutes + stop_penalty)
    confidence = round(max(0.55, min(0.96, 0.94 - abs(req.traffic_index - 1) * 0.12)), 3)
    return {"eta_minutes": predicted, "confidence": confidence, "model_version": "eta-baseline-v1"}


@app.post("/predict/delay-risk")
def delay(req: DelayRequest) -> dict:
    peak = 1 if req.departure_hour in {7, 8, 9, 17, 18, 19, 20} else 0
    raw = -3.2 + 0.6 * req.traffic_index + 1.2 * req.rain_probability + 0.35 * peak + 0.025 * req.historical_delay_minutes + 0.001 * req.route_distance_km
    probability = round(1 / (1 + exp(-raw)), 3)
    label = "HIGH" if probability >= 0.65 else "MEDIUM" if probability >= 0.35 else "LOW"
    return {"probability": probability, "risk": label, "model_version": "delay-baseline-v1"}


@app.post("/predict/demand")
def demand(req: DemandRequest) -> dict:
    weekend = 1.18 if req.day_of_week in {4, 5} else 1.0
    urgency = 1.25 if req.days_until_departure <= 2 else 1.1 if req.days_until_departure <= 7 else 0.92
    projected = min(req.capacity, round(req.current_bookings * weekend * urgency + req.capacity * 0.18))
    return {
        "projected_bookings": projected,
        "projected_occupancy": round(projected / req.capacity, 3),
        "model_version": "demand-baseline-v1",
    }


@app.post("/predict/gps-anomaly")
def anomaly(req: GpsRequest) -> dict:
    score = 0.0
    reasons: list[str] = []
    if req.speed_kph > 110:
        score += 0.45
        reasons.append("overspeed")
    if abs(req.acceleration_mps2) > 4:
        score += 0.25
        reasons.append("harsh acceleration or braking")
    if req.route_deviation_meters > 500:
        score += 0.25
        reasons.append("route deviation")
    if req.location_age_seconds > 120:
        score += 0.2
        reasons.append("stale GPS signal")
    score = round(min(score, 1.0), 3)
    return {"anomaly_score": score, "flagged": score >= 0.5, "reasons": reasons, "model_version": "gps-rules-v1"}


@app.post("/recommend")
def recommend(req: RecommendRequest) -> dict:
    if not req.trips:
        return {"ranked": []}
    max_fare = max(t.fare for t in req.trips)
    max_duration = max(t.duration_minutes for t in req.trips)
    ranked = []
    for trip in req.trips:
        fare_score = 1 - trip.fare / max_fare
        speed_score = 1 - trip.duration_minutes / max_duration
        reliability = 1 - trip.delay_risk
        availability = min(trip.available_seats / 10, 1)
        weights = {
            "balanced": (0.25, 0.25, 0.35, 0.15),
            "cheapest": (0.55, 0.15, 0.2, 0.1),
            "fastest": (0.15, 0.55, 0.2, 0.1),
            "reliable": (0.15, 0.15, 0.6, 0.1),
        }[req.preference]
        score = fare_score * weights[0] + speed_score * weights[1] + reliability * weights[2] + availability * weights[3] + trip.operator_rating / 5 * 0.1
        ranked.append({"trip_id": trip.trip_id, "score": round(score, 4)})
    ranked.sort(key=lambda item: item["score"], reverse=True)
    return {"preference": req.preference, "ranked": ranked, "model_version": "ranking-v1"}
