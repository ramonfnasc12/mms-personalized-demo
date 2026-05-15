# MMS Demo - Comprehensive Implementation Plan

## Executive Summary

This demo showcases **contextualization over personalization** for MediaMarktSaturn Tech Summit (June 18, 2026). The system processes real-time customer location, weather conditions, and local events to deliver relevant product recommendations using MongoDB Atlas, AWS Bedrock, and real-time event streaming.

## Architecture Overview

```
Frontend (React + TypeScript)
    ↓ HTTP POST
API Server (Node.js + Express)
    ↓ MongoDB Transaction
[customerPosition] + [customerContext] Collections
    ↓ Change Stream (geo-proximity check)
Proximity Queue (in-memory)
    ↓ Worker processes
Recommendation Worker
    ↓ Queries: customerContext + Vector Search
    ↓ LLM: Context Generation + Message Personalization
Notification Queue (in-memory)
    ↓ SSE Connection Registry
Frontend receives real-time recommendation
```

## Technology Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB Atlas (Cluster0)
- **LLM**: AWS Bedrock (Claude 3.5 Sonnet)
- **Embeddings**: MongoDB Auto-Embedding (Voyage-4)
- **Real-time**: Server-Sent Events (SSE)
- **Queues**: In-memory (no external dependencies)

### Frontend
- **Framework**: React with TypeScript
- **Bundler**: Vite
- **Styling**: MediaMarkt color scheme
- **API Communication**: Fetch API + EventSource (SSE)

### MongoDB Features
- Change Streams (real-time position monitoring)
- Geospatial Queries (2dsphere index, $near)
- Vector Search with Auto-Embedding (Voyage-4 model)
- Transactions (atomic writes)
- Views (computed searchableText field)

## Database Design

### Database: `mms_demo`

### Collection: `customerPosition` (Collection A)
```typescript
{
  _id: ObjectId,
  customerId: string,           // UUID from frontend
  position: {                   // GeoJSON Point
    type: "Point",
    coordinates: [longitude, latitude]
  },
  timestamp: Date
}
```
**Indexes:**
- None required (small, temporary data)

### Collection: `customerContext` (Collection B)
```typescript
{
  _id: ObjectId,
  customerId: string,
  customerActivity: {
    profile: string,            // e.g., "tech_enthusiast"
    recentViews: string[],      // Product names
    recentPurchases: string[],
    cartItems: string[]
  },
  weather: {
    condition: string,          // e.g., "sunny", "rainy"
    temperature: number,        // Celsius
    label: string               // Display label with emoji
  },
  event: {
    type: string,               // e.g., "football_match"
    label: string,
    description: string
  },
  timestamp: Date
}
```
**Indexes:**
- `customerId` (for quick lookup)

### Collection: `stores`
```typescript
{
  _id: ObjectId,
  storeId: string,              // e.g., "munich_1"
  name: string,                 // e.g., "MediaMarkt München Hauptbahnhof"
  position: {                   // GeoJSON Point
    type: "Point",
    coordinates: [longitude, latitude]
  },
  address: {
    street: string,
    city: string,
    postalCode: string,
    country: string
  }
}
```
**Indexes:**
- 2dsphere index on `position` (for geo-proximity queries)

**Store Locations (8-12 stores in major German cities):**
- Berlin (2-3 stores)
- Munich (2 stores)
- Hamburg (1 store)
- Frankfurt (1 store)
- Cologne (1 store)
- Stuttgart (1 store)
- Düsseldorf (1 store)

### Collection: `products`
```typescript
{
  _id: ObjectId,
  productId: string,
  name: string,
  description: string,
  price: number,                // Euro
  category: string,             // e.g., "cooling", "heating", "audio"
  inventory: [
    {
      storeId: string,
      quantity: number
    }
  ]
}
```
**Indexes:**
- None on base collection (queries via view)

**Product Categories (40-60 products):**
- **Weather-contextual (~25 products)**:
  - Hot weather: fans, air conditioners, coolers, portable fridges
  - Cold weather: heaters, electric blankets, weather stations
  - Rainy: umbrellas, waterproof speakers, indoor entertainment
- **Event-contextual (~25 products)**:
  - Sports events: TVs, soundbars, projectors, party speakers
  - Festivals/concerts: portable chargers, cameras, headphones
  - Holiday events: smart home decorations, gift electronics
