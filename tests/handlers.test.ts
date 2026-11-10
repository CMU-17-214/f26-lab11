import { describe, expect, it } from 'vitest';
import { BOOKING_CONFIRMED } from '../src/bus/events';
import {
  CANCELLATION_TEMPLATE,
  CONFIRMATION_TEMPLATE,
  REMINDER_TEMPLATE,
} from '../src/integrations/templates';
import { REMINDER_LEAD_MINUTES } from '../src/handlers/reminderScheduler';
import { aBookingWithRefund, aRequest, newApp } from './fixtures';

describe('email confirmation', () => {
  it('queues a confirmation for the organizer and a release notice on cancellation', () => {
    const app = newApp();
    const booking = aBookingWithRefund(app);

    const confirmation = app.mailer.queuedMessage(CONFIRMATION_TEMPLATE, booking.id);
    expect(confirmation?.to).toBe('hahmad@example.edu');
    expect(confirmation?.body).toContain('Wean Hall 5409');
    expect(confirmation?.body).toContain('$85.00');

    app.service.cancel(booking.id);
    expect(app.mailer.queuedMessage(CANCELLATION_TEMPLATE, booking.id)?.subject).toContain(
      'Room released',
    );
  });
});

describe('reminders', () => {
  it('schedules a reminder before the start and drops it when the booking is cancelled', () => {
    const app = newApp();
    const booking = app.service.book(aRequest({ start: 11 * 60, end: 12 * 60 }));

    expect(app.reminders.scheduledFor(booking.id)?.dueAtMinute).toBe(
      11 * 60 - REMINDER_LEAD_MINUTES,
    );

    app.service.cancel(booking.id);
    expect(app.reminders.scheduledFor(booking.id)).toBeUndefined();
    expect(app.reminders.size()).toBe(0);
  });
});

describe('a confirmation message delivered again after the booking changed', () => {
  it('leaves the reminder schedule and the receipts as they were', () => {
    const app = newApp();
    const booking = aBookingWithRefund(app);
    const confirmation = app.bus.messagesOfType(BOOKING_CONFIRMED)[0];
    app.service.cancel(booking.id);
    const receiptAfterCancellation = app.receipts.forBooking(booking.id);

    app.bus.redeliver(confirmation.id);

    expect(app.reminders.scheduledFor(booking.id)).toBeUndefined();
    expect(app.reminders.size()).toBe(0);
    expect(app.reminders.dispatchDue(24 * 60)).toBe(0);
    expect(app.mailer.queuedMessage(REMINDER_TEMPLATE, booking.id)).toBeUndefined();
    expect(app.receipts.forBooking(booking.id)).toEqual(receiptAfterCancellation);
    expect(app.bus.deadLetters()).toHaveLength(0);
  });
});

describe('receipts', () => {
  it('renders one receipt for a booking', () => {
    const app = newApp();
    const booking = app.service.book(aRequest());

    const receipt = app.receipts.forBooking(booking.id);
    expect(receipt?.receiptId).toBe(`rcpt-${booking.id}`);
    expect(receipt?.amountCents).toBe(8500);
    expect(receipt?.lines).toContain('Total: $85.00');
  });
});

describe('dashboard statistics', () => {
  it('counts what the store holds, before and after a cancellation', () => {
    const app = newApp();
    app.service.book(aRequest({ start: 540, end: 660 }));
    const second = app.service.book(aRequest({ start: 11 * 60, end: 12 * 60 }));

    expect(app.stats.current()).toMatchObject({
      confirmedBookings: 2,
      cancelledBookings: 0,
      bookedMinutes: 180,
    });

    app.service.cancel(second.id);
    expect(app.stats.current()).toMatchObject({ confirmedBookings: 1, cancelledBookings: 1 });
  });
});

describe('the refund ledger', () => {
  it('books an entry and sends the money back for a refund request', () => {
    const app = newApp();
    const booking = aBookingWithRefund(app);

    app.service.cancel(booking.id);

    expect(app.ledger.forBooking(booking.id)).toHaveLength(1);
    expect(app.ledger.totalRefundedCents()).toBe(8500);
    expect(app.gateway.settledFor(booking.id)).toHaveLength(1);
    expect(app.gateway.totalSettledCents()).toBe(8500);
  });

  it('books nothing when the cancellation owes nothing', () => {
    const app = newApp();
    const booking = aBookingWithRefund(app);
    app.clock.set(11 * 60);

    app.service.cancel(booking.id);

    expect(app.ledger.size()).toBe(0);
    expect(app.gateway.callCount()).toBe(0);
  });
});
