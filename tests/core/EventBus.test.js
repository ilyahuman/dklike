import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';

describe('EventBus', () => {
  it('calls subscriber when event is published', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    bus.subscribe('test', callback);
    bus.publish('test', { value: 42 });
    expect(callback).toHaveBeenCalledWith({ value: 42 });
  });

  it('supports multiple subscribers for same event', () => {
    const bus = new EventBus();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bus.subscribe('test', cb1);
    bus.subscribe('test', cb2);
    bus.publish('test', 'data');
    expect(cb1).toHaveBeenCalledWith('data');
    expect(cb2).toHaveBeenCalledWith('data');
  });

  it('does not call subscriber after unsubscribe', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    bus.subscribe('test', callback);
    bus.unsubscribe('test', callback);
    bus.publish('test', 'data');
    expect(callback).not.toHaveBeenCalled();
  });

  it('does nothing when publishing event with no subscribers', () => {
    const bus = new EventBus();
    expect(() => bus.publish('nonexistent', 'data')).not.toThrow();
  });

  it('does not call subscribers of different events', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    bus.subscribe('event_a', callback);
    bus.publish('event_b', 'data');
    expect(callback).not.toHaveBeenCalled();
  });

  it('unsubscribe is safe to call for non-subscribed callback', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    expect(() => bus.unsubscribe('test', callback)).not.toThrow();
  });

  it('clear removes all subscribers', () => {
    const bus = new EventBus();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bus.subscribe('a', cb1);
    bus.subscribe('b', cb2);
    bus.clear();
    bus.publish('a', 'data');
    bus.publish('b', 'data');
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });
});
