/**
 * Simple publish/subscribe event bus.
 * All cross-system communication flows through EventBus —
 * systems never import each other directly.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event - Event name (use EVENTS constants).
   * @param {Function} callback - Called with event data when published.
   */
  subscribe(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event - Event name.
   * @param {Function} callback - The previously subscribed callback.
   */
  unsubscribe(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Publish an event to all subscribers.
   * @param {string} event - Event name.
   * @param {*} data - Data passed to each subscriber.
   */
  publish(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        callback(data);
      }
    }
  }

  /** Remove all subscribers for all events. */
  clear() {
    this._listeners.clear();
  }
}
