import { Response } from 'express';
import { NotificationQueueItem } from '../models/types';

// SSE connection registry
const sseConnectionRegistry = new Map<string, Response>();

export function registerSSEConnection(
  customerId: string,
  tabId: string,
  res: Response
): void {
  const key = `${customerId}-${tabId}`;
  sseConnectionRegistry.set(key, res);

  console.log(`✓ SSE connection registered: ${key}`);

  // Send keepalive every 30s
  const keepaliveInterval = setInterval(() => {
    if (sseConnectionRegistry.has(key)) {
      try {
        res.write(': keepalive\n\n');
      } catch (error) {
        console.error(`Keepalive error for ${key}:`, error);
        clearInterval(keepaliveInterval);
        sseConnectionRegistry.delete(key);
      }
    } else {
      clearInterval(keepaliveInterval);
    }
  }, 30000);

  // Cleanup on disconnect
  res.on('close', () => {
    clearInterval(keepaliveInterval);
    sseConnectionRegistry.delete(key);
    console.log(`✗ SSE connection closed: ${key}`);
  });
}

export function sendNotification(item: NotificationQueueItem): void {
  const key = `${item.customerId}-${item.tabId}`;
  const connection = sseConnectionRegistry.get(key);

  if (connection) {
    try {
      const data = JSON.stringify(item);
      connection.write(`data: ${data}\n\n`);
      console.log(`✓ Notification sent to ${key}: ${item.type}`);
    } catch (error) {
      console.error(`Error sending notification to ${key}:`, error);
      sseConnectionRegistry.delete(key);
    }
  } else {
    console.warn(`⚠ No SSE connection found for: ${key}`);
  }
}

export function getActiveConnections(): number {
  return sseConnectionRegistry.size;
}
