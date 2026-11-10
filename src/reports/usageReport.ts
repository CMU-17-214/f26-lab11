import { CLOSING_MINUTE, OPENING_MINUTE } from '../domain/validation';
import { formatRange } from '../domain/booking';
import type { BookingStore } from '../store/bookingStore';
import type { RoomRegistry } from '../store/roomRegistry';
import { formatCents } from '../service/pricing';

/** One room's line in the usage report. */
export interface RoomUsage {
  roomId: string;
  label: string;
  confirmedBookings: number;
  bookedMinutes: number;
  utilisationPercent: number;
  revenueCents: number;
}

/** The whole report for one day. */
export interface UsageReport {
  generatedAtMinute: number;
  openMinutesPerRoom: number;
  totalConfirmed: number;
  totalCancelled: number;
  totalRevenueCents: number;
  busiestRoomId: string | undefined;
  rooms: RoomUsage[];
}

/**
 * Builds the daily usage report the space-planning office reads.
 *
 * The report is a read of the store and the room registry at the moment it is
 * called. Nothing is stored between calls.
 */
export function buildUsageReport(
  store: BookingStore,
  rooms: RoomRegistry,
  atMinute: number,
): UsageReport {
  const openMinutes = CLOSING_MINUTE - OPENING_MINUTE;
  const confirmed = store.withStatus('confirmed');
  const cancelled = store.withStatus('cancelled');

  const lines: RoomUsage[] = rooms.all().map((room) => {
    const held = confirmed.filter((booking) => booking.roomId === room.id);
    const bookedMinutes = held.reduce((sum, booking) => sum + (booking.end - booking.start), 0);
    return {
      roomId: room.id,
      label: `${room.building} ${room.name}`,
      confirmedBookings: held.length,
      bookedMinutes,
      utilisationPercent: Math.round((bookedMinutes / openMinutes) * 100),
      revenueCents: held.reduce((sum, booking) => sum + booking.priceCents, 0),
    };
  });

  const busiest = [...lines].sort((left, right) => right.bookedMinutes - left.bookedMinutes)[0];

  return {
    generatedAtMinute: atMinute,
    openMinutesPerRoom: openMinutes,
    totalConfirmed: confirmed.length,
    totalCancelled: cancelled.length,
    totalRevenueCents: lines.reduce((sum, line) => sum + line.revenueCents, 0),
    busiestRoomId: busiest !== undefined && busiest.bookedMinutes > 0 ? busiest.roomId : undefined,
    rooms: lines,
  };
}

/** The report as the text the office pastes into its weekly note. */
export function formatUsageReport(report: UsageReport): string {
  const header = [
    `Usage report, generated at minute ${report.generatedAtMinute}`,
    `Open window ${formatRange(OPENING_MINUTE, CLOSING_MINUTE)}`,
    `Confirmed ${report.totalConfirmed}, cancelled ${report.totalCancelled}`,
    `Revenue ${formatCents(report.totalRevenueCents)}`,
  ];
  const rows = report.rooms.map(
    (line) =>
      `  ${line.roomId.padEnd(10)} ${String(line.confirmedBookings).padStart(2)} bookings  ` +
      `${String(line.utilisationPercent).padStart(3)}%  ${formatCents(line.revenueCents)}`,
  );
  return [...header, ...rows].join('\n');
}
