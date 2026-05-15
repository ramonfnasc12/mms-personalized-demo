import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { SubmitContextRequest } from '../models/types';
import { registerSSEConnection } from '../services/notification.service';

const router = Router();

// POST /api/context/submit
router.post('/context/submit', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      tabId,
      position,
      weather,
      event,
      customerActivity
    } = req.body as SubmitContextRequest;

    // Validate required fields
    if (!customerId || !tabId || !position || !weather || !event || !customerActivity) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const db = getDatabase();
    const session = db.client.startSession();

    try {
      await session.withTransaction(async () => {
        // Insert into customerPosition (triggers change stream)
        await db.collection('customerPosition').insertOne(
          {
            customerId,
            tabId,
            position,
            timestamp: new Date()
          },
          { session }
        );

        // Insert into customerContext
        await db.collection('customerContext').insertOne(
          {
            customerId,
            customerActivity,
            weather,
            event,
            timestamp: new Date()
          },
          { session }
        );
      });

      console.log(`✓ Context submitted for customer ${customerId}, tab ${tabId}`);

      res.json({
        success: true,
        message: 'Context submitted successfully'
      });
    } catch (error) {
      console.error('Transaction error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit context'
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('Submit context error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/notifications/stream/:customerId/:tabId
router.get('/notifications/stream/:customerId/:tabId', (req: Request, res: Response) => {
  const { customerId, tabId } = req.params;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Register connection
  registerSSEConnection(customerId, tabId, res);

  // Send initial connection confirmation
  res.write(': connected\n\n');
});

// GET /api/stores (optional - for debugging)
router.get('/stores', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const stores = await db.collection('stores').find({}).toArray();

    res.json({
      success: true,
      stores
    });
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve stores'
    });
  }
});

// GET /api/health (health check)
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
