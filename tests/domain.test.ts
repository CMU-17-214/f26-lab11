import { describe, expect, it } from 'vitest';
import { formatRange, rangesOverlap } from '../src/domain/booking';
import { validateRequest } from '../src/domain/validation';
import { freeSlotsForRoom } from '../src/service/availability';
import { formatCents, priceRequest, refundFor } from '../src/service/pricing';
import { SAMPLE_ROOMS } from '../src/support/sampleData';
import type { Booking } from '../src/domain/types';
import { aRequest } from './fixtures';

const WEAN_5409 = SAMPLE_ROOMS[0];

describe('ranges', () => {
  it('treats back-to-back ranges as free of each other and formats them for a receipt', () => {
    expect(rangesOverlap(540, 600, 600, 660)).toBe(false);
    expect(rangesOverlap(540, 601, 600, 660)).toBe(true);
    expect(formatRange(540, 660)).toBe('09:00-11:00');
  });
});

describe('validation', () => {
  it('accepts a request inside the rules', () => {
    expect(validateRequest(aRequest(), WEAN_5409).valid).toBe(true);
  });

  it('rejects an unknown room, a party larger than the room, and hours outside the day', () => {
    const unknownRoom = validateRequest(aRequest({ roomId: 'nope' }), undefined);
    expect(unknownRoom).toEqual({ valid: false, reason: 'unknown room nope' });

    const tooMany = validateRequest(aRequest({ attendees: 40 }), WEAN_5409);
    expect(tooMany.valid).toBe(false);
    expect(tooMany.reason).toContain('seats 12');

    expect(validateRequest(aRequest({ start: 5 * 60, end: 6 * 60 }), WEAN_5409).valid).toBe(false);
    expect(validateRequest(aRequest({ start: 660, end: 540 }), WEAN_5409).valid).toBe(false);
  });
});

describe('pricing', () => {
  it('charges the hourly rate plus the projector surcharge, discounted in the evening', () => {
    expect(priceRequest(aRequest({ start: 540, end: 660 }), WEAN_5409)).toBe(8500);
    expect(priceRequest(aRequest({ start: 17 * 60, end: 19 * 60 }), WEAN_5409)).toBe(7700);
    expect(formatCents(8500)).toBe('$85.00');
  });

  it('refunds in full more than two hours ahead, half after that, nothing once it starts', () => {
    const booking = { start: 660, priceCents: 8500 } as Booking;
    expect(refundFor(booking, 480).cents).toBe(8500);
    expect(refundFor(booking, 600).cents).toBe(4250);
    expect(refundFor(booking, 660).cents).toBe(0);
  });
});

describe('availability', () => {
  it('reports the windows a room has left and ignores cancelled bookings', () => {
    const held = [
      { roomId: 'WEH-5409', start: 540, end: 660, status: 'confirmed' } as Booking,
      { roomId: 'WEH-5409', start: 780, end: 840, status: 'confirmed' } as Booking,
      { roomId: 'WEH-5409', start: 900, end: 960, status: 'cancelled' } as Booking,
    ];
    expect(freeSlotsForRoom('WEH-5409', held)).toEqual([
      { roomId: 'WEH-5409', start: 420, end: 540 },
      { roomId: 'WEH-5409', start: 660, end: 780 },
      { roomId: 'WEH-5409', start: 840, end: 1320 },
    ]);
  });
});
