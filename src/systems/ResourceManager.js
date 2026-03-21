import { RESOURCES, EVENTS, DUNGEON_HEART_HP } from '../constants.js';

/**
 * Tracks gold and mana resources.
 * Gold: integer, capped by base + treasury. Mana: float, regens from Dungeon Heart.
 * Single source of truth for resource amounts.
 */
export class ResourceManager {
  /** @param {import('../core/EventBus.js').EventBus} eventBus */
  constructor(eventBus) {
    this._eventBus = eventBus;
    this._gold = RESOURCES.STARTING_GOLD;
    this._mana = RESOURCES.STARTING_MANA;
    this._goldCap = RESOURCES.GOLD_BASE_CAP;
    this._manaCap = RESOURCES.MANA_CAP;
    this._heartHP = DUNGEON_HEART_HP;
    this._heartMaxHP = DUNGEON_HEART_HP;
    this._publish();
  }

  get gold() { return this._gold; }
  get mana() { return this._mana; }
  get goldCap() { return this._goldCap; }
  get manaCap() { return this._manaCap; }
  get heartHP() { return this._heartHP; }
  get heartMaxHP() { return this._heartMaxHP; }
  get isHeartDestroyed() { return this._heartHP <= 0; }

  earnGold(amount) {
    const prev = this._gold;
    this._gold = Math.min(this._goldCap, this._gold + amount);
    if (this._gold !== prev) this._publish();
    return this._gold === this._goldCap && prev + amount > this._goldCap;
  }

  spendGold(amount) {
    if (this._gold < amount) return false;
    this._gold -= amount;
    this._publish();
    return true;
  }

  earnMana(amount) {
    const prev = this._mana;
    this._mana = Math.min(this._manaCap, this._mana + amount);
    if (this._mana !== prev) this._publish();
  }

  spendMana(amount) {
    if (this._mana < amount) return false;
    this._mana -= amount;
    this._publish();
    return true;
  }

  damageHeart(amount) {
    this._heartHP = Math.max(0, this._heartHP - amount);
    this._publish();
  }

  resetHeart() {
    this._heartHP = this._heartMaxHP;
    this._publish();
  }

  setTreasuryTileCount(tileCount) {
    this._goldCap = RESOURCES.GOLD_BASE_CAP + tileCount * RESOURCES.GOLD_PER_TREASURY_TILE;
    if (this._gold > this._goldCap) this._gold = this._goldCap;
    this._publish();
  }

  update(dt) {
    const prev = this._mana;
    this._mana = Math.min(this._manaCap, this._mana + RESOURCES.MANA_REGEN_PER_SEC * dt);
    if (this._mana !== prev) this._publish();
  }

  getSnapshot() {
    return {
      gold: this._gold,
      mana: this._mana,
      goldCap: this._goldCap,
      manaCap: this._manaCap,
      heartHP: this._heartHP,
      heartMaxHP: this._heartMaxHP,
    };
  }

  /** @private */
  _publish() {
    this._eventBus.publish(EVENTS.RESOURCES_CHANGED, this.getSnapshot());
  }
}
