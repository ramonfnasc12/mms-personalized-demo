import { Db, ChangeStream } from 'mongodb';
import { ProximityQueueItem } from '../models/types';
import { InMemoryQueue } from '../queues/InMemoryQueue';
import { processProximityEvent } from './recommendation.worker';
import { sendNotification } from '../services/notification.service';

// Proximity queue
const proximityQueue = new InMemoryQueue<ProximityQueueItem>(processProximityEvent);

let changeStream: ChangeStream | null = null;

export async function startChangeStreamWorker(db: Db): Promise<void> {
  console.log('🔄 Starting change stream worker...');

  const pipeline = [
    {
      $match: {
        operationType: 'insert',
        'fullDocument.position': { $exists: true }
      }
    }
  ];

  try {
    changeStream = db.collection('customerPosition').watch(pipeline, {
      fullDocument: 'updateLookup'
    });

    console.log('✓ Change stream worker started');

    changeStream.on('change', async (change) => {
      if (change.operationType === 'insert' && change.fullDocument) {
        const { customerId, position, tabId } = change.fullDocument as any;

        console.log(`\n📍 New position event: customer ${customerId}`);

        try {
          // Find stores within 1km using geospatial query
          const nearbyStores = await db
            .collection('stores')
            .find({
              position: {
                $near: {
                  $geometry: position,
                  $maxDistance: 1000 // 1km in meters
                }
              }
            })
            .limit(1)
            .toArray();

          if (nearbyStores.length > 0) {
            const closestStore = nearbyStores[0] as any;
            console.log(`✓ Customer near store: ${closestStore.name}`);

            // Enqueue proximity event for processing
            proximityQueue.enqueue({
              customerId,
              storeId: closestStore.storeId,
              tabId
            });
          } else {
            console.log(`⚠ Customer not near any store (within 1km)`);

            // Send "no nearby stores" notification
            sendNotification({
              customerId,
              tabId,
              type: 'no_recommendation',
              message: 'No stores found within 1km of your location. Try a different location or check back later.'
            });
          }
        } catch (error) {
          console.error('Error processing position change:', error);
        }
      }
    });

    changeStream.on('error', (error) => {
      console.error('❌ Change stream error:', error);
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        console.log('🔄 Attempting to reconnect change stream...');
        startChangeStreamWorker(db);
      }, 5000);
    });

    changeStream.on('close', () => {
      console.log('✗ Change stream closed');
    });
  } catch (error) {
    console.error('Failed to start change stream:', error);
    // Retry after 5 seconds
    setTimeout(() => {
      console.log('🔄 Retrying change stream connection...');
      startChangeStreamWorker(db);
    }, 5000);
  }
}

export async function stopChangeStreamWorker(): Promise<void> {
  if (changeStream) {
    await changeStream.close();
    console.log('✓ Change stream worker stopped');
  }
}

export { proximityQueue };
