import { useEffect, useRef, useCallback } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

type EventHandler = (data: any) => void;

export function useSSE(connect: boolean) {
  const esRef = useRef<EventSource | null>(null);
  const listenersRef = useRef<Map<string, Set<EventHandler>>>(new Map());

  useEffect(() => {
    if (!connect) {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      return;
    }

    const es = new EventSource(`${API_BASE_URL}/events`);
    esRef.current = es;

    // Re-attach existing listeners to the new EventSource
    for (const [event, handlers] of listenersRef.current) {
      for (const handler of handlers) {
        es.addEventListener(event, ((e: MessageEvent) => {
          try {
            handler(JSON.parse(e.data));
          } catch {
            handler(e.data);
          }
        }) as EventListener);
      }
    }

    return () => {
      es.close();
      if (esRef.current === es) {
        esRef.current = null;
      }
    };
  }, [connect]);

  const on = useCallback((event: string, handler: EventHandler): (() => void) => {
    // Track handler in our ref
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);

    // If EventSource is active, attach now
    const wrappedListener = ((e: MessageEvent) => {
      try {
        handler(JSON.parse(e.data));
      } catch {
        handler(e.data);
      }
    }) as EventListener;

    if (esRef.current) {
      esRef.current.addEventListener(event, wrappedListener);
    }

    return () => {
      listenersRef.current.get(event)?.delete(handler);
      if (esRef.current) {
        esRef.current.removeEventListener(event, wrappedListener);
      }
    };
  }, []);

  return { on };
}
