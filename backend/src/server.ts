import express from 'express';
import * as dotenv from 'dotenv';
import { connectToDatabase, closeDatabase } from './config/database';
import apiRoutes from './routes/api.routes';
import { startChangeStreamWorker, stopChangeStreamWorker } from './workers/changestream.worker';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'MMS Demo Backend API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      submitContext: 'POST /api/context/submit',
      notifications: 'GET /api/notifications/stream/:customerId/:tabId',
      stores: 'GET /api/stores'
    }
  });
});

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    const db = await connectToDatabase();

    // Start change stream worker
    await startChangeStreamWorker(db);

    // Start Express server
    app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ API endpoints available at http://localhost:${PORT}/api`);
      console.log(`✓ Workers active: Change Stream + Recommendation`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await stopChangeStreamWorker();
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await stopChangeStreamWorker();
  await closeDatabase();
  process.exit(0);
});

startServer();