- **General electronics (~10 products)**:
  - Smartphones, laptops, tablets

### View: `products_searchable`
```javascript
db.createCollection("products_searchable", {
  viewOn: "products",
  pipeline: [
    {
      $set: {
        searchableText: { 
          $concat: ["$name", " - ", "$description"] 
        }
      }
    }
  ]
});
```

**Vector Search Index on View:**
```javascript
// Index name: products_vector_index
{
  "fields": [
    {
      "type": "autoEmbed",
      "modality": "text",
      "path": "searchableText",
      "model": "voyage-4"
    }
  ]
}
```

## API Endpoints

### POST `/api/context/submit`
**Purpose**: Submit customer context (position + metadata)

**Request Body:**
```typescript
{
  customerId: string,
  tabId: string,
  position: {
    type: "Point",
    coordinates: [longitude, latitude]
  },
  weather: {
    condition: string,
    temperature: number,
    label: string
  },
  event: {
    type: string,
    label: string,
    description: string
  },
  customerActivity: {
    profile: string,
    recentViews: string[],
    recentPurchases: string[],
    cartItems: string[]
  }
}
```

**Response:**
```typescript
{
  success: boolean,
  message: string
}
```

**Implementation:**
- Validates input
- Uses MongoDB transaction to write to both collections atomically
- Returns immediately (async processing via change stream)

### GET `/api/notifications/stream/:customerId/:tabId`
**Purpose**: SSE endpoint for real-time recommendations

**Response Stream:**
```typescript
// On recommendation found
data: {
  type: "recommendation",
  product: {
    productId: string,
    name: string,
    description: string,
    price: number
  },
  store: {
    storeId: string,
    name: string,
    distance: number  // meters
  },
  message: string,      // Personalized LLM-generated message
  score: number         // Vector search score
}

// On no recommendation found
data: {
  type: "no_recommendation",
  message: "No nearby offers right now."
}

// Keepalive (every 30s)
: keepalive
```

**Implementation:**
- Sets SSE headers
- Registers connection in SSE registry
- Sends keepalive every 30s
- Cleanup on disconnect

### GET `/api/stores` (Optional - for debugging)
**Purpose**: List all stores

**Response:**
```typescript
{
  stores: Array<{
    storeId: string,
    name: string,
    position: GeoJSON,
    address: {...}
  }>
}
```

## Frontend Design

### Component Structure
```
App.tsx
  └─ SimulationPanel.tsx
      ├─ Selector.tsx (Weather)
      ├─ Selector.tsx (Event)
      ├─ Selector.tsx (Position)
      ├─ Selector.tsx (Activity Profile)
      └─ Submit Button
  └─ RecommendationDisplay.tsx
      └─ Shows product recommendation or loading state
```

