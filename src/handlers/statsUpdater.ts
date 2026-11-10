import type { BookingCancelled, BookingConfirmed } from '../bus/events';
import type { Subscriber } from '../bus/inMemoryBus';
import type { BookingStore } from '../store/bookingStore';

/** The numbers on the operations dashboard. */
export interface DashboardStats {
  confirmedBookings: number;
  cancelledBookings: number;
  bookedMinutes: number;
  bookedRevenueCents: number;
}

/**
 * Keeps the operations dashboard current.
 *
 * On every message the handler counts the store and writes the result over the
 * previous numbers. It reads nothing from the message and keeps no counters of
 * its own, so `current()` reports what the store holds at the moment it is
 * called.
 */
export class StatsUpdater implements Subscriber<BookingConfirmed | BookingCancelled> {
  readonly name = 'StatsUpdater';

  private readonly store: BookingStore;
  private stats: DashboardStats = {
    confirmedBookings: 0,
    cancelledBookings: 0,
    bookedMinutes: 0,
    bookedRevenueCents: 0,
  };

  constructor(store: BookingStore) {
    this.store = store;
  }

  handle(): void {
    this.recompute();
  }

  /** Counts the store and replaces the dashboard numbers. */
  recompute(): void {
    const confirmed = this.store.withStatus('confirmed');
    const cancelled = this.store.withStatus('cancelled');
    this.stats = {
      confirmedBookings: confirmed.length,
      cancelledBookings: cancelled.length,
      bookedMinutes: confirmed.reduce((sum, booking) => sum + (booking.end - booking.start), 0),
      bookedRevenueCents: confirmed.reduce((sum, booking) => sum + booking.priceCents, 0),
    };
  }

  /** The current dashboard numbers. */
  current(): DashboardStats {
    return { ...this.stats };
  }
}
