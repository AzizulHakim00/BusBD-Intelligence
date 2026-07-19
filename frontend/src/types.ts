export type Trip = {
  id: string; busId: string; operator: string; bus: string; coachType: string;
  origin: string; destination: string; stops: string[]; departureTime: string; arrivalTime: string;
  fare: number; availableSeats: number; delayRisk: number; status: string;
  boardingPoint?: string; droppingPoint?: string;
}
export type Seat = { number: string; status: 'AVAILABLE' | 'LOCKED' | 'BOOKED' }
export type Location = { busId: string; tripId: string; latitude: number; longitude: number; speedKph: number; anomalyScore: number; recordedAt: string }
export type User = { id: string; name: string; email: string; role: string }
