import { COMBAT_TICK_MS, TILE_SIZE, LEVEL_DAMAGE_BONUS, EVENTS } from '../constants.js';

export class CombatSystem {
  constructor(entityManager, eventBus) {
    this._entityManager = entityManager;
    this._eventBus = eventBus;
    this._accumulator = 0;
  }

  update(dt) {
    for (const entity of this._entityManager.getAll()) {
      entity.updateDebuffs(dt);
      if (entity._attackTimer > 0) {
        entity._attackTimer = Math.max(0, entity._attackTimer - dt);
      }
    }

    this._accumulator += dt;
    const tickSec = COMBAT_TICK_MS / 1000;
    if (this._accumulator < tickSec) return;
    this._accumulator -= tickSec;
    this._resolveCombat();
  }

  _resolveCombat() {
    const entities = this._entityManager.getAll();
    for (const attacker of entities) {
      if (!attacker.alive || attacker.damage <= 0 || attacker.team === null) continue;
      if (attacker._attackTimer > 0) continue;

      const targets = this._findTargets(attacker, entities);
      if (targets.length === 0) continue;

      attacker._attackTimer = attacker.attackCooldown;
      const dmg = this._calculateDamage(attacker);

      for (const target of targets) {
        target.takeDamage(dmg);
        if (attacker.debuffOnHit) {
          target.applyDebuff(attacker.debuffOnHit.type, attacker.debuffOnHit.duration, attacker.debuffOnHit.factor);
        }
        this._eventBus.publish(EVENTS.ENTITY_DAMAGED, {
          targetId: target.id, attackerId: attacker.id, damage: dmg, x: target.x, y: target.y,
        });
        if (target.isDead()) {
          target.alive = false;
          this._eventBus.publish(EVENTS.ENTITY_DIED, {
            entityId: target.id, type: target.type, x: target.x, y: target.y,
            team: target.team, goldDrop: target.goldDrop || 0,
          });
        }
      }
    }
  }

  _findTargets(attacker, entities) {
    const rangePx = attacker.attackRange * TILE_SIZE;
    const rangeSq = rangePx * rangePx;
    const candidates = [];
    for (const e of entities) {
      if (!e.alive || e.team === attacker.team || e.team === null) continue;
      const dx = e.x - attacker.x;
      const dy = e.y - attacker.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= rangeSq) candidates.push({ entity: e, distSq });
    }
    candidates.sort((a, b) => a.distSq - b.distSq);
    return candidates.slice(0, attacker.maxTargets).map(c => c.entity);
  }

  _calculateDamage(attacker) {
    const levelBonus = 1 + (attacker.level - 1) * LEVEL_DAMAGE_BONUS;
    return Math.round(attacker.damage * levelBonus);
  }
}
