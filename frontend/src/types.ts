export type Trip = {
  id: string; busId: string; operatorId?: string; operator: string; bus: string; registrationNumber?: string; coachType: string;
  origin: string; destination: string; stops: string[]; boardingPoints?: string[]; droppingPoints?: string[]; amenities?: string[];
  departureTime: string; arrivalTime: string; fare: number; availableSeats: number; delayRisk: number; status: string;
  boardingPoint?: string; droppingPoint?: string; seatLayout?: string;
}
export type Seat = {
  number: string; status: 'AVAILABLE' | 'LOCKED' | 'BOOKED' | 'BLOCKED'; category?: 'REGULAR' | 'WOMEN_RESERVED' | 'SLEEPER';
  row?: number; column?: string; aisleAfter?: boolean; price?: number;
}
export type Location = {
  busId: string; tripId: string; latitude: number; longitude: number; speedKph: number; heading: number; anomalyScore: number;
  recordedAt: string; stale?: boolean; staleSeconds?: number; routeProgress?: number; nextStop?: string; routeDeviation?: boolean;
  origin?: string; destination?: string; bus?: string; registrationNumber?: string;
}
export type User = {
  id: string; name: string; email: string; role: string; phone?: string; emergencyContact?: string;
  preferredLanguage?: string; emailVerified?: boolean; createdAt?: string;
}
export type PassengerInput = { fullName: string; passengerType: 'ADULT' | 'CHILD'; gender: '' | 'MALE' | 'FEMALE'; seatNumber: string; phone?: string }
export type BookingView = {
  reference: string; tripId: string; passengerName: string; passengerEmail: string; passengerPhone?: string; seats: string[];
  boardingPoint: string; droppingPoint: string; origin: string; destination: string; departureTime: string; arrivalTime: string;
  subtotal: number; discountAmount: number; totalAmount: number; promoCode?: string; status: string; paymentStatus: string;
  paymentProvider: string; paymentReference: string; refundStatus: string; refundAmount: number; createdAt: string;
  passengers: PassengerInput[]; ticketToken: string; qrCode: string;
}
export type DriverAssignment = {
  tripId: string; busId: string; driverId: string; status: string; origin: string; destination: string; stops: string[];
  departureTime: string; arrivalTime: string; operator: string; bus: string; registrationNumber: string; coachType: string;
  passengerCount: number; bookedSeats: number; latestLocation?: Location; manifest: Array<{ fullName: string; seatNumber: string; passengerType: string; gender?: string; phone?: string }>;
}
