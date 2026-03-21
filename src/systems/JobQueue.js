import { EVENTS } from '../constants.js';

/**
 * Manages dig and carry jobs. Imps claim one job at a time.
 * Job released if imp dies mid-task.
 */
export class JobQueue {
  /**
   * @param {import('../core/EventBus.js').EventBus} eventBus
   */
  constructor(eventBus) {
    this._eventBus = eventBus;
    /** @type {Array<{x: number, y: number, assignedTo: number|null}>} */
    this._digJobs = [];
  }

  /**
   * Queue a dig job at tile position.
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   */
  addDigJob(x, y) {
    // Don't duplicate
    if (this._digJobs.some(j => j.x === x && j.y === y)) return;
    this._digJobs.push({ x, y, assignedTo: null });
    this._eventBus.publish(EVENTS.JOB_UPDATED, { type: 'dig', x, y, action: 'added' });
  }

  /**
   * Claim the nearest unclaimed dig job for an imp.
   * @param {number} impId
   * @returns {{x: number, y: number, assignedTo: number}|null}
   */
  claimDigJob(impId) {
    const job = this._digJobs.find(j => j.assignedTo === null);
    if (!job) return null;
    job.assignedTo = impId;
    return job;
  }

  /**
   * Cancel a dig job at tile position (player unmarked it).
   * @param {number} x
   * @param {number} y
   */
  cancelDigJob(x, y) {
    const idx = this._digJobs.findIndex(j => j.x === x && j.y === y);
    if (idx !== -1) {
      this._digJobs.splice(idx, 1);
      this._eventBus.publish(EVENTS.JOB_UPDATED, { type: 'dig', x, y, action: 'cancelled' });
    }
  }

  /**
   * Mark a dig job as complete and remove it.
   * @param {number} x
   * @param {number} y
   */
  completeDigJob(x, y) {
    const idx = this._digJobs.findIndex(j => j.x === x && j.y === y);
    if (idx !== -1) {
      this._digJobs.splice(idx, 1);
      this._eventBus.publish(EVENTS.JOB_UPDATED, { type: 'dig', x, y, action: 'completed' });
    }
  }

  /**
   * Release all jobs assigned to an imp (e.g., on death).
   * @param {number} impId
   */
  releaseJob(impId) {
    for (const job of this._digJobs) {
      if (job.assignedTo === impId) {
        job.assignedTo = null;
      }
    }
  }

  /**
   * Get all unclaimed dig jobs.
   * @returns {Array<{x: number, y: number, assignedTo: null}>}
   */
  getPendingDigJobs() {
    return this._digJobs.filter(j => j.assignedTo === null);
  }

  /**
   * Get all dig jobs (claimed and unclaimed).
   * @returns {Array<{x: number, y: number, assignedTo: number|null}>}
   */
  getAllDigJobs() {
    return this._digJobs;
  }

  /**
   * Check if a tile has a queued dig job.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isDigQueued(x, y) {
    return this._digJobs.some(j => j.x === x && j.y === y);
  }

  /**
   * Get the job currently assigned to an imp.
   * @param {number} impId
   * @returns {{x: number, y: number, assignedTo: number}|null}
   */
  getJobForImp(impId) {
    return this._digJobs.find(j => j.assignedTo === impId) || null;
  }
}
