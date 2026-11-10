import { BOOKING_CANCELLED, BOOKING_CONFIRMED } from '../bus/events';
import type { BookingCancelled, BookingConfirmed } from '../bus/events';
import type { Message, Subscriber } from '../bus/inMemoryBus';
import type { Mailer } from '../integrations/mailer';
import {
  CANCELLATION_TEMPLATE,
  CONFIRMATION_TEMPLATE,
  cancellationBody,
  cancellationSubject,
  confirmationBody,
  confirmationSubject,
} from '../integrations/templates';
import type { RoomRegistry } from '../store/roomRegistry';

/**
 * Queues the mail an organizer expects: a confirmation when a booking is made
 * and a release notice when it is cancelled.
 *
 * The handler renders from the payload and hands the message to the relay. It
 * keeps nothing itself, so the mail the organizer has waiting is whatever the
 * relay holds under the template and the booking id.
 */
export class EmailConfirmationHandler implements Subscriber<BookingConfirmed | BookingCancelled> {
  readonly name = 'EmailConfirmationHandler';

  private readonly mailer: Mailer;
  private readonly rooms: RoomRegistry;

  constructor(mailer: Mailer, rooms: RoomRegistry) {
    this.mailer = mailer;
    this.rooms = rooms;
  }

  handle(message: Message<BookingConfirmed | BookingCancelled>): void {
    if (message.type === BOOKING_CONFIRMED) {
      this.sendConfirmation(message.payload as BookingConfirmed, message.publishedAtMinute);
      return;
    }
    if (message.type === BOOKING_CANCELLED) {
      this.sendCancellation(message.payload as BookingCancelled, message.publishedAtMinute);
    }
  }

  private sendConfirmation(event: BookingConfirmed, atMinute: number): void {
    this.mailer.send({
      to: event.organizerEmail,
      subject: confirmationSubject(event),
      body: confirmationBody(event, this.roomLabel(event.roomId)),
      template: CONFIRMATION_TEMPLATE,
      subjectId: event.bookingId,
      queuedAtMinute: atMinute,
    });
  }

  private sendCancellation(event: BookingCancelled, atMinute: number): void {
    this.mailer.send({
      to: event.organizerEmail,
      subject: cancellationSubject(event),
      body: cancellationBody(event, this.roomLabel(event.roomId)),
      template: CANCELLATION_TEMPLATE,
      subjectId: event.bookingId,
      queuedAtMinute: atMinute,
    });
  }

  private roomLabel(roomId: string): string {
    const room = this.rooms.find(roomId);
    return room === undefined ? roomId : `${room.building} ${room.name}`;
  }
}
