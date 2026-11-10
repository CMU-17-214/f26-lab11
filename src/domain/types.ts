/**
 * Shared data shapes for the reservation service.
 *
 * All times are minutes from midnight on the booking day, so 540 is 09:00.
 * Ranges are half-open, [start, end), so a booking that ends at 600 and one
 * that starts at 600 sit back to back without colliding.
 *
 * Money is always in cents, always an integer. Nothing here uses floating
 * point for an amount.
 */

export type BookingStatus = 'confirmed' | 'cancelled';

/** A bookable room in one of the campus buildings. */
export interface Room {
  id: string;
  name: string;
  building: string;
  capacity: number;
  hourlyRateCents: number;
  projector: boolean;
}

/** What a caller sends to ask for a room. */
export interface BookingRequest {
  roomId: string;
  organizer: string;
  organizerEmail: string;
  attendees: number;
  start: number;
  end: number;
  purpose?: string;
}

/** A hold on one room for one range. */
export interface Booking {
  id: string;
  roomId: string;
  organizer: string;
  organizerEmail: string;
  attendees: number;
  start: number;
  end: number;
  status: BookingStatus;
  priceCents: number;
  purpose?: string;
  createdAtMinute: number;
  cancelledAtMinute?: number;
}

/** What `cancel` hands back to its caller. */
export interface Cancellation {
  booking: Booking;
  refundCents: number;
  refundReason: string;
  /** The id of the refund message, when the cancellation owed money. */
  refundMessageId?: string;
}

/** A free window on a room's day. */
export interface FreeSlot {
  roomId: string;
  start: number;
  end: number;
}

/** The answer to "is this request allowed", with a reason when it is not. */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}
