import type { Booking } from '../domain/types';

/**
 * Storage for bookings. Every method here is a plain read or write: the store
 * enforces no booking rules and publishes no events. The service does both.
 */
export interface BookingStore {
  /** Saves a new booking or replaces an existing one with the same id. */
  save(booking: Booking): void;

  /** The booking with this id, or undefined if the store never had it. */
  find(bookingId: string): Booking | undefined;

  /** Every booking the store holds, in insertion order. */
  all(): Booking[];

  /** Every booking for one room, in insertion order. */
  forRoom(roomId: string): Booking[];

  /** Every booking with this status, in insertion order. */
  withStatus(status: Booking['status']): Booking[];

  /** Drops a booking. Returns true when there was one to drop. */
  remove(bookingId: string): boolean;

  /** How many bookings the store holds right now. */
  size(): number;
}
