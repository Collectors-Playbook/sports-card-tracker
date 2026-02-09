import Database from '../../database';
import EventService from '../../services/eventService';
import JobService, { JobHandler } from '../../services/jobService';

describe('JobService', () => {
  let db: Database;
  let eventService: EventService;
  let jobService: JobService;

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.waitReady();
    eventService = new EventService();
    jobService = new JobService(db, eventService);
  });

  afterEach(async () => {
    jobService.stop();
    await db.close();
  });

  it('registers a handler', () => {
    const handler: JobHandler = async () => ({ done: true });
    jobService.registerHandler('test', handler);
    // No error means success
  });

  it('processes a pending job with registered handler', async () => {
    const handler: JobHandler = jest.fn(async () => ({ result: 'ok' }));
    jobService.registerHandler('process-test', handler);

    const job = await db.createJob({ type: 'process-test', payload: { file: 'a.jpg' } });
    await jobService.processNextJob();

    const updated = await db.getJobById(job.id);
    expect(updated?.status).toBe('completed');
    expect(updated?.result).toEqual({ result: 'ok' });
    expect(handler).toHaveBeenCalled();
  });

  it('marks job as failed when handler throws', async () => {
    jobService.registerHandler('fail-test', async () => {
      throw new Error('Handler error');
    });

    const job = await db.createJob({ type: 'fail-test' });
    await jobService.processNextJob();

    const updated = await db.getJobById(job.id);
    expect(updated?.status).toBe('failed');
    expect(updated?.error).toBe('Handler error');
  });

  it('marks job as failed when no handler registered', async () => {
    const job = await db.createJob({ type: 'no-handler' });
    await jobService.processNextJob();

    const updated = await db.getJobById(job.id);
    expect(updated?.status).toBe('failed');
    expect(updated?.error).toContain('No handler');
  });

  it('does nothing when no pending jobs', async () => {
    await jobService.processNextJob();
    // No error means success
  });

  it('handler can update progress', async () => {
    const broadcasts: unknown[] = [];
    const origBroadcast = eventService.broadcast.bind(eventService);
    eventService.broadcast = (event: string, data: unknown) => {
      broadcasts.push({ event, data });
      origBroadcast(event, data);
    };

    jobService.registerHandler('progress-test', async (_job, updateProgress) => {
      await updateProgress(50, 5);
      await updateProgress(100, 10);
      return { done: true };
    });

    const job = await db.createJob({ type: 'progress-test' });
    await jobService.processNextJob();

    const progressEvents = broadcasts.filter(
      (b: unknown) => (b as { event: string }).event === 'job:progress'
    );
    expect(progressEvents.length).toBe(2);

    const updated = await db.getJobById(job.id);
    expect(updated?.status).toBe('completed');
  });

  it('broadcasts job:started and job:completed events', async () => {
    const broadcasts: unknown[] = [];
    const origBroadcast = eventService.broadcast.bind(eventService);
    eventService.broadcast = (event: string, data: unknown) => {
      broadcasts.push({ event, data });
      origBroadcast(event, data);
    };

    jobService.registerHandler('event-test', async () => ({ ok: true }));

    await db.createJob({ type: 'event-test' });
    await jobService.processNextJob();

    const events = broadcasts.map((b: unknown) => (b as { event: string }).event);
    expect(events).toContain('job:started');
    expect(events).toContain('job:completed');
  });

  it('broadcasts job:failed event on error', async () => {
    const broadcasts: unknown[] = [];
    const origBroadcast = eventService.broadcast.bind(eventService);
    eventService.broadcast = (event: string, data: unknown) => {
      broadcasts.push({ event, data });
      origBroadcast(event, data);
    };

    jobService.registerHandler('fail-event', async () => {
      throw new Error('boom');
    });

    await db.createJob({ type: 'fail-event' });
    await jobService.processNextJob();

    const events = broadcasts.map((b: unknown) => (b as { event: string }).event);
    expect(events).toContain('job:failed');
  });

  it('start and stop control polling', () => {
    jobService.start(1000);
    // Should not throw
    jobService.stop();
  });

  it('processes jobs in order (FIFO)', async () => {
    const order: string[] = [];
    jobService.registerHandler('order-test', async (job) => {
      order.push(job.id);
      return {};
    });

    const job1 = await db.createJob({ type: 'order-test', payload: { n: 1 } });
    const job2 = await db.createJob({ type: 'order-test', payload: { n: 2 } });

    await jobService.processNextJob();
    await jobService.processNextJob();

    expect(order).toEqual([job1.id, job2.id]);
  });
});
