# System Flow Diagram

## Complete End-to-End Request Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as Backend API
    participant MongoDB
    participant ChangeStream as Change Stream Worker
    participant ProxQueue as Proximity Queue
    participant RecWorker as Recommendation Worker
    participant Bedrock as AWS Bedrock LLM
    participant NotifQueue as Notification Queue
    participant SSE as SSE Registry

    Note over User,SSE: Phase 1: User Submits Context
    User->>Frontend: Clicks "Get Recommendation"
    Frontend->>Frontend: Shows "Loading..." spinner
    
    Frontend->>API: POST /api/context/submit<br/>{position, weather, event, profile}
    
    Note over API,MongoDB: Phase 2: Store Data (Transaction)
    API->>MongoDB: Start Transaction
    API->>MongoDB: Insert customerPosition<br/>(Collection A)
    API->>MongoDB: Insert customerContext<br/>(Collection B)
    MongoDB-->>API: Transaction committed
    API-->>Frontend: 200 OK {"success": true}
    
    Note over MongoDB,RecWorker: Phase 3: Real-time Detection
    MongoDB->>ChangeStream: Change event detected<br/>(new position inserted)
    ChangeStream->>ChangeStream: Extract position data
    
    ChangeStream->>MongoDB: Geospatial Query $near<br/>(find stores within 1km)
    MongoDB-->>ChangeStream: Closest store found<br/>{storeId: "munich_center"}
    
    ChangeStream->>ProxQueue: Enqueue {customerId,<br/>storeId, tabId}
    
    Note over ProxQueue,Bedrock: Phase 4: Generate Recommendation
    ProxQueue->>RecWorker: Pick item from queue
    
    RecWorker->>MongoDB: Query customerContext<br/>by customerId
    MongoDB-->>RecWorker: {weather, event,<br/>customerActivity}
    
    RecWorker->>Bedrock: Generate search context<br/>Prompt: "Generate query for<br/>40°C + heatwave + profile"
    Bedrock-->>RecWorker: "Portable cooling device<br/>for extreme heat..."
    
    RecWorker->>MongoDB: Vector Search (or fallback)<br/>query + storeId filter
    MongoDB-->>RecWorker: Product found:<br/>"Dometic Electric Cooler"
    
    RecWorker->>MongoDB: Get store details<br/>by storeId
    MongoDB-->>RecWorker: Store data
    
    RecWorker->>Bedrock: Generate personalized message<br/>Prompt: "Create message for<br/>product + context + store"
    Bedrock-->>RecWorker: "Hey! With this heatwave<br/>hitting 40°C, you might<br/>love our Cooler..."
    
    RecWorker->>NotifQueue: Enqueue {customerId, tabId,<br/>product, message, store}
    
    Note over NotifQueue,Frontend: Phase 5: Push Notification
    NotifQueue->>SSE: Lookup connection<br/>by customerId-tabId
    SSE->>SSE: Find open connection
    
    SSE->>Frontend: SSE Push: data: {type:<br/>"recommendation", product: {...},<br/>message: "...", store: {...}}
    
    Frontend->>Frontend: Parse notification
    Frontend->>Frontend: Hide loading spinner
    Frontend->>User: Display recommendation<br/>with product, message, store
    
    Note over User,Frontend: User sees personalized recommendation!
```

## Flow Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| **1. User Submission** | ~50ms | Frontend POST to API |
| **2. Store Data** | ~100ms | MongoDB transaction (2 collections) |
| **3. Detection** | ~500ms | Change stream + geo query |
| **4. Recommendation** | ~4-5s | LLM context + search + LLM message |
| **5. Push Notification** | ~50ms | SSE to frontend |
| **Total** | **~5s** | Button click to displayed result |

## Key Points

### 1. Non-blocking API Response
The API returns immediately after storing data. Processing happens asynchronously via workers.

### 2. Real-time Change Detection
MongoDB Change Streams provide instant notification of new positions (no polling required).

### 3. Geospatial Intelligence
The `$near` query uses the 2dsphere index to find stores within 1km radius efficiently.

### 4. Dual LLM Calls
- **First call**: Generates semantic search query from context
- **Second call**: Personalizes the message for the customer

### 5. Queue-based Processing
In-memory queues decouple event detection from processing:
- **Proximity Queue**: Holds customers near stores
- **Notification Queue**: Holds ready recommendations

### 6. SSE Push Architecture
Server maintains open connections and pushes notifications (not HTTP polling).

## Detailed Flow by File

### Frontend
```
src/components/SimulationPanel.tsx
  └─> src/services/api.service.ts (submitContext)
      └─> POST http://localhost:3000/api/context/submit

src/App.tsx (useEffect)
  └─> src/services/api.service.ts (connectSSE)
      └─> EventSource connection to /api/notifications/stream/:id/:tab
          └─> Receives SSE messages
              └─> src/components/RecommendationDisplay.tsx (renders)
