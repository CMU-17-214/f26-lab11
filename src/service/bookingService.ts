import type { AuditTrail } from '../audit/auditTrail';
import { BOOKING_CANCELLED, BOOKING_CONFIRMED, REFUND_REQUESTED } from '../bus/events';
import type { BookingCancelled, BookingConfirmed, RefundRequested } from '../bus/events';
import type { InMemoryBus } from '../bus/inMemoryBus';
import { describeBooking } from '../domain/booking';
import type { Booking, BookingRequest, Cancellation, FreeSlot } from '../domain/types';
import { validateRequest } from '../domain/validation';
import type { SearchIndexClient } from '../integrations/searchIndexClient';
import type { BookingStore } from '../store/bookingStore';
import type { RoomRegistry } from '../store/roomRegistry';
import type { Clock } from '../support/clock';
import { conflictingBooking, freeSlotsForRoom } from './availability';
import { priceRequest, refundFor } from './pricing';

/** Raised when a request cannot become a booking, or a booking cannot change. */
export class BookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingError';
  }
}

/** Everything the service needs handed to it at startup. */
export interface BookingServiceDeps {
  clock: Clock;
  rooms: RoomRegistry;
  store: BookingStore;
  bus: InMemoryBus;
  searchIndex: SearchIndexClient;
  audit: AuditTrail;
}

/**
 * The API the reservations page and the front-desk kiosk call.
 *
 * The service owns the booking rules: it validates a request, checks the room
 * is free, prices the booking, and writes it. It also publishes events on the
 * bus. The list of subscribers is in `app.ts`.
 */
export class BookingService {
  private readonly clock: Clock;
  private readonly rooms: RoomRegistry;
  private readonly store: BookingStore;
  private readonly bus: InMemoryBus;
  private readonly searchIndex: SearchIndexClient;
  private readonly audit: AuditTrail;
  private nextBookingNumber = 1001;

  constructor(deps: BookingServiceDeps) {
    this.clock = deps.clock;
    this.rooms = deps.rooms;
    this.store = deps.store;
    this.bus = deps.bus;
    this.searchIndex = deps.searchIndex;
    this.audit = deps.audit;
  }

  /**
   * Holds a room for a range and returns the booking.
   *
   * Throws `BookingError` when the request breaks a booking rule or the room
   * is already held for part of the range.
   */
  book(request: BookingRequest): Booking {
    const room = this.rooms.find(request.roomId);
    const validation = validateRequest(request, room);
    if (!validation.valid || room === undefined) {
      throw new BookingError(validation.reason ?? `unknown room ${request.roomId}`);
    }

    const clash = conflictingBooking(this.store.all(), request.roomId, request.start, request.end);
    if (clash !== undefined) {
      throw new BookingError(
        `${request.roomId} is already held by ${clash.organizer} for part of that range`,
      );
    }

    const now = this.clock.minuteOfDay();
    const booking: Booking = {
      id: `bk-${this.nextBookingNumber}`,
      roomId: request.roomId,
      organizer: request.organizer,
      organizerEmail: request.organizerEmail,
      attendees: request.attendees,
      start: request.start,
      end: request.end,
      status: 'confirmed',
      priceCents: priceRequest(request, room),
      purpose: request.purpose,
      createdAtMinute: now,
    };
    this.nextBookingNumber += 1;

    this.searchIndex.indexBooking(booking, room, now);
    this.store.save(booking);
    this.audit.record(
      'booking.created',
      booking.id,
      booking.organizer,
      describeBooking(booking, room),
      now,
    );

    const event: BookingConfirmed = {
      bookingId: booking.id,
      roomId: booking.roomId,
      organizer: booking.organizer,
      organizerEmail: booking.organizerEmail,
      start: booking.start,
      end: booking.end,
      priceCents: booking.priceCents,
      confirmedAtMinute: now,
    };
    this.bus.publish(BOOKING_CONFIRMED, event);
    return { ...booking };
  }

  /**
   * Releases a booking and works out what the organizer is owed. The refund
   * itself is booked and paid by whoever subscribes to the refund event.
   *
   * Throws `BookingError` for an unknown booking or one that is already
   * cancelled.
   */
  cancel(bookingId: string): Cancellation {
    const existing = this.store.find(bookingId);
    if (existing === undefined) {
      throw new BookingError(`unknown booking ${bookingId}`);
    }
    if (existing.status === 'cancelled') {
      throw new BookingError(`${bookingId} was already cancelled`);
    }

    const now = this.clock.minuteOfDay();
    const cancelled: Booking = { ...existing, status: 'cancelled', cancelledAtMinute: now };
    this.store.save(cancelled);
    this.audit.record(
      'booking.cancelled',
      cancelled.id,
      cancelled.organizer,
      describeBooking(cancelled, this.rooms.find(cancelled.roomId)),
      now,
    );

    const cancelledEvent: BookingCancelled = {
      bookingId: cancelled.id,
      roomId: cancelled.roomId,
      organizer: cancelled.organizer,
      organizerEmail: cancelled.organizerEmail,
      start: cancelled.start,
      end: cancelled.end,
      cancelledAtMinute: now,
    };
    this.bus.publish(BOOKING_CANCELLED, cancelledEvent);

    const refund = refundFor(cancelled, now);
    if (refund.cents <= 0) {
      return { booking: cancelled, refundCents: 0, refundReason: refund.reason };
    }

    const refundEvent: RefundRequested = {
      bookingId: cancelled.id,
      organizer: cancelled.organizer,
      organizerEmail: cancelled.organizerEmail,
      amountCents: refund.cents,
      reason: refund.reason,
      requestedAtMinute: now,
    };
    const message = this.bus.publish(REFUND_REQUESTED, refundEvent);
    this.audit.record(
      'refund.requested',
      cancelled.id,
      cancelled.organizer,
      `${refund.cents} cents, message ${message.id}`,
      now,
    );
    return {
      booking: cancelled,
      refundCents: refund.cents,
      refundReason: refund.reason,
      refundMessageId: message.id,
    };
  }

  /** What a request would cost, without holding anything. */
  quote(request: BookingRequest): number {
    const room = this.rooms.find(request.roomId);
    if (room === undefined) {
      throw new BookingError(`unknown room ${request.roomId}`);
    }
    return priceRequest(request, room);
  }

  /** One booking by id. */
  get(bookingId: string): Booking | undefined {
    return this.store.find(bookingId);
  }

  /** Every booking for one room, in the order they were made. */
  listForRoom(roomId: string): Booking[] {
    return this.store.forRoom(roomId);
  }

  /** The bookable windows left on a room's day. */
  freeSlots(roomId: string): FreeSlot[] {
    return freeSlotsForRoom(roomId, this.store.all());
  }
}