### Generic Selector Component
```typescript
interface SelectorProps<T> {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

export function Selector<T>({ label, options, value, onChange }: SelectorProps<T>) {
  return (
    <div className="selector">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### Dropdown Options

#### Weather Options
```typescript
const weatherOptions = [
  { value: 'hot_sunny', label: '☀️ Hot & Sunny (35°C)', temp: 35, condition: 'sunny' },
  { value: 'cold_winter', label: '❄️ Cold Winter (-5°C)', temp: -5, condition: 'snowing' },
  { value: 'rainy', label: '🌧️ Rainy (15°C)', temp: 15, condition: 'rainy' },
  { value: 'mild_cloudy', label: '☁️ Mild & Cloudy (18°C)', temp: 18, condition: 'cloudy' },
  { value: 'storm', label: '⛈️ Thunderstorm (22°C)', temp: 22, condition: 'stormy' },
  { value: 'heatwave', label: '🔥 Extreme Heat (40°C)', temp: 40, condition: 'extreme_heat' }
];
```

#### Event Options
```typescript
const eventOptions = [
  { value: 'none', label: 'No special events', description: 'Regular day' },
  { value: 'football_match', label: '⚽ Major Football Match', description: 'Bayern Munich vs. Borussia Dortmund today' },
  { value: 'music_festival', label: '🎵 Music Festival', description: 'Rock am Ring this weekend' },
  { value: 'christmas_market', label: '🎄 Christmas Market', description: 'Local Weihnachtsmarkt open' },
  { value: 'oktoberfest', label: '🍺 Oktoberfest', description: 'Munich beer festival ongoing' },
  { value: 'euro_championship', label: '🏆 UEFA Euro 2026', description: 'Germany hosting matches' },
  { value: 'fifa_world_cup', label: '⚽ FIFA World Cup 2026', description: 'World Cup tournament ongoing' },
  { value: 'heatwave_warning', label: '🌡️ Heatwave Alert', description: 'Official heat warning issued' },
  { value: 'camping_season', label: '🏕️ Summer Holiday Season', description: 'Peak camping/outdoor season' }
];
```

#### Position Options
```typescript
const positionOptions = [
  // Near stores
  { value: 'near_munich_1', label: '📍 Near MediaMarkt Munich Center', lat: 48.1374, lon: 11.5755, nearStore: 'munich_1' },
  { value: 'near_berlin_1', label: '📍 Near MediaMarkt Berlin Alexanderplatz', lat: 52.5219, lon: 13.4132, nearStore: 'berlin_1' },
  { value: 'near_hamburg_1', label: '📍 Near MediaMarkt Hamburg', lat: 53.5511, lon: 9.9937, nearStore: 'hamburg_1' },
  // Add more for each store...
  
  // Far from stores
  { value: 'rural_bavaria', label: '🏞️ Rural Bavaria (no nearby stores)', lat: 47.8513, lon: 11.1236, nearStore: null },
  { value: 'far_from_all', label: '🚗 Driving between cities', lat: 50.1109, lon: 8.6821, nearStore: null }
];
```

#### Activity Profile Options
```typescript
const activityProfiles = [
  {
    value: 'tech_enthusiast',
    label: '💻 Tech Enthusiast',
    recentViews: ['iPhone 15 Pro', 'MacBook Pro', 'AirPods Pro'],
    recentPurchases: ['USB-C Cable', 'Phone Case'],
    cartItems: ['iPad Air']
  },
  {
    value: 'home_entertainment',
    label: '📺 Home Entertainment Seeker',
    recentViews: ['65" OLED TV', 'Soundbar', 'Gaming Console'],
    recentPurchases: ['HDMI Cable'],
    cartItems: ['Universal Remote']
  },
  {
    value: 'outdoor_adventurer',
    label: '🏕️ Outdoor Adventurer',
    recentViews: ['Portable Speaker', 'Power Bank', 'Action Camera'],
    recentPurchases: ['Waterproof Phone Case'],
    cartItems: []
  },
  {
    value: 'smart_home',
    label: '🏠 Smart Home Builder',
    recentViews: ['Smart Thermostat', 'Security Camera', 'Smart Lights'],
    recentPurchases: ['Smart Plug'],
    cartItems: ['Voice Assistant']
  },
  {
    value: 'first_time_buyer',
    label: '🆕 First Time Visitor',
    recentViews: [],
    recentPurchases: [],
    cartItems: []
  }
];
```

### Customer ID Management
```typescript
// Generates or retrieves UUID from sessionStorage
const getOrCreateCustomerId = (): string => {
  let customerId = sessionStorage.getItem('customerId');
  if (!customerId) {
    customerId = crypto.randomUUID();
    sessionStorage.setItem('customerId', customerId);
  }
  return customerId;
};

// Each tab gets unique tabId for independent SSE connections
const getOrCreateTabId = (): string => {
  let tabId = sessionStorage.getItem('tabId');
  if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem('tabId', tabId);
  }
  return tabId;
};
```

### SSE Connection
```typescript
useEffect(() => {
  const customerId = getOrCreateCustomerId();
  const tabId = getOrCreateTabId();
  const eventSource = new EventSource(`/api/notifications/stream/${customerId}/${tabId}`);
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'recommendation') {
      setRecommendation(data);
      setLoading(false);
    } else if (data.type === 'no_recommendation') {
      setNoRecommendation(true);
      setLoading(false);
    }
  };
  
  eventSource.onerror = () => {
    console.error('SSE connection error');
  };
  
  return () => eventSource.close();
}, []);
```

## Backend Implementation

### Project Structure
```
backend/
├── src/
│   ├── config/
│   │   └── database.ts              # MongoDB connection
│   ├── models/
│   │   └── types.ts                 # TypeScript interfaces
│   ├── services/
│   │   ├── llm.service.ts           # AWS Bedrock LLM
│   │   ├── vector-search.service.ts # MongoDB vector search
│   │   └── notification.service.ts  # SSE registry
│   ├── queues/
│   │   └── InMemoryQueue.ts         # Queue implementation
│   ├── workers/
│   │   ├── changestream.worker.ts   # Watches customerPosition
│   │   └── recommendation.worker.ts # Processes recommendations
│   ├── routes/
│   │   └── api.routes.ts            # Express routes
│   └── server.ts                    # Main entry point
├── scripts/
│   └── setup-database.ts            # Database initialization
├── package.json
├── tsconfig.json
└── .env.example
```

### In-Memory Queue Implementation
```typescript
export class InMemoryQueue<T> {
  private queue: T[] = [];
  private processing = false;
  
