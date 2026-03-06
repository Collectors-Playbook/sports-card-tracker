import Database from '../../database';
import EventService from '../../services/eventService';
import PriceAlertService from '../../services/priceAlertService';

describe('PriceAlertService', () => {
  let db: Database;
  let eventService: EventService;
  let service: PriceAlertService;
  let userId: string;

  beforeAll(async () => {
    db = new Database(':memory:');
    await db.waitReady();
    eventService = new EventService();
    service = new PriceAlertService(db, eventService);

    const user = await db.createUser({ username: 'alerttest', email: 'alerttest@test.com', password: 'password123' });
    userId = user.id;
  });

  afterAll(async () => {
    service.stop();
    await db.close();
  });

  async function createTestCard(currentValue: number) {
    return db.createCard({
      userId,
      player: 'Test Player',
      team: 'Test Team',
      year: 2023,
      brand: 'Topps',
      category: 'Baseball',
      cardNumber: `${Math.random()}`,
      condition: 'RAW',
      purchasePrice: 10,
      purchaseDate: '2023-01-01',
      currentValue,
      images: [],
      notes: '',
    });
  }

  describe('checkAlerts', () => {
    it('triggers above alert when value exceeds threshold', async () => {
      const card = await createTestCard(150);
      await db.createPriceAlert(userId, {
        cardId: card.id,
        type: 'above',
        thresholdHigh: 100,
      });

      const broadcastSpy = jest.spyOn(eventService, 'broadcast');
      const result = await service.checkAlerts();

      expect(result.triggered).toBeGreaterThanOrEqual(1);
      expect(broadcastSpy).toHaveBeenCalledWith('price-alert', expect.objectContaining({
        cardId: card.id,
        type: 'above',
      }));
      broadcastSpy.mockRestore();
    });

    it('triggers below alert when value drops below threshold', async () => {
      const card = await createTestCard(5);
      await db.createPriceAlert(userId, {
        cardId: card.id,
        type: 'below',
        thresholdLow: 10,
      });

      const broadcastSpy = jest.spyOn(eventService, 'broadcast');
      const result = await service.checkAlerts();

      expect(result.triggered).toBeGreaterThanOrEqual(1);
      expect(broadcastSpy).toHaveBeenCalledWith('price-alert', expect.objectContaining({
        cardId: card.id,
        type: 'below',
      }));
      broadcastSpy.mockRestore();
    });

    it('does not trigger when value is within range', async () => {
      const card = await createTestCard(50);
      await db.createPriceAlert(userId, {
        cardId: card.id,
        type: 'above',
        thresholdHigh: 100,
      });

      // Check how many alerts total are triggered (includes alerts from earlier tests)
      const result = await service.checkAlerts();
      // The alert for this specific card should NOT trigger since 50 < 100
      const history = await db.getPriceAlertsByCard(card.id);
      const alert = history[0];
      expect(alert.lastTriggeredAt).toBeNull();
    });

    it('does not trigger disabled alerts', async () => {
      const card = await createTestCard(200);
      const alert = await db.createPriceAlert(userId, {
        cardId: card.id,
        type: 'above',
        thresholdHigh: 50,
      });
      await db.updatePriceAlert(alert.id, { isEnabled: false });

      const beforeHistory = await db.getAlertHistory(alert.id);
      await service.checkAlerts();
      const afterHistory = await db.getAlertHistory(alert.id);

      expect(afterHistory.length).toBe(beforeHistory.length);
    });

    it('records trigger history', async () => {
      const card = await createTestCard(200);
      const alert = await db.createPriceAlert(userId, {
        cardId: card.id,
        type: 'above',
        thresholdHigh: 100,
      });

      await service.checkAlerts();

      const history = await db.getAlertHistory(alert.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].type).toBe('above');
      expect(history[0].threshold).toBe(100);
    });

    it('updates triggerCount on the alert', async () => {
      const card = await createTestCard(300);
      const alert = await db.createPriceAlert(userId, {
        cardId: card.id,
        type: 'above',
        thresholdHigh: 50,
      });

      await service.checkAlerts();
      const updated = await db.getPriceAlert(alert.id);
      expect(updated!.triggerCount).toBeGreaterThanOrEqual(1);
      expect(updated!.lastTriggeredAt).not.toBeNull();
    });
  });

  describe('start/stop', () => {
    it('starts and stops without error', () => {
      service.start(60000);
      service.stop();
    });
  });
});
