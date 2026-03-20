import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MenuScreen } from '../../src/ui/MenuScreen.js';

function makeContainer() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function makeEventBus() {
  return { publish: vi.fn(), subscribe: vi.fn() };
}

describe('MenuScreen', () => {
  let container, eventBus, ms;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = makeContainer();
    eventBus = makeEventBus();
    ms = new MenuScreen(container, eventBus);
  });

  it('should create all four screen elements', () => {
    expect(container.querySelector('#main-menu')).not.toBeNull();
    expect(container.querySelector('#game-over-screen')).not.toBeNull();
    expect(container.querySelector('#victory-screen')).not.toBeNull();
    expect(container.querySelector('#pause-menu')).not.toBeNull();
  });

  it('showMenu should show main menu and hide others', () => {
    ms.showMenu();
    expect(container.querySelector('#main-menu').style.display).toBe('flex');
    expect(container.querySelector('#game-over-screen').style.display).toBe('none');
    expect(container.querySelector('#victory-screen').style.display).toBe('none');
    expect(container.querySelector('#pause-menu').style.display).toBe('none');
  });

  it('hideAll should hide all screens', () => {
    ms.showMenu();
    ms.hideAll();
    expect(container.querySelector('#main-menu').style.display).toBe('none');
  });

  it('showGameOver should show game over screen with stats', () => {
    ms.showGameOver({ wavesSurvived: 3, goldEarned: 500, heroesKilled: 10, creaturesLost: 2, elapsedTime: 125 });
    expect(container.querySelector('#game-over-screen').style.display).toBe('flex');
    expect(container.querySelector('#go-stats').innerHTML).toContain('3');
    expect(container.querySelector('#go-stats').innerHTML).toContain('500');
  });

  it('showVictory should show victory screen with stats', () => {
    ms.showVictory({ wavesSurvived: 10, goldEarned: 5000, heroesKilled: 50, creaturesLost: 5, elapsedTime: 300 });
    expect(container.querySelector('#victory-screen').style.display).toBe('flex');
    expect(container.querySelector('#vic-stats').innerHTML).toContain('10');
  });

  it('showPause should show pause overlay', () => {
    ms.showPause();
    expect(container.querySelector('#pause-menu').style.display).toBe('flex');
  });

  it('BEGIN button should publish menu:start', () => {
    container.querySelector('#btn-begin').click();
    expect(eventBus.publish).toHaveBeenCalledWith('menu:start', {});
  });

  it('RESTART button on game over should publish menu:restart', () => {
    ms.showGameOver({ wavesSurvived: 0, elapsedTime: 0 });
    container.querySelector('#btn-restart-go').click();
    expect(eventBus.publish).toHaveBeenCalledWith('menu:restart', {});
  });

  it('RESUME button should publish menu:resume', () => {
    ms.showPause();
    container.querySelector('#btn-resume').click();
    expect(eventBus.publish).toHaveBeenCalledWith('menu:resume', {});
  });

  it('QUIT button should publish menu:quit', () => {
    ms.showPause();
    container.querySelector('#btn-quit').click();
    expect(eventBus.publish).toHaveBeenCalledWith('menu:quit', {});
  });
});
