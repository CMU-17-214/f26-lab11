import { bookingCovers } from '../domain/booking';
import { CLOSING_MINUTE, MIN_BOOKING_MINUTES, OPENING_MINUTE } from '../domain/validation';
import type { Booking, FreeSlot } from '../domain/types';

/**
 * The windows on one room's day that no confirmed booking covers, in order.
 * Windows shorter than the minimum booking length are dropped, because nobody
 * can book them.
 */
export function freeSlotsForRoom(
  roomId: string,
  bookings: readonly Booking[],
  openingMinute = OPENING_MINUTE,
  closingMinute = CLOSING_MINUTE,
): FreeSlot[] {
  const held = bookings
    .filter((booking) => booking.roomId === roomId && booking.status === 'confirmed')
    .sort((left, right) => left.start - right.start);

  const slots: FreeSlot[] = [];
  let cursor = openingMinute;
  for (const booking of held) {
    if (booking.start > cursor) {
      slots.push({ roomId, start: cursor, end: Math.min(booking.start, closingMinute) });
    }
    cursor = Math.max(cursor, booking.end);
  }
  if (cursor < closingMinute) {
    slots.push({ roomId, start: cursor, end: closingMinute });
  }
  return slots.filter((slot) => slot.end - slot.start >= MIN_BOOKING_MINUTES);
}

/** The confirmed booking that stands in the way of this range, if there is one. */
export function conflictingBooking(
  bookings: readonly Booking[],
  roomId: string,
  start: number,
  end: number,
): Booking | undefined {
  return bookings.find(
    (booking) => booking.roomId === roomId && bookingCovers(booking, start, end),
  );
}
