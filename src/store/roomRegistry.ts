import type { Room } from '../domain/types';

/**
 * The list of rooms the service will book. Rooms are loaded once at startup
 * from the campus space inventory and change rarely, so this is a plain map
 * with no cache and no expiry.
 */
export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();

  register(room: Room): void {
    this.rooms.set(room.id, { ...room });
  }

  registerAll(rooms: readonly Room[]): void {
    for (const room of rooms) {
      this.register(room);
    }
  }

  find(roomId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    return room === undefined ? undefined : { ...room };
  }

  all(): Room[] {
    return [...this.rooms.values()].map((room) => ({ ...room }));
  }

  size(): number {
    return this.rooms.size;
  }
}
