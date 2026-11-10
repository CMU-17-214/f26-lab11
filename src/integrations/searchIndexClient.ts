import { formatRange } from '../domain/booking';
import type { Booking, Room } from '../domain/types';

/** Thrown when the search cluster is not answering. */
export class SearchIndexUnavailableError extends Error {
  constructor() {
    super('search index is unavailable');
    this.name = 'SearchIndexUnavailableError';
  }
}

/** One row in the index, the shape the room-finder page reads. */
export interface IndexedBooking {
  bookingId: string;
  roomId: string;
  organizer: string;
  text: string;
  indexedAtMinute: number;
}

/**
 * The client for the search cluster that backs the room-finder page.
 *
 * This stand-in keeps the index in a map, so the lab needs no cluster. While
 * `available` is false, every call throws `SearchIndexUnavailableError`, which
 * is what the real client does when it cannot reach a node.
 */
export class SearchIndexClient {
  /** Flip to false to simulate an outage on the search cluster. */
  available = true;

  private readonly documents = new Map<string, IndexedBooking>();
  private calls = 0;

  /** Adds or replaces the row for a booking. */
  indexBooking(booking: Booking, room: Room | undefined, atMinute: number): void {
    this.calls += 1;
    this.requireAvailable();
    const where = room === undefined ? booking.roomId : `${room.building} ${room.name}`;
    this.documents.set(booking.id, {
      bookingId: booking.id,
      roomId: booking.roomId,
      organizer: booking.organizer,
      text: `${where} ${formatRange(booking.start, booking.end)} ${booking.organizer}`,
      indexedAtMinute: atMinute,
    });
  }

  /** Drops the row for a booking. */
  removeBooking(bookingId: string): void {
    this.calls += 1;
    this.requireAvailable();
    this.documents.delete(bookingId);
  }

  /** Rows whose text contains the term, in insertion order. */
  search(term: string): IndexedBooking[] {
    this.requireAvailable();
    const needle = term.toLowerCase();
    return [...this.documents.values()].filter((row) => row.text.toLowerCase().includes(needle));
  }

  /** How many rows the index holds. */
  size(): number {
    return this.documents.size;
  }

  private requireAvailable(): void {
    if (!this.available) {
      throw new SearchIndexUnavailableError();
    }
  }
}
