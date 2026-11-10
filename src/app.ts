import { AuditTrail } from './audit/auditTrail';
import { BOOKING_CANCELLED, BOOKING_CONFIRMED, REFUND_REQUESTED } from './bus/events';
import { InMemoryBus } from './bus/inMemoryBus';
import { EmailConfirmationHandler } from './handlers/emailConfirmationHandler';
import { ReceiptGenerator } from './handlers/receiptGenerator';
import { RefundLedger } from './handlers/refundLedger';
import { ReminderScheduler } from './handlers/reminderScheduler';
import { StatsUpdater } from './handlers/statsUpdater';
import { Mailer } from './integrations/mailer';
import { PaymentGateway } from './integrations/paymentGateway';
import { SearchIndexClient } from './integrations/searchIndexClient';
import { CleanupSweep } from './ops/cleanupSweep';
import { BookingService } from './service/bookingService';
import { InMemoryBookingStore } from './store/inMemoryBookingStore';
import { RoomRegistry } from './store/roomRegistry';
import { SimulatedClock } from './support/clock';
import { SAMPLE_ROOMS } from './support/sampleData';

/** Everything one running copy of the service is made of. */
export interface ReservationApp {
  clock: SimulatedClock;
  rooms: RoomRegistry;
  store: InMemoryBookingStore;
  bus: InMemoryBus;
  searchIndex: SearchIndexClient;
  gateway: PaymentGateway;
  mailer: Mailer;
  audit: AuditTrail;
  ledger: RefundLedger;
  stats: StatsUpdater;
  reminders: ReminderScheduler;
  receipts: ReceiptGenerator;
  sweep: CleanupSweep;
  service: BookingService;
}

/**
 * Builds one running copy of the service: the components, the bus, and the
 * subscriptions.
 *
 * Registration order below is the delivery order. The bus hands a message to
 * subscribers in the order they subscribed, so these calls fix the order for
 * every publish and every redelivery, and a run of a demo today produces the
 * same order as a run tomorrow. Keep the order as written unless a change is
 * what you are demonstrating.
 *
 * The order is:
 *
 * 1. `booking.confirmed`: EmailConfirmationHandler, ReceiptGenerator,
 *    ReminderScheduler, StatsUpdater.
 * 2. `booking.cancelled`: EmailConfirmationHandler, ReminderScheduler,
 *    StatsUpdater.
 * 3. `refund.requested`: RefundLedger.
 *
 * Nothing here starts a thread, a timer, or a worker. Every subscriber runs on
 * the thread that called `publish`.
 */
export function buildReservationApp(): ReservationApp {
  const clock = new SimulatedClock();
  const rooms = new RoomRegistry();
  rooms.registerAll(SAMPLE_ROOMS);

  const store = new InMemoryBookingStore();
  const bus = new InMemoryBus(clock);
  const searchIndex = new SearchIndexClient();
  const gateway = new PaymentGateway(clock);
  const mailer = new Mailer();
  const audit = new AuditTrail();

  const emailConfirmation = new EmailConfirmationHandler(mailer, rooms);
  const receipts = new ReceiptGenerator(rooms, store);
  const reminders = new ReminderScheduler(mailer, rooms, store);
  const stats = new StatsUpdater(store);
  const ledger = new RefundLedger(gateway);

  bus.subscribe(BOOKING_CONFIRMED, emailConfirmation);
  bus.subscribe(BOOKING_CONFIRMED, receipts);
  bus.subscribe(BOOKING_CONFIRMED, reminders);
  bus.subscribe(BOOKING_CONFIRMED, stats);

  bus.subscribe(BOOKING_CANCELLED, emailConfirmation);
  bus.subscribe(BOOKING_CANCELLED, reminders);
  bus.subscribe(BOOKING_CANCELLED, stats);

  bus.subscribe(REFUND_REQUESTED, ledger);

  const sweep = new CleanupSweep(store, reminders, searchIndex, audit);
  const service = new BookingService({ clock, rooms, store, bus, searchIndex, audit });

  return {
    clock,
    rooms,
    store,
    bus,
    searchIndex,
    gateway,
    mailer,
    audit,
    ledger,
    stats,
    reminders,
    receipts,
    sweep,
    service,
  };
}