  constructor(private handler: (item: T) => Promise<void>) {}
  
  enqueue(item: T): void {
    this.queue.push(item);
    this.process();
  }
  
  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        await this.handler(item);
      } catch (error) {
        console.error('Queue processing error:', error);
        // Log and continue (don't crash worker)
      }
    }
    
    this.processing = false;
  }
}

// Usage
const proximityQueue = new InMemoryQueue<{customerId: string, storeId: string, tabId: string}>(
  async (item) => await processProximityEvent(item)
);

const notificationQueue = new InMemoryQueue<{customerId: string, tabId: string, product: any, message: string, store: any}>(
  async (item) => await sendNotificationToFrontend(item)
);
```

### Change Stream Worker
```typescript
export async function startChangeStreamWorker(db: Db) {
  const pipeline = [
    {
      $match: {
        operationType: 'insert',
        'fullDocument.position': { $exists: true }
      }
    }
  ];
  
  const changeStream = db.collection('customerPosition').watch(pipeline);
  
  changeStream.on('change', async (change) => {
    const { customerId, position, tabId } = change.fullDocument;
    
    // Find stores within 1km using geospatial query
    const nearbyStores = await db.collection('stores').find({
      position: {
        $near: {
          $geometry: position,
          $maxDistance: 1000  // 1km in meters
        }
      }
    }).limit(1).toArray();
    
    if (nearbyStores.length > 0) {
      const closestStore = nearbyStores[0];
      proximityQueue.enqueue({ 
        customerId, 
        storeId: closestStore.storeId,
        tabId
      });
    } else {
      // No nearby stores - notify frontend
      notificationQueue.enqueue({
        customerId,
        tabId,
        type: 'no_recommendation',
        message: 'No nearby offers right now.'
      });
    }
  });
  
  changeStream.on('error', (error) => {
    console.error('Change stream error:', error);
    // Attempt reconnect after 5s
    setTimeout(() => startChangeStreamWorker(db), 5000);
  });
}
```

### Recommendation Worker
```typescript
async function processProximityEvent(item: ProximityEvent) {
  const { customerId, storeId, tabId } = item;
  
  // 1. Get customer context from collection B
  const context = await db.collection('customerContext')
    .findOne({ customerId }, { sort: { timestamp: -1 } });
  
  if (!context) {
    console.error('No context found for customer:', customerId);
    return;
  }
  
  // 2. Generate search context using LLM
  const searchQuery = await generateSearchContext(context);
  
  // 3. Vector search for best product in stock at this store
  const product = await findBestProduct(searchQuery, storeId);
  
  if (!product) {
    notificationQueue.enqueue({
      customerId,
      tabId,
      type: 'no_recommendation',
      message: 'No matching products in stock nearby.'
    });
    return;
  }
  
  // 4. Generate personalized message using LLM
  const message = await generatePersonalizedMessage(product, context, storeId);
  
  // 5. Get store details
  const store = await db.collection('stores').findOne({ storeId });
  
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
}
```

### LLM Service (AWS Bedrock)
```typescript
import { BedrockChat } from "@langchain/aws";

const llm = new BedrockChat({
  region: process.env.AWS_REGION!,
  model: process.env.BEDROCK_TEXT_MODEL!,
});

