import type { Booking, Room } from './types';

/** Minutes in an hour, spelled out so the pricing math reads plainly. */
export const MINUTES_PER_HOUR = 60;

/**
 * True when two half-open ranges share at least one minute.
 *
 * Back-to-back ranges do not overlap: [540, 600) and [600, 660) are fine.
 */
export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** True when the booking is confirmed and covers at least one minute of the range. */
export function bookingCovers(booking: Booking, start: number, end: number): boolean {
  return booking.status === 'confirmed' && rangesOverlap(booking.start, booking.end, start, end);
}

/** "09:00" for 540. Used in receipts, reminders, and the usage report. */
export function formatMinute(minute: number): string {
  const hours = Math.floor(minute / MINUTES_PER_HOUR);
  const minutes = minute % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** "09:00-11:00" for a booking. */
export function formatRange(start: number, end: number): string {
  return `${formatMinute(start)}-${formatMinute(end)}`;
}

/** A one-line description of a booking, used in emails and the audit trail. */
export function describeBooking(booking: Booking, room: Room | undefined): string {
  const roomName = room ? `${room.building} ${room.name}` : booking.roomId;
  return `${booking.id} ${roomName} ${formatRange(booking.start, booking.end)}`;
}
