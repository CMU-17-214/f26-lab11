import type { BookingRequest, Room } from '../domain/types';

/**
 * The rooms the demos and the tests book. This is a trimmed copy of the campus
 * space inventory: five rooms across three buildings, with the rates the
 * pricing rules were written against.
 */
export const SAMPLE_ROOMS: readonly Room[] = [
  {
    id: 'WEH-5409',
    name: '5409',
    building: 'Wean Hall',
    capacity: 12,
    hourlyRateCents: 4000,
    projector: true,
  },
  {
    id: 'WEH-5302',
    name: '5302',
    building: 'Wean Hall',
    capacity: 6,
    hourlyRateCents: 2500,
    projector: false,
  },
  {
    id: 'GHC-4301',
    name: '4301',
    building: 'Gates Center',
    capacity: 30,
    hourlyRateCents: 7500,
    projector: true,
  },
  {
    id: 'GHC-4102',
    name: '4102',
    building: 'Gates Center',
    capacity: 8,
    hourlyRateCents: 3000,
    projector: false,
  },
  {
    id: 'POS-146',
    name: '146',
    building: 'Posner Hall',
    capacity: 20,
    hourlyRateCents: 5500,
    projector: true,
  },
];

/** A request that passes validation, with any field overridden. */
export function sampleRequest(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    roomId: 'WEH-5409',
    organizer: 'H. Ahmad',
    organizerEmail: 'hahmad@example.edu',
    attendees: 6,
    start: 9 * 60,
    end: 11 * 60,
    purpose: 'project checkpoint',
    ...overrides,
  };
}
