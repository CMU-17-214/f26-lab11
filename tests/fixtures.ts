import { buildReservationApp } from '../src/app';
import type { ReservationApp } from '../src/app';
import type { Booking, BookingRequest } from '../src/domain/types';
import { sampleRequest } from '../src/support/sampleData';

/** A fresh service with the sample rooms loaded and nothing booked. */
export function newApp(): ReservationApp {
  return buildReservationApp();
}

/** A request that passes validation, with any field overridden. */
export function aRequest(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return sampleRequest(overrides);
}

/**
 * A booking made far enough ahead that cancelling it at the start of a run is
 * refunded in full.
 */
export function aBookingWithRefund(app: ReservationApp): Booking {
  return app.service.book(aRequest({ start: 11 * 60, end: 13 * 60 }));
}
