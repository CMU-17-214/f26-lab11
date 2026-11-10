import type { Booking } from '../domain/types';
import type { BookingStore } from './bookingStore';

/**
 * The store the service runs against. A `Map` keyed by booking id, so
 * insertion order is the iteration order and every run of a test sees the same
 * order.
 *
 * Bookings are copied on the way in and on the way out, so a caller that holds
 * a returned booking cannot edit what the store keeps.
 */
export class InMemoryBookingStore implements BookingStore {
  private readonly bookings = new Map<string, Booking>();

  save(booking: Booking): void {
    this.bookings.set(booking.id, { ...booking });
  }

  find(bookingId: string): Booking | undefined {
    const booking = this.bookings.get(bookingId);
    return booking === undefined ? undefined : { ...booking };
  }

  all(): Booking[] {
    return [...this.bookings.values()].map((booking) => ({ ...booking }));
  }

  forRoom(roomId: string): Booking[] {
    return this.all().filter((booking) => booking.roomId === roomId);
  }

  withStatus(status: Booking['status']): Booking[] {
    return this.all().filter((booking) => booking.status === status);
  }

  remove(bookingId: string): boolean {
    return this.bookings.delete(bookingId);
  }

  size(): number {
    return this.bookings.size;
  }
}
