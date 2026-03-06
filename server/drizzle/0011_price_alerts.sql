CREATE TABLE IF NOT EXISTS price_alerts (
  id text PRIMARY KEY NOT NULL,
  cardId text NOT NULL,
  userId text NOT NULL,
  type text NOT NULL,
  thresholdLow real,
  thresholdHigh real,
  isEnabled integer DEFAULT 1,
  lastCheckedAt text,
  lastTriggeredAt text,
  triggerCount integer DEFAULT 0,
  createdAt text NOT NULL,
  updatedAt text NOT NULL,
  FOREIGN KEY (cardId) REFERENCES cards(id) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (userId) REFERENCES users(id) ON UPDATE no action ON DELETE no action
);
CREATE INDEX IF NOT EXISTS idx_price_alerts_cardId ON price_alerts (cardId);
CREATE INDEX IF NOT EXISTS idx_price_alerts_userId ON price_alerts (userId);
CREATE INDEX IF NOT EXISTS idx_price_alerts_isEnabled ON price_alerts (isEnabled);

CREATE TABLE IF NOT EXISTS price_alert_history (
  id text PRIMARY KEY NOT NULL,
  alertId text NOT NULL,
  cardId text NOT NULL,
  previousValue real NOT NULL,
  currentValue real NOT NULL,
  threshold real NOT NULL,
  type text NOT NULL,
  createdAt text NOT NULL,
  FOREIGN KEY (alertId) REFERENCES price_alerts(id) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (cardId) REFERENCES cards(id) ON UPDATE no action ON DELETE no action
);
CREATE INDEX IF NOT EXISTS idx_alert_history_alertId ON price_alert_history (alertId);
CREATE INDEX IF NOT EXISTS idx_alert_history_cardId ON price_alert_history (cardId);
CREATE INDEX IF NOT EXISTS idx_alert_history_createdAt ON price_alert_history (createdAt);
