import { buildReservationApp } from '../app';
import { sampleRequest } from '../support/sampleData';
import { printMessageLog, printRefundState } from './state';

/**
 * The replay button, pressed once.
 *
 * The run books a room, cancels it, and then hands the refund message to the
 * bus a second time with `redeliver`. That is what an operator does after a
 * delivery they are not sure about, and what a broker does on its own when it
 * does not hear that a delivery succeeded.
 *
 * Run it with `npm run demo:replay`. Write your prediction in EVENTS.md
 * before you run it.
 */
function main(): void {
  const app = buildReservationApp();

  const booking = app.service.book(sampleRequest({ start: 11 * 60, end: 13 * 60 }));
  console.log(`booked ${booking.id} for ${booking.priceCents} cents`);

  const cancellation = app.service.cancel(booking.id);
  console.log(
    `cancelled ${booking.id}, refund ${cancellation.refundCents} cents, ` +
      `refund message ${cancellation.refundMessageId}`,
  );

  printRefundState(app, 'after the cancellation (one delivery of the refund message)');

  const messageId = cancellation.refundMessageId;
  if (messageId === undefined) {
    throw new Error('this cancellation owed no refund, so there is no message to replay');
  }

  console.log(`\nredelivering ${messageId}`);
  app.bus.redeliver(messageId);

  printRefundState(app, 'after one redelivery');

  console.log(`\nredelivering ${messageId} again`);
  app.bus.redeliver(messageId);

  printRefundState(app, 'after two redeliveries');
  printMessageLog(app);
}

main();