export async function generateSearchContext(context: CustomerContext): Promise<string> {
  const prompt = `Generate a concise product search query (2-3 sentences) based on:
- Weather: ${context.weather.condition}, ${context.weather.temperature}°C
- Event: ${context.event.description}
- Customer recently viewed: ${context.customerActivity.recentViews.join(', ')}
- Customer purchased: ${context.customerActivity.recentPurchases.join(', ')}

Focus on what product category would be most relevant right now. Be specific about features that matter for this context.

Example output: "Portable cooling device suitable for extreme heat. Should be energy-efficient and easy to transport. Customer interested in electronics."`;

  const response = await llm.invoke(prompt);
  return response.content as string;
}

export async function generatePersonalizedMessage(
  product: any,
  context: CustomerContext,
  storeId: string
): Promise<string> {
  const store = await db.collection('stores').findOne({ storeId });
  
  const prompt = `You are a friendly MediaMarktSaturn sales assistant. Create a personalized notification (2-3 sentences) recommending this product:

Product: ${product.name}
Description: ${product.description}
Price: €${product.price}
Store: ${store.name}

Context:
- Weather: ${context.weather.label}
- Event: ${context.event.label}
- Customer profile: ${context.customerActivity.profile}

Make it conversational, mention why this product is perfect right now, and that it's in stock nearby. Don't be pushy.

Example: "Hey! With this heatwave hitting 40°C, you might love our Dyson Cool Tower Fan. It's in stock at MediaMarkt Munich Center, just 500m away. Stay cool! 🌬️"`;

  const response = await llm.invoke(prompt);
  return response.content as string;
}
```

### Vector Search Service
```typescript
export async function findBestProduct(searchQuery: string, storeId: string): Promise<any> {
  const pipeline = [
    {
      $vectorSearch: {
        index: "products_vector_index",
        path: "searchableText",
        query: searchQuery,
        model: "voyage-4",
        numCandidates: 100,
        limit: 10
      }
    },
    {
      $project: {
        _id: 0,
        productId: 1,
        name: 1,
        description: 1,
        price: 1,
        inventory: 1,
        searchableText: 1,
        score: { $meta: "vectorSearchScore" }
      }
    },
    {
      $match: {
        'inventory': {
          $elemMatch: {
            storeId: storeId,
            quantity: { $gt: 0 }
          }
        }
      }
    },
    { $limit: 1 }
  ];
  
  const results = await db.collection('products_searchable').aggregate(pipeline).toArray();
  return results[0] || null;
}
```

### SSE Notification Service
```typescript
// SSE connection registry
const sseConnectionRegistry = new Map<string, Response>();

export function registerSSEConnection(customerId: string, tabId: string, res: Response) {
  const key = `${customerId}-${tabId}`;
  sseConnectionRegistry.set(key, res);
  
  // Keepalive every 30s
  const keepalive = setInterval(() => {
    if (sseConnectionRegistry.has(key)) {
      res.write(': keepalive\n\n');
    } else {
      clearInterval(keepalive);
    }
  }, 30000);
  
  // Cleanup on disconnect
  res.on('close', () => {
    clearInterval(keepalive);
    sseConnectionRegistry.delete(key);
  });
}

export function sendNotificationToFrontend(item: NotificationItem) {
  const key = `${item.customerId}-${item.tabId}`;
  const connection = sseConnectionRegistry.get(key);
  
  if (connection) {
    connection.write(`data: ${JSON.stringify(item)}\n\n`);
  } else {
    console.warn('No SSE connection found for:', key);
  }
}
```

### API Routes
```typescript
// POST /api/context/submit
router.post('/context/submit', async (req, res) => {
  const { customerId, tabId, position, weather, event, customerActivity } = req.body;
  
  const session = client.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Insert into customerPosition (triggers change stream)
      await db.collection('customerPosition').insertOne({
        customerId,
        tabId,
        position,
        timestamp: new Date()
      }, { session });
      
      // Insert into customerContext
      await db.collection('customerContext').insertOne({
        customerId,
        customerActivity,
        weather,
        event,
        timestamp: new Date()
      }, { session });
    });
    
    res.json({ success: true, message: 'Context submitted' });
  } catch (error) {
    console.error('Transaction error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit context' });
  } finally {
    await session.endSession();
  }
});

