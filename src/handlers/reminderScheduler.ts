import { BOOKING_CANCELLED, BOOKING_CONFIRMED } from '../bus/events';
import type { BookingCancelled, BookingConfirmed } from '../bus/events';
import type { Message, Subscriber } from '../bus/inMemoryBus';
import type { Mailer } from '../integrations/mailer';
import { REMINDER_TEMPLATE, reminderBody, reminderSubject } from '../integrations/templates';
import type { BookingStore } from '../store/bookingStore';
import type { RoomRegistry } from '../store/roomRegistry';

/** How long before the start minute an organizer is reminded. */
export const REMINDER_LEAD_MINUTES = 30;

/** A reminder waiting for its minute to arrive. */
export interface ScheduledReminder {
  bookingId: string;
  organizer: string;
  organizerEmail: string;
  roomId: string;
  dueAtMinute: number;
  start: number;
  end: number;
}

/**
 * Holds the reminder an organizer gets half an hour before a booking starts,
 * and drops it again when the booking is cancelled.
 *
 * The schedule is a map keyed by booking id, so writing the reminder for a
 * booking that already has one replaces it. Scheduling reads the booking's
 * current status from the store and writes nothing when the booking is absent
 * or no longer confirmed. Nothing here fires on a timer: `due` returns the
 * reminders whose minute has arrived, and `dispatchDue` queues their mail and
 * takes them off the schedule.
 */
export class ReminderScheduler implements Subscriber<BookingConfirmed | BookingCancelled> {
  readonly name = 'ReminderScheduler';

  private readonly reminders = new Map<string, ScheduledReminder>();
  private readonly mailer: Mailer;
  private readonly rooms: RoomRegistry;
  private readonly store: BookingStore;

  constructor(mailer: Mailer, rooms: RoomRegistry, store: BookingStore) {
    this.mailer = mailer;
    this.rooms = rooms;
    this.store = store;
  }

  handle(message: Message<BookingConfirmed | BookingCancelled>): void {
    if (message.type === BOOKING_CONFIRMED) {
      const event = message.payload as BookingConfirmed;
      const booking = this.store.find(event.bookingId);
      if (booking === undefined || booking.status !== 'confirmed') {
        return;
      }
      this.reminders.set(event.bookingId, {
        bookingId: event.bookingId,
        organizer: event.organizer,
        organizerEmail: event.organizerEmail,
        roomId: event.roomId,
        dueAtMinute: event.start - REMINDER_LEAD_MINUTES,
        start: event.start,
        end: event.end,
      });
      return;
    }
    if (message.type === BOOKING_CANCELLED) {
      const event = message.payload as BookingCancelled;
      this.reminders.delete(event.bookingId);
    }
  }

  /** Takes one reminder off the schedule. Returns true when there was one. */
  drop(bookingId: string): boolean {
    return this.reminders.delete(bookingId);
  }

  /** Reminders on the schedule, in insertion order. */
  scheduled(): ScheduledReminder[] {
    return [...this.reminders.values()].map((reminder) => ({ ...reminder }));
  }

  /** The reminder for one booking, if there is one. */
  scheduledFor(bookingId: string): ScheduledReminder | undefined {
    const reminder = this.reminders.get(bookingId);
    return reminder === undefined ? undefined : { ...reminder };
  }

  /** Reminders whose minute has arrived. */
  due(atMinute: number): ScheduledReminder[] {
    return this.scheduled().filter((reminder) => reminder.dueAtMinute <= atMinute);
  }

  /**
   * Queues the mail for every reminder that is due and takes it off the
   * schedule. Returns how many went out.
   */
  dispatchDue(atMinute: number): number {
    const ready = this.due(atMinute);
    for (const reminder of ready) {
      const room = this.rooms.find(reminder.roomId);
      const label = room === undefined ? reminder.roomId : `${room.building} ${room.name}`;
      const asEvent: BookingConfirmed = {
        bookingId: reminder.bookingId,
        roomId: reminder.roomId,
        organizer: reminder.organizer,
        organizerEmail: reminder.organizerEmail,
        start: reminder.start,
        end: reminder.end,
        priceCents: 0,
        confirmedAtMinute: atMinute,
      };
      this.mailer.send({
        to: reminder.organizerEmail,
        subject: reminderSubject(asEvent),
        body: reminderBody(asEvent, label, REMINDER_LEAD_MINUTES),
        template: REMINDER_TEMPLATE,
        subjectId: reminder.bookingId,
        queuedAtMinute: atMinute,
      });
      this.reminders.delete(reminder.bookingId);
    }
    return ready.length;
  }

  size(): number {
    return this.reminders.size;
  }
}
