/**
 * The event types the booking service publishes, and the payload each one
 * carries. Event names are strings so that a subscriber can register for a
 * type the publisher does not import.
 *
 * Payloads carry ids and values, never objects the publisher keeps editing.
 * A subscriber that wants the current booking reads it from the store.
 */

/** Published once a booking has been written to the store. */
export const BOOKING_CONFIRMED = 'booking.confirmed';

/** Published once a booking has been marked cancelled in the store. */
export const BOOKING_CANCELLED = 'booking.cancelled';

/** Published when a cancellation owes the organizer money. */
export const REFUND_REQUESTED = 'refund.requested';

export interface BookingConfirmed {
  bookingId: string;
  roomId: string;
  organizer: string;
  organizerEmail: string;
  start: number;
  end: number;
  priceCents: number;
  confirmedAtMinute: number;
}

export interface BookingCancelled {
  bookingId: string;
  roomId: string;
  organizer: string;
  organizerEmail: string;
  start: number;
  end: number;
  cancelledAtMinute: number;
}

export interface RefundRequested {
  bookingId: string;
  organizer: string;
  organizerEmail: string;
  amountCents: number;
  reason: string;
  requestedAtMinute: number;
}
