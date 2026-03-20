import { EVENTS } from '../constants.js';

/**
 * Manages placed rooms. Each room is a set of tile positions + type.
 * Provides spatial lookup: tile → room.
 * Single source of truth for room existence and layout.
 */
export class RoomManager {
  /** @param {import('../core/EventBus.js').EventBus} eventBus */
  constructor(eventBus) {
    this._eventBus = eventBus;
    /** @type {Map<number, {id: number, type: string, tiles: {x:number,y:number}[]}>} */
    this._rooms = new Map();
    /** @type {Map<string, number>} "x,y" → roomId */
    this._tileToRoom = new Map();
    this._nextId = 1;
  }

  placeRoom(type, tiles) {
    const id = this._nextId++;
    const room = { id, type, tiles: tiles.map(t => ({ x: t.x, y: t.y })), placedAt: performance.now() };
    this._rooms.set(id, room);
    for (const t of room.tiles) {
      this._tileToRoom.set(`${t.x},${t.y}`, id);
    }
    this._eventBus.publish(EVENTS.ROOM_PLACED, { roomId: id, type, tiles: room.tiles });
    return id;
  }

  removeRoom(roomId) {
    const room = this._rooms.get(roomId);
    if (!room) return;
    for (const t of room.tiles) {
      this._tileToRoom.delete(`${t.x},${t.y}`);
    }
    this._rooms.delete(roomId);
    this._eventBus.publish(EVENTS.ROOM_REMOVED, { roomId, type: room.type, tiles: room.tiles });
  }

  getRoomAt(x, y) {
    const id = this._tileToRoom.get(`${x},${y}`);
    if (id === undefined) return null;
    return this._rooms.get(id) || null;
  }

  getRoomsOfType(type) {
    const result = [];
    for (const room of this._rooms.values()) {
      if (room.type === type) result.push(room);
    }
    return result;
  }

  getRoomTilesOfType(type) {
    const tiles = [];
    for (const room of this._rooms.values()) {
      if (room.type === type) {
        for (const t of room.tiles) tiles.push(t);
      }
    }
    return tiles;
  }

  getTotalTilesOfType(type) {
    let count = 0;
    for (const room of this._rooms.values()) {
      if (room.type === type) count += room.tiles.length;
    }
    return count;
  }

  isRoomTile(x, y) {
    return this._tileToRoom.has(`${x},${y}`);
  }
}
