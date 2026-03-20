import { describe, it, expect } from 'vitest';
import { Camera } from '../../src/rendering/Camera.js';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, CAMERA } from '../../src/constants.js';

describe('Camera', () => {
  it('initializes at world center', () => {
    const cam = new Camera(800, 600);
    expect(cam.x).toBeCloseTo(MAP_WIDTH * TILE_SIZE / 2);
    expect(cam.y).toBeCloseTo(MAP_HEIGHT * TILE_SIZE / 2);
  });

  it('worldToScreen and screenToWorld are inverses', () => {
    const cam = new Camera(800, 600);
    const wx = 500, wy = 300;
    const [sx, sy] = cam.worldToScreen(wx, wy);
    const [rx, ry] = cam.screenToWorld(sx, sy);
    expect(rx).toBeCloseTo(wx, 1);
    expect(ry).toBeCloseTo(wy, 1);
  });

  it('zoom changes scale', () => {
    const cam = new Camera(800, 600);
    const initialZoom = cam.zoom;
    cam.zoomBy(CAMERA.ZOOM_STEP);
    expect(cam.zoom).toBeGreaterThan(initialZoom);
  });

  it('zoom clamps to min/max', () => {
    const cam = new Camera(800, 600);
    cam.zoom = CAMERA.ZOOM_MIN;
    cam.zoomBy(-1);
    expect(cam.zoom).toBe(CAMERA.ZOOM_MIN);
    cam.zoom = CAMERA.ZOOM_MAX;
    cam.zoomBy(1);
    expect(cam.zoom).toBe(CAMERA.ZOOM_MAX);
  });

  it('pan moves camera position', () => {
    const cam = new Camera(800, 600);
    const startX = cam.x;
    cam.pan(100, 0);
    expect(cam.x).toBeGreaterThan(startX);
  });

  it('clamps to world bounds', () => {
    const cam = new Camera(800, 600);
    cam.pan(-100000, -100000);
    cam.clampToWorld();
    expect(cam.x).toBeGreaterThanOrEqual(0);
    expect(cam.y).toBeGreaterThanOrEqual(0);
  });

  it('getViewportTileBounds returns tile range', () => {
    const cam = new Camera(800, 600);
    const bounds = cam.getViewportTileBounds();
    expect(bounds.startX).toBeGreaterThanOrEqual(0);
    expect(bounds.startY).toBeGreaterThanOrEqual(0);
    expect(bounds.endX).toBeLessThanOrEqual(MAP_WIDTH);
    expect(bounds.endY).toBeLessThanOrEqual(MAP_HEIGHT);
    expect(bounds.endX).toBeGreaterThan(bounds.startX);
    expect(bounds.endY).toBeGreaterThan(bounds.startY);
  });
});
