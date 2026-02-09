import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

class EventService {
  private clients: Map<string, Response> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  addClient(res: Response): string {
    const id = uuidv4();
    this.clients.set(id, res);
    return id;
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  broadcast(event: string, data: unknown): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, res] of this.clients) {
      try {
        res.write(message);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  startHeartbeat(intervalMs: number = 30000): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.broadcast('heartbeat', { time: new Date().toISOString() });
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export default EventService;
