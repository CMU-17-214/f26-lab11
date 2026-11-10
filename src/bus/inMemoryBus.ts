import type { Clock } from '../support/clock';

/**
 * One entry in the bus log. A message is created once, at publish time, and
 * never changes afterwards: redelivering a message hands subscribers the same
 * object with the same id.
 */
export interface Message<T = unknown> {
  readonly id: string;
  readonly type: string;
  readonly payload: T;
  readonly publishedAtMinute: number;
}

/**
 * Something that reacts to a message. `name` shows up in the dead-letter list
 * and in the delivery log, so give it the name of the component.
 */
export interface Subscriber<T = unknown> {
  readonly name: string;
  handle(message: Message<T>): void;
}

/** A delivery that threw, kept so a human can look at it later. */
export interface DeadLetter {
  readonly message: Message;
  readonly subscriberName: string;
  readonly reason: string;
  /** Which delivery attempt of this message failed. The first is 1. */
  readonly attempt: number;
  readonly failedAtMinute: number;
}

/**
 * The message bus this service runs on.
 *
 * Delivery contract, stated plainly because handlers have to be written
 * against what the bus actually promises:
 *
 * - **Delivery is at least once.** `publish` delivers a message to every
 *   subscriber registered for its type. `redeliver` hands the same message,
 *   with the same id, to those same subscribers again. The bus keeps no record
 *   of which messages a subscriber has already seen and drops nothing, so a
 *   subscriber can see the same message id any number of times. A subscriber
 *   that must not repeat its effect has to arrange that itself.
 * - **Delivery is synchronous and single threaded.** `publish` calls each
 *   subscriber in turn on the calling thread and returns after the last one.
 *   There is no queue, no worker, no timer, and no thread anywhere in this
 *   codebase, so no two handlers ever run at the same time and every run of a
 *   demo produces the same order.
 * - **Order is registration order.** Subscribers receive a message in the
 *   order they subscribed, and that order is fixed where the handlers are
 *   registered.
 * - **A throwing subscriber does not stop the others.** If a handler throws,
 *   the bus records a dead letter naming that handler and continues with the
 *   next subscriber. `publish` itself does not throw, so the caller that
 *   published the event is not affected by a handler that failed.
 * - **The dead-letter list is a log of failed deliveries, not a queue.**
 *   Nothing retries on its own. One entry records one delivery that threw.
 *   `redeliver` does not read the list and removes nothing from it, and a
 *   redelivery that throws again appends another entry for the same message.
 */
export class InMemoryBus {
  private readonly subscribers = new Map<string, Subscriber<unknown>[]>();
  private readonly log: Message[] = [];
  private readonly byId = new Map<string, Message>();
  private readonly failures: DeadLetter[] = [];
  private readonly attempts = new Map<string, number>();
  private readonly clock: Clock;
  private nextMessageNumber = 1;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  /**
   * Registers a subscriber for one event type. Subscribing the same
   * subscriber twice makes it receive every message twice; the bus does not
   * check for that.
   */
  subscribe<T>(type: string, subscriber: Subscriber<T>): void {
    const existing = this.subscribers.get(type);
    const list = existing ?? [];
    list.push(subscriber as Subscriber<unknown>);
    this.subscribers.set(type, list);
  }

  /**
   * Appends a message to the log and delivers it once to every subscriber for
   * its type. Returns the message so the caller can keep its id.
   */
  publish<T>(type: string, payload: T): Message<T> {
    const message: Message<T> = {
      id: `msg-${this.nextMessageNumber}`,
      type,
      payload,
      publishedAtMinute: this.clock.minuteOfDay(),
    };
    this.nextMessageNumber += 1;
    this.log.push(message);
    this.byId.set(message.id, message);
    this.deliver(message);
    return message;
  }

  /**
   * Delivers a message from the log again, to the same subscribers, with the
   * same id. This is the replay button: it is what an operator presses after a
   * failed delivery, and it is what a real broker does on its own when it does
   * not hear that a delivery succeeded.
   */
  redeliver(messageId: string): void {
    const message = this.byId.get(messageId);
    if (message === undefined) {
      throw new Error(`no message with id ${messageId}`);
    }
    this.deliver(message);
  }

  /** Every message ever published, in publication order. */
  messages(): readonly Message[] {
    return [...this.log];
  }

  /** One message by id, or undefined when the log never held it. */
  message(messageId: string): Message | undefined {
    return this.byId.get(messageId);
  }

  /** Messages of one type, in publication order. */
  messagesOfType(type: string): readonly Message[] {
    return this.log.filter((message) => message.type === type);
  }

  /** How many times this message has been handed to subscribers. */
  deliveryCount(messageId: string): number {
    return this.attempts.get(messageId) ?? 0;
  }

  /**
   * Deliveries that threw, oldest first. Each entry keeps the whole message,
   * so a human reading this list can see the id and the payload of the work
   * that did not finish.
   */
  deadLetters(): readonly DeadLetter[] {
    return [...this.failures];
  }

  private deliver(message: Message): void {
    const attempt = this.deliveryCount(message.id) + 1;
    this.attempts.set(message.id, attempt);
    const list = this.subscribers.get(message.type) ?? [];
    for (const subscriber of list) {
      try {
        subscriber.handle(message);
      } catch (error) {
        this.failures.push({
          message,
          subscriberName: subscriber.name,
          reason: error instanceof Error ? error.message : String(error),
          attempt,
          failedAtMinute: this.clock.minuteOfDay(),
        });
      }
    }
  }
}
