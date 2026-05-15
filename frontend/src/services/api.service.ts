import type { GeoJSONPoint, NotificationData } from '../types/index.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface SubmitContextData {
  customerId: string;
  tabId: string;
  position: GeoJSONPoint;
  weather: {
    condition: string;
    temperature: number;
    label: string;
  };
  event: {
    type: string;
    label: string;
    description: string;
  };
  customerActivity: {
    profile: string;
    recentViews: string[];
    recentPurchases: string[];
    cartItems: string[];
  };
}

export async function submitContext(data: SubmitContextData): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/context/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to submit context');
  }
}

export function connectSSE(
  customerId: string,
  tabId: string,
  onMessage: (data: NotificationData) => void,
  onError: (error: Event) => void
): EventSource {
  const eventSource = new EventSource(
    `${API_BASE_URL}/notifications/stream/${customerId}/${tabId}`
  );

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as NotificationData;
      onMessage(data);
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    onError(error);
  };

  return eventSource;
}

export function getOrCreateCustomerId(): string {
  let customerId = sessionStorage.getItem('customerId');
  if (!customerId) {
    customerId = crypto.randomUUID();
    sessionStorage.setItem('customerId', customerId);
  }
  return customerId;
}

export function getOrCreateTabId(): string {
  let tabId = sessionStorage.getItem('tabId');
  if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem('tabId', tabId);
  }
  return tabId;
}
