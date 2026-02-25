import { useState, useCallback, useEffect } from 'react';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

const STORAGE_KEY = 'notifications-enabled';

function getStoredEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

function getPermissionState(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as PermissionState;
}

export function useNotifications() {
  const [permission, setPermission] = useState<PermissionState>(getPermissionState);
  const [enabled, setEnabled] = useState(getStoredEnabled);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // localStorage unavailable
    }
  }, [enabled]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      setPermission('unsupported');
      return 'unsupported' as PermissionState;
    }
    if (Notification.permission === 'granted') {
      setPermission('granted');
      return 'granted' as PermissionState;
    }
    if (Notification.permission === 'denied') {
      setPermission('denied');
      return 'denied' as PermissionState;
    }
    const result = await Notification.requestPermission();
    setPermission(result as PermissionState);
    return result as PermissionState;
  }, []);

  const notify = useCallback(
    (title: string, options?: NotificationOptions): Notification | null => {
      if (!enabled) return null;
      if (typeof Notification === 'undefined') return null;
      if (Notification.permission !== 'granted') return null;

      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      return notification;
    },
    [enabled]
  );

  return { permission, enabled, setEnabled, requestPermission, notify };
}
