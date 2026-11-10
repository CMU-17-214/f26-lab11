import { formatMinute, formatRange } from '../domain/booking';
import { formatCents } from '../service/pricing';
import type { BookingCancelled, BookingConfirmed } from '../bus/events';

/** Template names, used as part of the mail outbox key. */
export const CONFIRMATION_TEMPLATE = 'booking-confirmation';
export const CANCELLATION_TEMPLATE = 'booking-cancellation';
export const REMINDER_TEMPLATE = 'booking-reminder';

export function confirmationSubject(event: BookingConfirmed): string {
  return `Room confirmed: ${event.roomId} at ${formatMinute(event.start)}`;
}

export function confirmationBody(event: BookingConfirmed, roomLabel: string): string {
  return [
    `Hello ${event.organizer},`,
    '',
    `${roomLabel} is held for you, ${formatRange(event.start, event.end)}.`,
    `Booking reference ${event.bookingId}.`,
    `Charged ${formatCents(event.priceCents)}.`,
    '',
    'Cancel from the reservations page if your plans change.',
  ].join('\n');
}

export function cancellationSubject(event: BookingCancelled): string {
  return `Room released: ${event.roomId} at ${formatMinute(event.start)}`;
}

export function cancellationBody(event: BookingCancelled, roomLabel: string): string {
  return [
    `Hello ${event.organizer},`,
    '',
    `${roomLabel} is no longer held for you, ${formatRange(event.start, event.end)}.`,
    `Booking reference ${event.bookingId}.`,
    '',
    'Any refund you are owed follows separately.',
  ].join('\n');
}

export function reminderSubject(event: BookingConfirmed): string {
  return `Starting soon: ${event.roomId} at ${formatMinute(event.start)}`;
}

export function reminderBody(event: BookingConfirmed, roomLabel: string, leadMinutes: number): string {
  return [
    `Hello ${event.organizer},`,
    '',
    `${roomLabel} starts in ${leadMinutes} minutes, ${formatRange(event.start, event.end)}.`,
    `Booking reference ${event.bookingId}.`,
  ].join('\n');
}