// GET /api/notifications/stream/:customerId/:tabId
router.get('/notifications/stream/:customerId/:tabId', (req, res) => {
  const { customerId, tabId } = req.params;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  registerSSEConnection(customerId, tabId, res);
});
```

## Environment Variables

### `.env.example`
```bash
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/
MONGODB_DATABASE=mms_demo

# AWS Bedrock Configuration
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
BEDROCK_TEXT_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0

# Application Configuration
NODE_ENV=development
PORT=3000
FRONTEND_PORT=5173
```

## Database Setup Script

### `backend/scripts/setup-database.ts`

**Purpose**: Initialize database with collections, indexes, views, and seed data

**Steps:**
1. Connect to MongoDB using MONGODB_URI
2. Drop existing collections (clean slate)
3. Create collections with schema validation
4. Create indexes:
   - 2dsphere index on `stores.position`
   - Index on `customerContext.customerId`
5. Create view `products_searchable` with `$set` pipeline
6. Create vector search index `products_vector_index` on view
7. Seed stores collection (8-12 stores in German cities)
8. Seed products collection (40-60 products with inventory)
9. Print summary

**Run command**: `npm run setup` or `ts-node scripts/setup-database.ts`

**Idempotent**: Can run multiple times safely (drops and recreates)

## Error Handling Strategy

### MongoDB Connection
- Fails → Log error, exit process with code 1

### Change Stream
- Error → Log, attempt reconnect after 5s

### LLM Calls
- Fail → Log, send generic fallback message to customer
- Timeout → Retry once, then fallback

### Vector Search
- No results → SSE notifies "no recommendations found"
- Error → Log, notify customer

### Queue Processing
- Error → Log and continue (don't crash worker)
- No retry logic (demo simplicity)

### SSE Connection
- Close → Remove from registry
- Write error → Catch and log (connection may be dead)

## Implementation Steps

### Phase 1: Database Setup
1. Create `backend/scripts/setup-database.ts`
2. Implement MongoDB connection
3. Create collections with schema
4. Create indexes (2dsphere on stores)
5. Create view `products_searchable`
6. Create vector search index via MongoDB Atlas UI or MCP
7. Seed stores collection with German city data
8. Seed products collection with contextual products
9. Test: Run script, verify collections/indexes exist

### Phase 2: Backend Core
1. Setup Express server with TypeScript
2. Implement MongoDB connection in `config/database.ts`
3. Define TypeScript interfaces in `models/types.ts`
4. Implement `InMemoryQueue` class
5. Create API routes (context submit, SSE stream)
6. Implement SSE connection registry
7. Test: POST to submit endpoint, verify data in collections

### Phase 3: Workers
1. Implement change stream worker
2. Test: Insert position manually, verify proximity detection
3. Implement recommendation worker (LLM + vector search)
4. Connect queues: proximity → recommendation → notification
5. Test: Full flow from position insert to SSE notification

### Phase 4: LLM Integration
1. Setup AWS Bedrock credentials
2. Implement `llm.service.ts` with LangChain
3. Implement context generation prompt
4. Implement message personalization prompt
5. Test: Generate contexts for different scenarios

### Phase 5: Frontend
1. Create React app with Vite
2. Implement generic `Selector` component
3. Create dropdown options data files
4. Implement `SimulationPanel` with all selectors
5. Implement customer ID/tab ID management
6. Implement SSE connection
7. Implement `RecommendationDisplay` component
8. Style with MediaMarkt color scheme
9. Test: Full end-to-end flow

### Phase 6: Integration Testing
1. Test multiple scenarios (hot weather + music festival, etc.)
2. Test multiple concurrent customers (multiple tabs)
3. Test edge cases (no nearby stores, no matching products)
4. Test error scenarios (LLM timeout, connection loss)

### Phase 7: Demo Preparation
1. Create sample scenarios for presentation
2. Document test cases
3. Create demo script/walkthrough
4. Deploy (if needed) or run locally

## Testing Scenarios

### Scenario 1: Heatwave + Near Store
- **Input**: Position near Munich store, 40°C weather, no events, tech enthusiast
- **Expected**: Recommend cooling product (fan, AC) with personalized message
- **Time**: ~2-3 seconds from submit to SSE notification

### Scenario 2: Football Match + Home Entertainment Profile
- **Input**: Near Berlin store, mild weather, football match event, home entertainment profile
- **Expected**: Recommend TV or soundbar with sports-themed message

### Scenario 3: No Nearby Store
- **Input**: Rural location, any context
- **Expected**: SSE notification "No nearby offers right now"

### Scenario 4: Out of Stock
- **Input**: Near store but all relevant products out of stock
- **Expected**: SSE notification "No matching products in stock nearby"

### Scenario 5: Multiple Customers
- **Input**: Two browser tabs, different customers, different contexts
- **Expected**: Each receives independent recommendations

## Performance Expectations

- **API Response Time**: < 100ms (submit endpoint)
- **Change Stream Latency**: < 500ms (position to proximity detection)
- **LLM Context Generation**: 1-2 seconds
- **Vector Search**: < 200ms
- **LLM Message Generation**: 1-2 seconds
- **Total Flow**: 3-5 seconds (submit to notification)

## Cost Estimates (per demo session)

### MongoDB Atlas
- Free tier sufficient for demo (M0)
- Auto-embedding: $0.06/1M tokens (Voyage-4)
- ~100 queries × 50 tokens = 5,000 tokens = $0.0003

### AWS Bedrock
- Claude 3.5 Sonnet: ~$3/1M input tokens, ~$15/1M output tokens
- 100 LLM calls × 500 tokens avg = 50,000 tokens = ~$0.15-0.75

**Total**: < $1 per demo session

## Deployment Considerations

### Local Development
- Run backend: `cd backend && npm run dev`
- Run frontend: `cd frontend && npm run dev`
- Setup: `cd backend && npm run setup`

### Production (if needed)
- Backend: Deploy to AWS Lambda, Render, or Heroku
- Frontend: Deploy to Vercel, Netlify, or CloudFlare Pages
- Environment variables via platform secrets
- MongoDB connection string with IP whitelist (0.0.0.0/0 for demo)

## Risks and Mitigations

### Risk: LLM timeout during demo
- **Mitigation**: Implement 10s timeout with fallback generic message

### Risk: Change stream connection drops
- **Mitigation**: Auto-reconnect logic with exponential backoff

### Risk: Vector search returns irrelevant products
- **Mitigation**: Curate product catalog carefully with clear descriptions

### Risk: Multiple customers overwhelm in-memory queues
- **Mitigation**: Demo scope is 5-10 concurrent users max, queues handle this

### Risk: SSE connection closes unexpectedly
- **Mitigation**: Frontend detects connection loss, shows error message

## Future Enhancements (Post-Demo)

1. **Persistent Queues**: Replace in-memory with Redis/SQS
2. **Real Weather API**: Integrate OpenWeatherMap or similar
3. **Real Events API**: Integrate Ticketmaster or local events
4. **Mobile Geolocation**: Use actual device GPS instead of dropdown
5. **Product Images**: Add images to recommendations
6. **Analytics Dashboard**: Track recommendation success rates
7. **A/B Testing**: Compare personalization vs contextualization
8. **Multi-language**: Support German/English UI

## MongoDB Features Showcased

1. **Change Streams**: Real-time position monitoring
2. **Geospatial Queries**: $near with 2dsphere index
3. **Vector Search**: Semantic product search with auto-embedding
4. **Views**: Computed searchableText field
5. **Transactions**: Atomic multi-collection writes
6. **Aggregation Pipeline**: Complex vector search + filtering
7. **Auto-Embedding**: No manual embedding generation/storage

## Key Demo Talking Points

1. **Real-Time**: "Position updates trigger instant proximity detection via Change Streams"
2. **Contextualization**: "Not just 'you bought a TV' - it's 'it's 40°C and you're near a store'"
3. **AI-Powered**: "LLM generates search context, vector search finds best match"
4. **Personalized**: "Custom message considers weather, events, and customer history"
5. **Scalable**: "MongoDB handles geo queries, vector search, and real-time events in one platform"
6. **No Data Silos**: "All data (positions, context, products, stores) in one operational data layer"

## Success Metrics

- Demo runs without crashes
- Recommendations arrive within 5 seconds
- Recommendations are contextually relevant
- Audience understands the architecture
- Showcases MongoDB's real-time + AI capabilities

---

**Next Steps**: Implement Phase 1 (Database Setup) using MongoDB MCP Server to create collections, indexes, and seed data.
