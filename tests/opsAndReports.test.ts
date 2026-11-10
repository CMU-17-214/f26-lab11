import { describe, expect, it } from 'vitest';
import { REMINDER_TEMPLATE } from '../src/integrations/templates';
import { buildUsageReport, formatUsageReport } from '../src/reports/usageReport';
import { aBookingWithRefund, aRequest, newApp } from './fixtures';

describe('the nightly sweep', () => {
  it('files away cancelled bookings that are old enough and keeps the rest', () => {
    const app = newApp();
    const booking = aBookingWithRefund(app);
    app.service.cancel(booking.id);

    const early = app.sweep.run(app.clock.minuteOfDay() + 10);
    expect(early.bookingsPurged).toBe(0);
    expect(app.store.size()).toBe(1);

    const later = app.sweep.run(app.clock.minuteOfDay() + 240);
    expect(later.bookingsPurged).toBe(1);
    expect(later.indexRowsRemoved).toBe(1);
    expect(app.store.size()).toBe(0);
  });

  it('defers a booking whose index row it could not remove, and finishes it the next run', () => {
    const app = newApp();
    const booking = aBookingWithRefund(app);
    app.service.cancel(booking.id);
    app.searchIndex.available = false;

    const nightOne = app.sweep.run(app.clock.minuteOfDay() + 240);

    expect(nightOne.indexRowsDeferred).toBe(1);
    expect(nightOne.indexRowsRemoved).toBe(0);
    expect(nightOne.bookingsPurged).toBe(0);
    expect(app.store.size()).toBe(1);
    expect(app.searchIndex.size()).toBe(1);

    app.searchIndex.available = true;
    const nightTwo = app.sweep.run(app.clock.minuteOfDay() + 480);

    expect(nightTwo.indexRowsDeferred).toBe(0);
    expect(nightTwo.indexRowsRemoved).toBe(1);
    expect(nightTwo.bookingsPurged).toBe(1);
    expect(app.store.size()).toBe(0);
    expect(app.searchIndex.size()).toBe(0);
  });

  it('drops reminders for bookings that have already started', () => {
    const app = newApp();
    app.service.book(aRequest({ start: 9 * 60, end: 10 * 60 }));

    const summary = app.sweep.run(10 * 60);

    expect(summary.remindersDropped).toBe(1);
    expect(app.reminders.size()).toBe(0);
  });
});

describe('reminder dispatch', () => {
  it('queues the mail for a reminder whose minute has arrived', () => {
    const app = newApp();
    const booking = app.service.book(aRequest({ start: 9 * 60, end: 10 * 60 }));

    const sent = app.reminders.dispatchDue(9 * 60 - 30);

    expect(sent).toBe(1);
    expect(app.mailer.queuedMessage(REMINDER_TEMPLATE, booking.id)?.subject).toContain(
      'Starting soon',
    );
    expect(app.reminders.size()).toBe(0);
  });
});

describe('the usage report', () => {
  it('totals bookings, minutes, and revenue by room, and reports an empty day', () => {
    const app = newApp();
    const empty = buildUsageReport(app.store, app.rooms, app.clock.minuteOfDay());
    expect(empty.totalConfirmed).toBe(0);
    expect(empty.busiestRoomId).toBeUndefined();
    expect(empty.rooms).toHaveLength(5);

    app.service.book(aRequest({ start: 540, end: 660 }));
    app.service.book(aRequest({ roomId: 'GHC-4102', start: 540, end: 600, attendees: 4 }));

    const report = buildUsageReport(app.store, app.rooms, app.clock.minuteOfDay());
    expect(report.totalConfirmed).toBe(2);
    expect(report.totalRevenueCents).toBe(8500 + 3000);
    expect(report.busiestRoomId).toBe('WEH-5409');
    expect(formatUsageReport(report)).toContain('Confirmed 2, cancelled 0');
  });
});
