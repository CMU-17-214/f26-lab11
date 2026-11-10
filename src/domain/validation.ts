import type { BookingRequest, Room, ValidationResult } from './types';

/** The earliest minute the buildings open. */
export const OPENING_MINUTE = 7 * 60;

/** The latest minute the buildings close. */
export const CLOSING_MINUTE = 22 * 60;

/** No single hold may run longer than this. */
export const MAX_BOOKING_MINUTES = 4 * 60;

/** Every hold has to cover at least this many minutes. */
export const MIN_BOOKING_MINUTES = 30;

const ok: ValidationResult = { valid: true };

function fail(reason: string): ValidationResult {
  return { valid: false, reason };
}

/**
 * Checks a request against the booking rules that do not depend on what is
 * already in the store. Overlap is not checked here: that needs the store and
 * lives in the service.
 */
export function validateRequest(request: BookingRequest, room: Room | undefined): ValidationResult {
  if (room === undefined) {
    return fail(`unknown room ${request.roomId}`);
  }
  if (!Number.isInteger(request.start) || !Number.isInteger(request.end)) {
    return fail('start and end have to be whole minutes');
  }
  if (request.end <= request.start) {
    return fail('end has to come after start');
  }
  if (request.start < OPENING_MINUTE || request.end > CLOSING_MINUTE) {
    return fail(`bookings run between ${OPENING_MINUTE} and ${CLOSING_MINUTE}`);
  }
  const length = request.end - request.start;
  if (length < MIN_BOOKING_MINUTES) {
    return fail(`bookings run at least ${MIN_BOOKING_MINUTES} minutes`);
  }
  if (length > MAX_BOOKING_MINUTES) {
    return fail(`bookings run at most ${MAX_BOOKING_MINUTES} minutes`);
  }
  if (request.attendees < 1) {
    return fail('a booking needs at least one attendee');
  }
  if (request.attendees > room.capacity) {
    return fail(`${room.id} seats ${room.capacity}, not ${request.attendees}`);
  }
  if (request.organizer.trim() === '') {
    return fail('a booking needs an organizer');
  }
  if (!request.organizerEmail.includes('@')) {
    return fail(`${request.organizerEmail} is not an address we can mail`);
  }
  return ok;
}
