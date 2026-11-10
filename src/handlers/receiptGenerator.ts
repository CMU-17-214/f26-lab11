import { formatRange } from '../domain/booking';
import type { BookingConfirmed } from '../bus/events';
import type { Message, Subscriber } from '../bus/inMemoryBus';
import { formatCents } from '../service/pricing';
import type { BookingStore } from '../store/bookingStore';
import type { RoomRegistry } from '../store/roomRegistry';

/** A rendered receipt, ready for the organizer to download. */
export interface Receipt {
  receiptId: string;
  bookingId: string;
  organizer: string;
  amountCents: number;
  lines: string[];
  renderedAtMinute: number;
}

/**
 * Renders the receipt an organizer downloads from the reservations page.
 *
 * Receipts are filed under the booking id, and the receipt id is that booking
 * id with a prefix. Rendering reads the booking's current status from the
 * store and writes nothing when the booking is absent or no longer confirmed.
 * The figures on the receipt come from the message, and writing a receipt for
 * a booking that already has one replaces it.
 */
export class ReceiptGenerator implements Subscriber<BookingConfirmed> {
  readonly name = 'ReceiptGenerator';

  private readonly receipts = new Map<string, Receipt>();
  private readonly rooms: RoomRegistry;
  private readonly store: BookingStore;

  constructor(rooms: RoomRegistry, store: BookingStore) {
    this.rooms = rooms;
    this.store = store;
  }

  handle(message: Message<BookingConfirmed>): void {
    const event = message.payload;
    const booking = this.store.find(event.bookingId);
    if (booking === undefined || booking.status !== 'confirmed') {
      return;
    }
    const room = this.rooms.find(event.roomId);
    const label = room === undefined ? event.roomId : `${room.building} ${room.name}`;
    this.receipts.set(event.bookingId, {
      receiptId: `rcpt-${event.bookingId}`,
      bookingId: event.bookingId,
      organizer: event.organizer,
      amountCents: event.priceCents,
      lines: [
        `Receipt rcpt-${event.bookingId}`,
        `Organizer: ${event.organizer}`,
        `Room: ${label}`,
        `Time: ${formatRange(event.start, event.end)}`,
        `Total: ${formatCents(event.priceCents)}`,
      ],
      renderedAtMinute: message.publishedAtMinute,
    });
  }

  /** The receipt for one booking, if it has been rendered. */
  forBooking(bookingId: string): Receipt | undefined {
    const receipt = this.receipts.get(bookingId);
    return receipt === undefined ? undefined : { ...receipt, lines: [...receipt.lines] };
  }

  size(): number {
    return this.receipts.size;
  }
}
