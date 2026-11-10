import { describe, expect, it } from 'vitest';
import { BOOKING_CANCELLED, BOOKING_CONFIRMED, REFUND_REQUESTED } from '../src/bus/events';
import { aBookingWithRefund, aRequest, newApp } from './fixtures';

describe('booking a room', () => {
  it('confirms a valid request, stores it, and gives each booking its own id', () => {
    const app = newApp();
    const first = app.service.book(aRequest());
    const second = app.service.book(aRequest({ start: 11 * 60, end: 12 * 60 }));

    expect(first.status).toBe('confirmed');
    expect(first.roomId).toBe('WEH-5409');
    expect(first.priceCents).toBe(8500);
    expect(app.service.get(first.id)).toEqual(first);
    expect(first.id).not.toBe(second.id);
    expect(app.service.listForRoom('WEH-5409')).toHaveLength(2);
  });

  it('refuses a range another booking holds and a request that breaks a rule', () => {
    const app = newApp();
    app.service.book(aRequest({ start: 540, end: 660 }));

    expect(() => app.service.book(aRequest({ start: 600, end: 720 }))).toThrow('already held');
    expect(() => app.service.book(aRequest({ attendees: 40 }))).toThrow('seats 12');
    expect(app.service.listForRoom('WEH-5409')).toHaveLength(1);
  });

  it('publishes one confirmation event and writes one audit record per booking', () => {
    const app = newApp();
    const booking = app.service.book(aRequest());

    const published = app.bus.messagesOfType(BOOKING_CONFIRMED);
    expect(published).toHaveLength(1);
    expect(published[0].payload).toMatchObject({ bookingId: booking.id, priceCents: 8500 });
    expect(app.bus.deliveryCount(published[0].id)).toBe(1);

    const records = app.audit.forSubject(booking.id);
    expect(records).toHaveLength(1);
    expect(records[0].action).toBe('booking.created');
  });
});

describe('cancelling a booking', () => {
  it('marks the booking cancelled, reports the refund, and publishes both events', () => {
    const app = newApp();
    const booking = aBookingWithRefund(app);

    const cancellation = app.service.cancel(booking.id);

    expect(cancellation.booking.status).toBe('cancelled');
    expect(cancellation.refundCents).toBe(8500);
    expect(app.service.get(booking.id)?.status).toBe('cancelled');
    expect(app.bus.messagesOfType(BOOKING_CANCELLED)).toHaveLength(1);
    expect(app.bus.messagesOfType(REFUND_REQUESTED)).toHaveLength(1);
    expect(cancellation.refundMessageId).toBe(app.bus.messagesOfType(REFUND_REQUESTED)[0].id);
  });

  it('publishes no refund event when nothing is owed', () => {
    const app = newApp();
    const booking = aBookingWithRefund(app);
    app.clock.set(11 * 60);

    const cancellation = app.service.cancel(booking.id);

    expect(cancellation.refundCents).toBe(0);
    expect(cancellation.refundMessageId).toBeUndefined();
    expect(app.bus.messagesOfType(REFUND_REQUESTED)).toHaveLength(0);
  });

  it('refuses an unknown booking and a booking that is already cancelled', () => {
    const app = newApp();
    const booking = aBookingWithRefund(app);
    app.service.cancel(booking.id);

    expect(() => app.service.cancel(booking.id)).toThrow('already cancelled');
    expect(() => app.service.cancel('bk-9999')).toThrow('unknown booking');
  });

  it('frees the range for the next caller', () => {
    const app = newApp();
    const booking = app.service.book(aRequest({ start: 540, end: 660 }));
    app.service.cancel(booking.id);

    expect(app.service.book(aRequest({ start: 540, end: 660 })).status).toBe('confirmed');
  });
});
