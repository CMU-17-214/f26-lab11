/**
 * The service reads the time through this interface so that every test and
 * every demo gets the same timestamps on every run. Nothing in this codebase
 * calls `Date.now()`.
 */
export interface Clock {
  /** Minutes from midnight on the booking day. */
  minuteOfDay(): number;
}

/**
 * A clock that only moves when someone calls `advance`. The default start is
 * 08:00, which is before the opening minute so that a booking made at the
 * start of a run is always made in advance.
 */
export class SimulatedClock implements Clock {
  private minute: number;

  constructor(startMinute = 8 * 60) {
    this.minute = startMinute;
  }

  minuteOfDay(): number {
    return this.minute;
  }

  /** Moves the clock forward. Negative steps are rejected. */
  advance(minutes: number): void {
    if (minutes < 0) {
      throw new Error('the clock does not run backwards');
    }
    this.minute += minutes;
  }

  /** Jumps to a specific minute of the day. */
  set(minute: number): void {
    this.minute = minute;
  }
}
