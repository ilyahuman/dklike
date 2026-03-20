import { describe, it, expect, vi } from 'vitest';
import { JobQueue } from '../../src/systems/JobQueue.js';
import { EventBus } from '../../src/core/EventBus.js';

describe('JobQueue', () => {
  it('queues a dig job', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    expect(jq.getPendingDigJobs().length).toBe(1);
    expect(jq.getPendingDigJobs()[0]).toEqual({ x: 5, y: 10, assignedTo: null });
  });

  it('does not duplicate dig jobs at same tile', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    jq.addDigJob(5, 10);
    expect(jq.getPendingDigJobs().length).toBe(1);
  });

  it('claims a job for an imp', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    const job = jq.claimDigJob(42);
    expect(job).not.toBeNull();
    expect(job.assignedTo).toBe(42);
    expect(jq.getPendingDigJobs().length).toBe(0);
  });

  it('claimDigJob returns null when no jobs', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    const job = jq.claimDigJob(42);
    expect(job).toBeNull();
  });

  it('completeDigJob removes the job', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    const job = jq.claimDigJob(42);
    jq.completeDigJob(5, 10);
    expect(jq.getAllDigJobs().length).toBe(0);
  });

  it('releaseJob makes it available again', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    jq.claimDigJob(42);
    jq.releaseJob(42);
    expect(jq.getPendingDigJobs().length).toBe(1);
    expect(jq.getPendingDigJobs()[0].assignedTo).toBeNull();
  });

  it('publishes JOB_UPDATED event on add', () => {
    const eventBus = new EventBus();
    const spy = vi.fn();
    eventBus.subscribe('job:updated', spy);
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    expect(spy).toHaveBeenCalled();
  });

  it('isDigQueued checks if a tile has a pending job', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    expect(jq.isDigQueued(5, 10)).toBe(true);
    expect(jq.isDigQueued(1, 1)).toBe(false);
  });

  it('getJobForImp returns the job claimed by a specific imp', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    jq.claimDigJob(42);
    const job = jq.getJobForImp(42);
    expect(job).not.toBeNull();
    expect(job.x).toBe(5);
    expect(job.y).toBe(10);
  });
});
