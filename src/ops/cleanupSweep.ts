import type { AuditTrail } from '../audit/auditTrail';
import type { BookingStore } from '../store/bookingStore';
import type { ReminderScheduler } from '../handlers/reminderScheduler';
import { SearchIndexUnavailableError } from '../integrations/searchIndexClient';
import type { SearchIndexClient } from '../integrations/searchIndexClient';

/** A cancelled booking is kept this long before the sweep files it away. */
export const CANCELLED_RETENTION_MINUTES = 180;

/** What one run of the sweep did. */
export interface SweepSummary {
  ranAtMinute: number;
  bookingsPurged: number;
  remindersDropped: number;
  indexRowsRemoved: number;
  /** Index rows the cluster would not take. Their bookings stay in the store. */
  indexRowsDeferred: number;
}

/**
 * The nightly housekeeping job, run from the scheduler after the buildings
 * close.
 *
 * For each cancelled booking past the retention window, the sweep removes the
 * search index row and then drops the booking from the store. When the index
 * removal throws because the cluster is unavailable, the sweep counts the row
 * as deferred and leaves the booking in the store for the next run.
 *
 * It also drops reminders for bookings that have already started, and writes
 * one audit record per run.
 */
export class CleanupSweep {
  private readonly store: BookingStore;
  private readonly reminders: ReminderScheduler;
  private readonly searchIndex: SearchIndexClient;
  private readonly audit: AuditTrail;

  constructor(
    store: BookingStore,
    reminders: ReminderScheduler,
    searchIndex: SearchIndexClient,
    audit: AuditTrail,
  ) {
    this.store = store;
    this.reminders = reminders;
    this.searchIndex = searchIndex;
    this.audit = audit;
  }

  run(atMinute: number, retentionMinutes = CANCELLED_RETENTION_MINUTES): SweepSummary {
    let bookingsPurged = 0;
    let indexRowsRemoved = 0;
    let indexRowsDeferred = 0;

    for (const booking of this.store.withStatus('cancelled')) {
      const cancelledAt = booking.cancelledAtMinute ?? booking.createdAtMinute;
      if (atMinute - cancelledAt < retentionMinutes) {
        continue;
      }
      try {
        this.searchIndex.removeBooking(booking.id);
        indexRowsRemoved += 1;
      } catch (error) {
        if (!(error instanceof SearchIndexUnavailableError)) {
          throw error;
        }
        indexRowsDeferred += 1;
        continue;
      }
      this.store.remove(booking.id);
      bookingsPurged += 1;
    }

    let remindersDropped = 0;
    for (const reminder of this.reminders.scheduled()) {
      if (reminder.start <= atMinute && this.reminders.drop(reminder.bookingId)) {
        remindersDropped += 1;
      }
    }

    const summary: SweepSummary = {
      ranAtMinute: atMinute,
      bookingsPurged,
      remindersDropped,
      indexRowsRemoved,
      indexRowsDeferred,
    };
    this.audit.record(
      'sweep.completed',
      'nightly-sweep',
      'scheduler',
      `purged ${bookingsPurged}, reminders ${remindersDropped}, ` +
        `index removed ${indexRowsRemoved}, index deferred ${indexRowsDeferred}`,
      atMinute,
    );
    return summary;
  }
}
