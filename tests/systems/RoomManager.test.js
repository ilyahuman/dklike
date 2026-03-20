import { describe, it, expect, vi } from 'vitest';
import { RoomManager } from '../../src/systems/RoomManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { ROOM_TYPES, EVENTS } from '../../src/constants.js';

describe('RoomManager', () => {
  it('starts with no rooms', () => {
    const rm = new RoomManager(new EventBus());
    expect(rm.getRoomsOfType(ROOM_TYPES.LAIR)).toEqual([]);
  });

  it('placeRoom adds a room and returns id', () => {
    const rm = new RoomManager(new EventBus());
    const id = rm.placeRoom(ROOM_TYPES.LAIR, [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 5 }, { x: 6, y: 6 }]);
    expect(id).toBeGreaterThan(0);
    const rooms = rm.getRoomsOfType(ROOM_TYPES.LAIR);
    expect(rooms.length).toBe(1);
    expect(rooms[0].tiles.length).toBe(4);
  });

  it('getRoomAt returns room for occupied tile', () => {
    const rm = new RoomManager(new EventBus());
    rm.placeRoom(ROOM_TYPES.HATCHERY, [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 11, y: 10 }, { x: 11, y: 11 }]);
    const room = rm.getRoomAt(10, 10);
    expect(room).not.toBeNull();
    expect(room.type).toBe(ROOM_TYPES.HATCHERY);
  });

  it('getRoomAt returns null for empty tile', () => {
    const rm = new RoomManager(new EventBus());
    expect(rm.getRoomAt(99, 99)).toBeNull();
  });

  it('removeRoom clears room and tile lookup', () => {
    const rm = new RoomManager(new EventBus());
    const id = rm.placeRoom(ROOM_TYPES.LAIR, [{ x: 5, y: 5 }]);
    rm.removeRoom(id);
    expect(rm.getRoomAt(5, 5)).toBeNull();
    expect(rm.getRoomsOfType(ROOM_TYPES.LAIR)).toEqual([]);
  });

  it('isRoomTile returns true/false correctly', () => {
    const rm = new RoomManager(new EventBus());
    rm.placeRoom(ROOM_TYPES.TREASURY, [{ x: 3, y: 3 }]);
    expect(rm.isRoomTile(3, 3)).toBe(true);
    expect(rm.isRoomTile(4, 4)).toBe(false);
  });

  it('getTotalTilesOfType counts all tiles for a room type', () => {
    const rm = new RoomManager(new EventBus());
    rm.placeRoom(ROOM_TYPES.TREASURY, [{ x: 1, y: 1 }, { x: 1, y: 2 }]);
    rm.placeRoom(ROOM_TYPES.TREASURY, [{ x: 3, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 3 }]);
    expect(rm.getTotalTilesOfType(ROOM_TYPES.TREASURY)).toBe(5);
  });

  it('getRoomTilesOfType returns all tiles across rooms', () => {
    const rm = new RoomManager(new EventBus());
    rm.placeRoom(ROOM_TYPES.HATCHERY, [{ x: 1, y: 1 }]);
    rm.placeRoom(ROOM_TYPES.HATCHERY, [{ x: 5, y: 5 }]);
    const tiles = rm.getRoomTilesOfType(ROOM_TYPES.HATCHERY);
    expect(tiles.length).toBe(2);
  });

  it('publishes ROOM_PLACED on placeRoom', () => {
    const eventBus = new EventBus();
    const spy = vi.fn();
    eventBus.subscribe(EVENTS.ROOM_PLACED, spy);
    const rm = new RoomManager(eventBus);
    rm.placeRoom(ROOM_TYPES.LAIR, [{ x: 1, y: 1 }]);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: ROOM_TYPES.LAIR }));
  });

  it('publishes ROOM_REMOVED on removeRoom', () => {
    const eventBus = new EventBus();
    const spy = vi.fn();
    eventBus.subscribe(EVENTS.ROOM_REMOVED, spy);
    const rm = new RoomManager(eventBus);
    const id = rm.placeRoom(ROOM_TYPES.LAIR, [{ x: 1, y: 1 }]);
    rm.removeRoom(id);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: ROOM_TYPES.LAIR }));
  });
});
