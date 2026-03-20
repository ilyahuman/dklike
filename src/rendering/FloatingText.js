/**
 * Floating damage/gold numbers that drift upward and fade out.
 */
export class FloatingText {
  constructor(ctx, camera) {
    this._ctx = ctx;
    this._camera = camera;
    this._texts = [];
  }

  add(x, y, text, color = '#fff') {
    this._texts.push({ x, y, text: String(text), color, life: 1.0, maxLife: 1.0, vy: -60 });
  }

  update(dt) {
    for (let i = this._texts.length - 1; i >= 0; i--) {
      const t = this._texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      if (t.life <= 0) this._texts.splice(i, 1);
    }
  }

  render() {
    const ctx = this._ctx;
    for (const t of this._texts) {
      const [sx, sy] = this._camera.worldToScreen(t.x, t.y);
      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      ctx.font = `bold ${14 * this._camera.zoom}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }
}
