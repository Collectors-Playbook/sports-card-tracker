import Database from '../database';
import EventService from './eventService';
import { PriceAlert } from '../types';

class PriceAlertService {
  private db: Database;
  private eventService: EventService;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(db: Database, eventService: EventService) {
    this.db = db;
    this.eventService = eventService;
  }

  async checkAlerts(): Promise<{ triggered: number; checked: number }> {
    const alerts = await this.db.getEnabledAlerts();
    let triggered = 0;

    for (const alert of alerts) {
      const { currentValue } = alert;
      let shouldTrigger = false;
      let threshold = 0;

      if (alert.type === 'above' && alert.thresholdHigh !== null && currentValue >= alert.thresholdHigh) {
        shouldTrigger = true;
        threshold = alert.thresholdHigh;
      } else if (alert.type === 'below' && alert.thresholdLow !== null && currentValue <= alert.thresholdLow) {
        shouldTrigger = true;
        threshold = alert.thresholdLow;
      }

      if (shouldTrigger) {
        // Use previous value from last check, or threshold as fallback
        const previousValue = await this.getPreviousValue(alert);
        await this.db.recordAlertTrigger(
          alert.id, alert.cardId, previousValue, currentValue, threshold, alert.type
        );
        triggered++;

        this.eventService.broadcast('price-alert', {
          alertId: alert.id,
          cardId: alert.cardId,
          player: alert.player,
          type: alert.type,
          threshold,
          currentValue,
          previousValue,
        });
      } else {
        await this.db.recordAlertCheck(alert.id);
      }
    }

    return { triggered, checked: alerts.length };
  }

  private async getPreviousValue(alert: PriceAlert & { currentValue: number }): Promise<number> {
    const history = await this.db.getAlertHistory(alert.id);
    if (history.length > 0) {
      return history[0].currentValue;
    }
    // First trigger — no previous history, use current value as a reasonable default
    return alert.currentValue;
  }

  start(intervalMs: number = 3600000): void {
    this.stop();
    this.checkInterval = setInterval(() => {
      this.checkAlerts().catch(err => {
        console.error('Price alert check failed:', err);
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export default PriceAlertService;
