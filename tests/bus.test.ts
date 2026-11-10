import { describe, expect, it } from 'vitest';
import { REFUND_REQUESTED } from '../src/bus/events';
import { InMemoryBus } from '../src/bus/inMemoryBus';
import type { Message, Subscriber } from '../src/bus/inMemoryBus';
import { SimulatedClock } from '../src/support/clock';
import { aBookingWithRefund, newApp } from './fixtures';

/** A subscriber that writes down what it was handed. */
class Recorder implements Subscriber<{ note: string }> {
  readonly seen: string[] = [];

  constructor(readonly name: string) {}

  handle(message: Message<{ note: string }>): void {
    this.seen.push(`${message.id}:${message.payload.note}`);
  }
}

/** A subscriber that always throws. */
class Breaker implements Subscriber<unknown> {
  readonly name = 'Breaker';

  handle(): void {
    throw new Error('this subscriber is broken');
  }
}

function newBus(): InMemoryBus {
  return new InMemoryBus(new SimulatedClock());
}

describe('the bus', () => {
  it('delivers a message to every subscriber for its type and nobody else', () => {
    const bus = newBus();
    const first = new Recorder('first');
    const second = new Recorder('second');
    const other = new Recorder('other');
    bus.subscribe('note.written', first);
    bus.subscribe('note.written', second);
    bus.subscribe('note.deleted', other);

    bus.publish('note.written', { note: 'hello' });

    expect(first.seen).toEqual(['msg-1:hello']);
    expect(second.seen).toEqual(['msg-1:hello']);
    expect(other.seen).toEqual([]);
  });

  it('delivers in registration order', () => {
    const bus = newBus();
    const order: string[] = [];
    const makeSubscriber = (name: string): Subscriber<unknown> => ({
      name,
      handle: () => {
        order.push(name);
      },
    });
    bus.subscribe('note.written', makeSubscriber('a'));
    bus.subscribe('note.written', makeSubscriber('b'));
    bus.subscribe('note.written', makeSubscriber('c'));

    bus.publish('note.written', { note: 'hello' });

    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('keeps every message in the log with an id', () => {
    const bus = newBus();
    const first = bus.publish('note.written', { note: 'one' });
    const second = bus.publish('note.deleted', { note: 'two' });

    expect(bus.messages().map((message) => message.id)).toEqual([first.id, second.id]);
    expect(bus.message(first.id)?.payload).toEqual({ note: 'one' });
    expect(bus.messagesOfType('note.deleted')).toHaveLength(1);
  });

  it('hands the same message to the same subscribers again on redeliver', () => {
    const bus = newBus();
    const listener = new Recorder('listener');
    bus.subscribe('note.written', listener);
    const message = bus.publish('note.written', { note: 'hello' });

    bus.redeliver(message.id);

    expect(listener.seen).toEqual(['msg-1:hello', 'msg-1:hello']);
    expect(bus.deliveryCount(message.id)).toBe(2);
  });

  it('refuses to redeliver an id the log never held', () => {
    const bus = newBus();
    expect(() => bus.redeliver('msg-404')).toThrow('no message with id msg-404');
  });

  it('dead-letters a delivery that throws, carries on, and does not throw out of publish', () => {
    const bus = newBus();
    const after = new Recorder('after');
    bus.subscribe('note.written', new Breaker());
    bus.subscribe('note.written', after);

    let message: Message | undefined;
    expect(() => {
      message = bus.publish('note.written', { note: 'hello' });
    }).not.toThrow();

    expect(after.seen).toEqual(['msg-1:hello']);
    expect(bus.deadLetters()).toHaveLength(1);
    expect(bus.deadLetters()[0]).toMatchObject({
      subscriberName: 'Breaker',
      reason: 'this subscriber is broken',
      attempt: 1,
    });
    expect(bus.deadLetters()[0].message.id).toBe(message?.id);
  });
});

describe('a delivery that throws inside the running service', () => {
  it('lands the message in the dead-letter list with its id, its type, and its payload', () => {
    const app = newApp();
    app.gateway.failOnCall(1);
    const booking = aBookingWithRefund(app);

    const cancellation = app.service.cancel(booking.id);

    const deadLetters = app.bus.deadLetters();
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0].message.id).toBe(cancellation.refundMessageId);
    expect(deadLetters[0].message.type).toBe(REFUND_REQUESTED);
    expect(deadLetters[0].attempt).toBe(1);
    expect(deadLetters[0].reason).toContain('payment provider');
    expect(deadLetters[0].message.payload).toMatchObject({
      bookingId: booking.id,
      amountCents: cancellation.refundCents,
    });
  });
});
