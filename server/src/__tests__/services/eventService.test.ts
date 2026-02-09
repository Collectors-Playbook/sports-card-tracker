import EventService from '../../services/eventService';

describe('EventService', () => {
  let eventService: EventService;

  beforeEach(() => {
    eventService = new EventService();
  });

  afterEach(() => {
    eventService.stopHeartbeat();
  });

  it('starts with zero clients', () => {
    expect(eventService.getClientCount()).toBe(0);
  });

  it('addClient increases client count', () => {
    const mockRes = { write: jest.fn() } as any;
    eventService.addClient(mockRes);
    expect(eventService.getClientCount()).toBe(1);
  });

  it('removeClient decreases client count', () => {
    const mockRes = { write: jest.fn() } as any;
    const id = eventService.addClient(mockRes);
    expect(eventService.getClientCount()).toBe(1);

    eventService.removeClient(id);
    expect(eventService.getClientCount()).toBe(0);
  });

  it('broadcast sends to all clients', () => {
    const mockRes1 = { write: jest.fn() } as any;
    const mockRes2 = { write: jest.fn() } as any;
    eventService.addClient(mockRes1);
    eventService.addClient(mockRes2);

    eventService.broadcast('test', { key: 'value' });

    expect(mockRes1.write).toHaveBeenCalledWith(
      expect.stringContaining('event: test')
    );
    expect(mockRes2.write).toHaveBeenCalledWith(
      expect.stringContaining('"key":"value"')
    );
  });

  it('broadcast removes clients that error', () => {
    const badRes = {
      write: () => { throw new Error('closed'); },
    } as any;
    eventService.addClient(badRes);
    expect(eventService.getClientCount()).toBe(1);

    eventService.broadcast('test', {});
    expect(eventService.getClientCount()).toBe(0);
  });

  it('startHeartbeat and stopHeartbeat work', () => {
    eventService.startHeartbeat(100);
    eventService.stopHeartbeat();
    // No error means success
  });

  it('heartbeat sends to clients', (done) => {
    const mockRes = { write: jest.fn() } as any;
    eventService.addClient(mockRes);

    eventService.startHeartbeat(50);

    setTimeout(() => {
      eventService.stopHeartbeat();
      expect(mockRes.write).toHaveBeenCalled();
      const calls = mockRes.write.mock.calls.map((c: unknown[]) => c[0] as string);
      const heartbeatCalls = calls.filter((c: string) => c.includes('heartbeat'));
      expect(heartbeatCalls.length).toBeGreaterThanOrEqual(1);
      done();
    }, 150);
  });
});
