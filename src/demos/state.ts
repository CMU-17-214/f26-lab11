import type { ReservationApp } from '../app';
import { formatCents } from '../service/pricing';

/**
 * Prints the parts of the system a refund touches: the ledger, the payment
 * provider, and the bus. Both demos call this before and after the step they
 * are demonstrating, so the two printouts can be compared line by line and
 * pasted into the worksheet.
 */
export function printRefundState(app: ReservationApp, heading: string): void {
  console.log(`\n=== ${heading} ===`);

  console.log(`ledger entries: ${app.ledger.size()}`);
  for (const entry of app.ledger.all()) {
    console.log(
      `  ${entry.entryId} ${entry.bookingId} ${formatCents(entry.amountCents)} (${entry.reason})`,
    );
  }

  console.log(`gateway calls: ${app.gateway.callCount()}`);
  console.log(`gateway settlements: ${app.gateway.settled().length}`);
  for (const settlement of app.gateway.settled()) {
    console.log(
      `  ${settlement.settlementId} ${settlement.bookingId} ${formatCents(settlement.amountCents)}`,
    );
  }
  console.log(`money returned in total: ${formatCents(app.gateway.totalSettledCents())}`);

  console.log(`dead letters: ${app.bus.deadLetters().length}`);
  for (const deadLetter of app.bus.deadLetters()) {
    console.log(
      `  ${deadLetter.message.id} ${deadLetter.message.type} ` +
        `attempt ${deadLetter.attempt} in ${deadLetter.subscriberName}: ${deadLetter.reason}`,
    );
    console.log(`    failedAtMinute: ${deadLetter.failedAtMinute}`);
    console.log(`    payload: ${JSON.stringify(deadLetter.message.payload)}`);
  }
}

/** Prints the bus log: every message ever published, with its delivery count. */
export function printMessageLog(app: ReservationApp): void {
  console.log('\n=== bus log ===');
  for (const message of app.bus.messages()) {
    console.log(
      `  ${message.id} ${message.type} deliveries=${app.bus.deliveryCount(message.id)}`,
    );
  }
}
