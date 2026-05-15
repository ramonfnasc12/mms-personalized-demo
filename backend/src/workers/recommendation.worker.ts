import { getDatabase } from '../config/database';
import { ProximityQueueItem, CustomerContext, Store, NotificationQueueItem } from '../models/types';
import { generateSearchContext, generatePersonalizedMessage } from '../services/llm.service';
import { findBestProduct } from '../services/vector-search.service';
import { InMemoryQueue } from '../queues/InMemoryQueue';
import { sendNotification } from '../services/notification.service';

// Notification queue
const notificationQueue = new InMemoryQueue<NotificationQueueItem>(
  async (item: NotificationQueueItem) => {
    sendNotification(item);
  }
);

export async function processProximityEvent(item: ProximityQueueItem): Promise<void> {
  const { customerId, storeId, tabId } = item;

  console.log(`\n🔄 Processing proximity event: customer ${customerId}, store ${storeId}`);

  const db = getDatabase();

  try {
    // 1. Get customer context
    const context = await db
      .collection('customerContext')
      .findOne({ customerId }, { sort: { timestamp: -1 } }) as CustomerContext | null;

    if (!context) {
      console.error(`❌ No context found for customer: ${customerId}`);
      return;
    }

    // 2. Get store details
    const store = await db
      .collection('stores')
      .findOne({ storeId }) as Store | null;

    if (!store) {
      console.error(`❌ Store not found: ${storeId}`);
      return;
    }

    console.log(`✓ Found context for ${context.customerActivity.profile}`);
    console.log(`✓ Store: ${store.name}`);

    // 3. Generate search context using LLM
    const searchQuery = await generateSearchContext(context);

    // 4. Vector search for best product
    const product = await findBestProduct(searchQuery, storeId);

    if (!product) {
      notificationQueue.enqueue({
        customerId,
        tabId,
        type: 'no_recommendation',
        message: 'No matching products in stock nearby right now.'
      });
      console.log(`⚠ No recommendation for customer ${customerId}`);
      return;
    }

    // 5. Generate personalized message
    const message = await generatePersonalizedMessage(product, context, store);

    // 6. Send to notification queue
    notificationQueue.enqueue({
      customerId,
      tabId,
      type: 'recommendation',
      product,
      store,
      message,
      score: product.score
    });

    console.log(`✅ Recommendation queued for customer ${customerId}: ${product.name}`);
  } catch (error) {
    console.error('Error processing proximity event:', error);
    // Send error notification
    notificationQueue.enqueue({
      customerId,
      tabId,
      type: 'no_recommendation',
      message: 'Sorry, we encountered an error finding recommendations.'
    });
  }
}

export { notificationQueue };
