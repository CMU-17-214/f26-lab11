import type { Clock } from '../support/clock';

/** Thrown when the payment provider refuses or drops a call. */
export class PaymentGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}

/** A refund the provider accepted and settled. */
export interface RefundSettlement {
  settlementId: string;
  bookingId: string;
  amountCents: number;
  settledAtMinute: number;
}

/**
 * The client for the payment provider that moves the money.
 *
 * This stand-in settles instantly and keeps the settlements in a list. It is
 * the one component here that can fail on demand: `failOnCall(n)` makes the
 * nth call to `refund` throw and leaves every other call alone, so a run that
 * needs a downstream failure gets exactly one, at a known point, on every run.
 */
export class PaymentGateway {
  private readonly settlements: RefundSettlement[] = [];
  private readonly clock: Clock;
  private calls = 0;
  private failAtCall: number | undefined;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  /**
   * Arms a failure. Call number `n` to `refund` throws, counting every call
   * since this gateway was created. Calls before and after n behave normally,
   * so the provider heals by itself once the armed call is past.
   */
  failOnCall(n: number): void {
    if (n < 1) {
      throw new Error('call numbers start at 1');
    }
    this.failAtCall = n;
  }

  /**
   * Sends money back for a booking. Throws `PaymentGatewayError` when this is
   * the armed call, before anything is settled.
   */
  refund(bookingId: string, amountCents: number): RefundSettlement {
    this.calls += 1;
    if (this.calls === this.failAtCall) {
      throw new PaymentGatewayError(
        `payment provider did not answer on call ${this.calls} for ${bookingId}`,
      );
    }
    if (amountCents <= 0) {
      throw new PaymentGatewayError(`refund amount for ${bookingId} has to be positive`);
    }
    const settlement: RefundSettlement = {
      settlementId: `stl-${this.settlements.length + 1}`,
      bookingId,
      amountCents,
      settledAtMinute: this.clock.minuteOfDay(),
    };
    this.settlements.push(settlement);
    return settlement;
  }

  /** Every settlement the provider accepted, oldest first. */
  settled(): readonly RefundSettlement[] {
    return [...this.settlements];
  }

  /** Settlements for one booking. */
  settledFor(bookingId: string): readonly RefundSettlement[] {
    return this.settlements.filter((settlement) => settlement.bookingId === bookingId);
  }

  /** How much money has gone back to organizers, in cents. */
  totalSettledCents(): number {
    return this.settlements.reduce((sum, settlement) => sum + settlement.amountCents, 0);
  }

  /** How many calls `refund` has taken, including the ones that threw. */
  callCount(): number {
    return this.calls;
  }
}
