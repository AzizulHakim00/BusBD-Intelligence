package com.busbd.intelligence.repository;

import com.busbd.intelligence.domain.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.*;

@Repository
@Transactional
public class PlatformStore {
    @PersistenceContext
    private EntityManager em;

    public <T> T save(T entity) {
        if (em.contains(entity)) return entity;
        try {
            var id = entity.getClass().getMethod("getId").invoke(entity);
            if (id == null) { em.persist(entity); return entity; }
        } catch (ReflectiveOperationException ignored) { }
        return em.merge(entity);
    }

    public void flush() { em.flush(); }
    public Optional<UserAccount> userByEmail(String email) {
        if (email == null) return Optional.empty();
        return em.createQuery("select u from UserAccount u where lower(u.email)=:email", UserAccount.class)
                .setParameter("email", email.toLowerCase(Locale.ROOT)).getResultStream().findFirst();
    }
    public Optional<UserAccount> user(UUID id) { return Optional.ofNullable(em.find(UserAccount.class, id)); }
    public List<UserAccount> users() { return em.createQuery("select u from UserAccount u order by u.createdAt desc", UserAccount.class).getResultList(); }
    public List<TransportOperator> operators() { return em.createQuery("select o from TransportOperator o order by o.name", TransportOperator.class).getResultList(); }
    public List<Counter> counters() { return em.createQuery("select c from Counter c order by c.district,c.name", Counter.class).getResultList(); }
    public List<DriverProfile> drivers() { return em.createQuery("select d from DriverProfile d order by d.fullName", DriverProfile.class).getResultList(); }
    public List<Bus> buses() { return em.createQuery("select b from Bus b order by b.registrationNumber", Bus.class).getResultList(); }
    public Optional<Bus> bus(UUID id) { return Optional.ofNullable(em.find(Bus.class, id)); }
    public List<RoutePlan> routes() { return em.createQuery("select r from RoutePlan r order by r.origin,r.destination", RoutePlan.class).getResultList(); }
    public Optional<RoutePlan> route(UUID id) { return Optional.ofNullable(em.find(RoutePlan.class, id)); }
    public List<Trip> trips() { return em.createQuery("select t from Trip t order by t.departureTime", Trip.class).getResultList(); }
    public List<Trip> futureTrips() {
        return em.createQuery("select t from Trip t where t.departureTime>=:now order by t.departureTime", Trip.class)
                .setParameter("now", OffsetDateTime.now().minusHours(2)).getResultList();
    }
    public Optional<Trip> trip(UUID id) { return Optional.ofNullable(em.find(Trip.class, id)); }
    public List<Booking> bookings() { return em.createQuery("select b from Booking b order by b.createdAt desc", Booking.class).getResultList(); }
    public Optional<Booking> bookingByReference(String reference) {
        return em.createQuery("select b from Booking b where upper(b.reference)=:reference", Booking.class)
                .setParameter("reference", reference.toUpperCase(Locale.ROOT)).getResultStream().findFirst();
    }
    public Optional<Booking> bookingByIdempotencyKey(String key) {
        if (key == null || key.isBlank()) return Optional.empty();
        return em.createQuery("select b from Booking b where b.idempotencyKey=:key", Booking.class)
                .setParameter("key", key).getResultStream().findFirst();
    }
    public List<Booking> bookingsByEmail(String email) {
        return em.createQuery("select b from Booking b where lower(b.passengerEmail)=:email order by b.createdAt desc", Booking.class)
                .setParameter("email", email.toLowerCase(Locale.ROOT)).getResultList();
    }
    public List<Booking> bookingsForTrip(UUID tripId) {
        return em.createQuery("select b from Booking b where b.tripId=:tripId and b.status<>'CANCELLED'", Booking.class)
                .setParameter("tripId", tripId).getResultList();
    }
    public List<BookingPassenger> passengersForBooking(UUID bookingId) {
        return em.createQuery("select p from BookingPassenger p where p.bookingId=:bookingId order by p.seatNumber", BookingPassenger.class)
                .setParameter("bookingId", bookingId).getResultList();
    }
    public List<BookingSeatReservation> reservationsForTrip(UUID tripId) {
        return em.createQuery("select r from BookingSeatReservation r where r.tripId=:tripId", BookingSeatReservation.class)
                .setParameter("tripId", tripId).getResultList();
    }
    public void deleteReservationsForBooking(UUID bookingId) {
        em.createQuery("delete from BookingSeatReservation r where r.bookingId=:bookingId")
                .setParameter("bookingId", bookingId).executeUpdate();
    }
    public Optional<Refund> refundByBooking(UUID bookingId) {
        return em.createQuery("select r from Refund r where r.bookingId=:bookingId", Refund.class)
                .setParameter("bookingId", bookingId).getResultStream().findFirst();
    }
    public List<VehicleLocation> latestLocations() {
        return em.createQuery("select v from VehicleLocation v where v.recordedAt=(select max(v2.recordedAt) from VehicleLocation v2 where v2.busId=v.busId)", VehicleLocation.class).getResultList();
    }
    public Optional<VehicleLocation> latestLocation(UUID busId) {
        return em.createQuery("select v from VehicleLocation v where v.busId=:busId order by v.recordedAt desc", VehicleLocation.class)
                .setParameter("busId", busId).setMaxResults(1).getResultStream().findFirst();
    }
    public List<Complaint> complaints() { return em.createQuery("select c from Complaint c order by c.createdAt desc", Complaint.class).getResultList(); }
    public long count(Class<?> type) { return em.createQuery("select count(e) from " + type.getSimpleName() + " e", Long.class).getSingleResult(); }
}