```

### Backend
```
src/routes/api.routes.ts (POST /context/submit)
  └─> MongoDB transaction (2 collections)
      
src/workers/changestream.worker.ts
  └─> Watches customerPosition collection
      └─> Executes $near query on stores
          └─> Enqueues to proximityQueue
          
src/workers/recommendation.worker.ts (processes proximityQueue)
  └─> Queries customerContext
      └─> src/services/llm.service.ts (generateSearchContext)
          └─> AWS Bedrock LLM call #1
      └─> src/services/vector-search.service.ts (findBestProduct)
          └─> MongoDB vector search (or fallback)
      └─> src/services/llm.service.ts (generatePersonalizedMessage)
          └─> AWS Bedrock LLM call #2
      └─> Enqueues to notificationQueue
      
src/services/notification.service.ts (processes notificationQueue)
  └─> Looks up SSE connection by customerId-tabId
      └─> Writes to Express Response stream
```

## Alternative View: Data Flow

```mermaid
graph TB
    A[User Input] --> B[Frontend]
    B -->|HTTP POST| C[API Endpoint]
    C -->|Transaction| D[MongoDB Collections]
    D -->|Change Stream| E[Change Stream Worker]
    E -->|$near Query| D
    E -->|Enqueue| F[Proximity Queue]
    F --> G[Recommendation Worker]
    G -->|Query| D
    G -->|LLM Call 1| H[AWS Bedrock]
    H -->|Search Context| G
    G -->|Vector Search| D
    G -->|LLM Call 2| H
    H -->|Personalized Message| G
    G -->|Enqueue| I[Notification Queue]
    I -->|Lookup| J[SSE Registry]
    J -->|Push| B
    B -->|Display| K[User sees result]
    
    style H fill:#ff9900,stroke:#ff6600,stroke-width:2px
    style D fill:#00ed64,stroke:#00684a,stroke-width:2px
    style B fill:#61dafb,stroke:#282c34,stroke-width:2px
```

## Error Handling Flow

```mermaid
flowchart TD
    A[Change Stream Detects Position] --> B{Customer<br/>Near Store?}
    B -->|No| C[No notification sent]
    B -->|Yes| D[Enqueue to Proximity Queue]
    D --> E[Recommendation Worker]
    E --> F{Context<br/>Found?}
    F -->|No| C
    F -->|Yes| G[Generate LLM Context]
    G --> H{LLM<br/>Success?}
    H -->|No| I[Use Fallback Context]
    H -->|Yes| J[Vector Search]
    I --> J
    J --> K{Product<br/>Found?}
    K -->|No| L[Send "No Recommendation"<br/>notification]
    K -->|Yes| M[Generate LLM Message]
    M --> N{LLM<br/>Success?}
    N -->|No| O[Use Generic Message]
    N -->|Yes| P[Enqueue Notification]
    O --> P
    P --> Q[SSE Push to Frontend]
    Q --> R[Display to User]
    L --> Q
    
    style C fill:#ffcccc
    style L fill:#ffffcc
    style R fill:#ccffcc
```

## Performance Bottlenecks

```mermaid
pie title Time Distribution (~5s total)
    "Change Stream Detection" : 10
    "Geo Query" : 2
    "LLM Context Generation" : 40
    "Vector Search/Fallback" : 2
    "LLM Message Generation" : 40
    "Queue & SSE Processing" : 6
```

The two LLM calls account for ~80% of the total time. These can be optimized by:
- Using faster models (e.g., Claude Haiku)
- Caching common contexts
- Pre-generating message templates
- Running LLM calls in parallel where possible

## Concurrent Users Flow

```mermaid
sequenceDiagram
    participant User1
    participant User2
    participant API
    participant ChangeStream
    participant Queue
    participant Worker
    participant SSE

    User1->>API: Submit context
    User2->>API: Submit context
    
    API->>ChangeStream: Position 1 inserted
    API->>ChangeStream: Position 2 inserted
    
    ChangeStream->>Queue: Enqueue User1
    ChangeStream->>Queue: Enqueue User2
    
    par Process User1
        Queue->>Worker: User1 item
        Worker->>Worker: Generate recommendation
        Worker->>SSE: Push to User1
    and Process User2
        Queue->>Worker: User2 item
        Worker->>Worker: Generate recommendation
        Worker->>SSE: Push to User2
    end
    
    SSE->>User1: Show recommendation
    SSE->>User2: Show recommendation
```

The queue-based architecture allows concurrent processing of multiple customers without blocking.

---

**See also:**
- [README.md](README.md) - Setup and overview
- [PLAN.md](PLAN.md) - Detailed architecture
- [STATUS.md](STATUS.md) - Current system state
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
