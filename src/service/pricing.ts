import { MINUTES_PER_HOUR } from '../domain/booking';
import type { Booking, BookingRequest, Room } from '../domain/types';

/** Bookings that start at or after this minute get the evening discount. */
export const EVENING_START_MINUTE = 17 * 60;

/** The evening discount, as a multiplier on the hourly rate. */
export const EVENING_MULTIPLIER = 0.9;

/** Rooms with a projector carry a flat surcharge per booking. */
export const PROJECTOR_SURCHARGE_CENTS = 500;

/** A cancellation this far ahead of the start minute is refunded in full. */
export const FULL_REFUND_LEAD_MINUTES = 120;

/** A later cancellation keeps this share of the price. */
export const LATE_CANCELLATION_SHARE = 0.5;

/**
 * What a request costs, in cents. Rate times hours, discounted in the evening,
 * plus the projector surcharge when the room has one. Always rounded to a
 * whole cent.
 */
export function priceRequest(request: BookingRequest, room: Room): number {
  const hours = (request.end - request.start) / MINUTES_PER_HOUR;
  const rate = request.start >= EVENING_START_MINUTE
    ? room.hourlyRateCents * EVENING_MULTIPLIER
    : room.hourlyRateCents;
  const surcharge = room.projector ? PROJECTOR_SURCHARGE_CENTS : 0;
  return Math.round(rate * hours) + surcharge;
}

/** What a cancellation returns to the organizer, with the reason to print. */
export interface RefundDecision {
  cents: number;
  reason: string;
}

/**
 * The refund policy. Cancel at least two hours before the start minute and the
 * booking is refunded in full; cancel later and half the price is kept to
 * cover the slot nobody else could take.
 */
export function refundFor(booking: Booking, cancelledAtMinute: number): RefundDecision {
  const lead = booking.start - cancelledAtMinute;
  if (booking.priceCents === 0) {
    return { cents: 0, reason: 'nothing was charged for this booking' };
  }
  if (lead >= FULL_REFUND_LEAD_MINUTES) {
    return { cents: booking.priceCents, reason: 'cancelled more than two hours ahead' };
  }
  if (lead <= 0) {
    return { cents: 0, reason: 'cancelled at or after the start minute' };
  }
  return {
    cents: Math.round(booking.priceCents * (1 - LATE_CANCELLATION_SHARE)),
    reason: 'cancelled less than two hours ahead',
  };
}

/** Cents formatted the way receipts and reports print them. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}$${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}
