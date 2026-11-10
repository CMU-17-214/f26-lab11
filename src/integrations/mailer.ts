/** One message handed to the campus mail relay. */
export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
  /** The template that produced it, used as part of the outbox key. */
  template: string;
  /** What the message is about, usually a booking id. */
  subjectId: string;
  queuedAtMinute: number;
}

/**
 * The outbound side of the campus mail relay.
 *
 * The relay holds one message per template and subject id. Handing it a second
 * message with the same template and subject id replaces the first, so the
 * outbox never holds two copies of one notice.
 *
 * `sendCount` counts calls to `send` rather than messages in the outbox. It
 * feeds a dashboard tile and the weekly ops summary; nothing in the service
 * reads it.
 */
export class Mailer {
  private readonly outbox = new Map<string, OutboundEmail>();
  private sends = 0;

  send(email: OutboundEmail): void {
    this.sends += 1;
    this.outbox.set(`${email.template}:${email.subjectId}`, { ...email });
  }

  /** Every message queued for delivery, in insertion order. */
  queued(): OutboundEmail[] {
    return [...this.outbox.values()].map((email) => ({ ...email }));
  }

  /** The queued message for one template and subject, if there is one. */
  queuedMessage(template: string, subjectId: string): OutboundEmail | undefined {
    const email = this.outbox.get(`${template}:${subjectId}`);
    return email === undefined ? undefined : { ...email };
  }

  /** How many messages are waiting to go out. */
  size(): number {
    return this.outbox.size;
  }

  /** Presentation only: how many times `send` was called. */
  sendCount(): number {
    return this.sends;
  }
}
