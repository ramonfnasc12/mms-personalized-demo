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
    C -->|Transaction| D[(MongoDB)]
    D -->|Change Stream| E[Change Stream Worker]
    E -->|near Query| D
    E -->|Enqueue| F[Proximity Queue]
    F --> G[Recommendation Worker]
    G -->|Query| D
    G -->|LLM Call 1| H[AWS Bedrock]
    H -->|Search Context| G
    G -->|Vector Search| D
    G -->|LLM Call 2| H
    H -->|Personalized Msg| G
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
    A[Change Stream Detects Position] --> B{Customer Near Store?}
    B -->|No| C[No notification sent]
    B -->|Yes| D[Enqueue to Proximity Queue]
    D --> E[Recommendation Worker]
    E --> F{Context Found?}
    F -->|No| C
    F -->|Yes| G[Generate LLM Context]
    G --> H{LLM Success?}
    H -->|No| I[Use Fallback Context]
    H -->|Yes| J[Vector Search]
    I --> J
    J --> K{Product Found?}
    K -->|No| L[Send No Recommendation]
    K -->|Yes| M[Generate LLM Message]
    M --> N{LLM Success?}
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
pie title Time Distribution - 5s total
    "Change Stream Detection" : 10
    "Geo Query" : 2
    "LLM Context Generation" : 40
    "Vector Search Fallback" : 2
    "LLM Message Generation" : 40
    "Queue and SSE Processing" : 6
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

## AWS Deployment Architecture

The production deployment uses AWS services with MongoDB Atlas PrivateLink for secure, low-latency connectivity.

```mermaid
graph TB
    subgraph Internet
        Users[Users / Browser]
    end

    subgraph AWS["AWS us-east-1"]
        subgraph CloudFront["CloudFront HTTPS"]
            CF[Distribution]
        end

        subgraph S3["S3 Bucket"]
            Static[React SPA]
        end

        subgraph VPC["VPC 10.0.0.0/16"]
            subgraph PublicSubnets["Public Subnets 2 AZs"]
                ALB[Application Load Balancer]
                subgraph ECS["ECS Fargate"]
                    Task[Backend Container]
                end
            end
            subgraph PrivateLink["PrivateLink Endpoint"]
                VPCE[VPC Endpoint]
            end
        end
    end

    subgraph Atlas["MongoDB Atlas M30"]
        Cluster[Cluster Main]
        VS[Vector Search Voyage-4]
    end

    subgraph Bedrock["AWS Bedrock"]
        LLM[Claude Sonnet]
    end

    Users -->|HTTPS| CF
    CF -->|static assets| S3
    CF -->|/api proxy| ALB
    ALB --> Task
    Task -->|PrivateLink| VPCE
    VPCE -->|Private Network| Cluster
    Cluster --- VS
    Task -->|API Call| LLM

    style CF fill:#9b59b6,stroke:#8e44ad,color:#fff
    style S3 fill:#e67e22,stroke:#d35400,color:#fff
    style ALB fill:#3498db,stroke:#2980b9,color:#fff
    style Task fill:#2ecc71,stroke:#27ae60,color:#fff
    style VPCE fill:#1abc9c,stroke:#16a085,color:#fff
    style Cluster fill:#00ed64,stroke:#00684a,color:#fff
    style LLM fill:#ff9900,stroke:#ff6600,color:#fff
```

### Deployment Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant ECR as AWS ECR
    participant CF as CloudFormation
    participant ECS as ECS Fargate
    participant S3 as S3 Bucket
    participant CDN as CloudFront
    participant Atlas as MongoDB Atlas

    Note over Dev,Atlas: Initial Deploy ./infra/deploy.sh
    Dev->>ECR: 1. Create repo + push Docker image
    Dev->>CF: 2. Deploy stack (VPC, ALB, ECS, S3, CDN)
    CF-->>Dev: Stack outputs (URLs, bucket name)
    Dev->>S3: 3. Build frontend + upload to S3
    Dev->>Atlas: 4. Setup PrivateLink
    Atlas-->>Dev: Connection available
    Dev->>ECS: 5. Scale to 1 task

    Note over Dev,Atlas: Redeploy (./infra/redeploy.sh)
    Dev->>ECR: Push new image
    Dev->>ECS: Force new deployment (~60s)
    Dev->>S3: Sync new frontend build
    Dev->>CDN: Invalidate cache (~30s)
```

### Network Security

```mermaid
flowchart LR
    subgraph Public["Public Internet"]
        User[End User]
    end

    subgraph Edge["AWS Edge"]
        CF[CloudFront HTTPS]
    end

    subgraph VPC["Private VPC"]
        ALB[ALB]
        ECS[ECS Task]
        VPCE[VPC Endpoint]
    end

    subgraph AtlasNet["Atlas Network"]
        PES[PE Service]
        DB[(MongoDB)]
    end

    User -->|HTTPS 443| CF
    CF -->|HTTP 80| ALB
    ALB -->|Port 3000| ECS
    ECS -->|Port 27017| VPCE
    VPCE ===|PrivateLink| PES
    PES --> DB

    style CF fill:#9b59b6,color:#fff
    style VPCE fill:#1abc9c,color:#fff
    style PES fill:#1abc9c,color:#fff
    style DB fill:#00ed64,color:#fff
```

Key security properties:
- **No public MongoDB access** — Atlas cluster has no 0.0.0.0/0 in the IP access list
- **Traffic stays on AWS backbone** — PrivateLink uses AWS internal network, never traversing the internet
- **HTTPS everywhere** — CloudFront terminates TLS; backend communication is VPC-internal
- **No exposed credentials** — Secrets read from `.env` at deploy time, injected as ECS environment variables

## Production Architecture

In a production deployment, the system operates as an event-driven pipeline triggered by real-time mobile device location updates. Each stage is decoupled through message queues, enabling independent scaling and fault tolerance.

### Production Flow

```mermaid
sequenceDiagram
    participant Mobile as Mobile App
    participant API as API Gateway
    participant Q1 as Position Queue
    participant W1 as Proximity Worker
    participant MongoDB as MongoDB Atlas
    participant Q2 as Recommendation Queue
    participant W2 as Recommendation Worker
    participant Profile as Customer Profile Service
    participant Events as Local Events Service
    participant Weather as Weather Service
    participant LLM as LLM Service
    participant Q3 as Notification Queue
    participant W3 as Notification Worker

    Note over Mobile,W3: Phase 1 - Position Ingestion
    Mobile->>API: Send position (every 1km moved)
    API->>Q1: Enqueue position event

    Note over Q1,MongoDB: Phase 2 - Proximity Detection
    Q1->>W1: Trigger proximity worker
    W1->>MongoDB: Geospatial query - any store within 1km?
    MongoDB-->>W1: Nearest store found
    W1->>Q2: Enqueue customerId + position + storeId

    Note over Q2,LLM: Phase 3 - Recommendation Generation
    Q2->>W2: Trigger recommendation worker
    W2->>Profile: Get customer profile
    Profile-->>W2: Preferences, history, segments
    W2->>Events: Get local events near position
    Events-->>W2: Matching events for profile
    W2->>Weather: Get weather at position
    Weather-->>W2: Current conditions
    W2->>LLM: Generate semantic search query from context
    LLM-->>W2: Optimized search query
    W2->>MongoDB: Vector search with store stock filter
    MongoDB-->>W2: Best matching product
    W2->>LLM: Generate personalized offer
    LLM-->>W2: Customer offer message

    Note over Q3,Mobile: Phase 4 - Notification Delivery
    W2->>Q3: Enqueue offer notification
    Q3->>W3: Trigger notification worker
    W3->>Mobile: Push notification with offer
```

### Production Component Diagram

```mermaid
graph TB
    subgraph Mobile["Mobile Layer"]
        App[Mobile App]
    end

    subgraph Ingestion["Ingestion Layer"]
        APIGW[API Gateway]
        PQ[Position Queue - SQS]
    end

    subgraph Processing["Processing Layer"]
        PW[Proximity Worker - Lambda]
        RQ[Recommendation Queue - SQS]
        RW[Recommendation Worker - Lambda]
        NQ[Notification Queue - SQS]
        NW[Notification Worker - Lambda]
    end

    subgraph Services["Internal Services"]
        CPS[Customer Profile Service]
        LES[Local Events Service]
        WS[Weather Service]
    end

    subgraph AI["AI Layer"]
        LLM[LLM - AWS Bedrock]
    end

    subgraph Data["Data Layer"]
        MDB[(MongoDB Atlas)]
    end

    subgraph Delivery["Delivery Layer"]
        Push[Push Notification - FCM/APNs]
    end

    App -->|Position every 1km| APIGW
    APIGW --> PQ
    PQ --> PW
    PW -->|Geo query| MDB
    PW --> RQ
    RQ --> RW
    RW --> CPS
    RW --> LES
    RW --> WS
    RW -->|Search query generation| LLM
    RW -->|Vector search + stock filter| MDB
    RW -->|Offer generation| LLM
    RW --> NQ
    NQ --> NW
    NW --> Push
    Push --> App

    style MDB fill:#00ed64,stroke:#00684a,color:#fff
    style LLM fill:#ff9900,stroke:#ff6600,color:#fff
    style App fill:#61dafb,stroke:#282c34,stroke-width:2px
    style PQ fill:#ff4f8b,stroke:#cc0044,color:#fff
    style RQ fill:#ff4f8b,stroke:#cc0044,color:#fff
    style NQ fill:#ff4f8b,stroke:#cc0044,color:#fff
```

### Production Pipeline Stages

| Stage | Trigger | Worker | Action | Output |
|-------|---------|--------|--------|--------|
| **1. Position Ingestion** | Mobile sends GPS every 1km | API Gateway | Validates and enqueues | Position event in queue |
| **2. Proximity Detection** | Position event | Lambda | Geospatial query against MongoDB stores | customerId + storeId + position |
| **3. Context Enrichment** | Proximity event | Lambda | Calls Profile, Events, Weather services | Full customer context |
| **4. Query Generation** | Enriched context | Lambda | LLM reasons about best search query | Semantic search query |
| **5. Product Matching** | Search query | Lambda | MongoDB Vector Search with stock filter | Best matching product |
| **6. Offer Generation** | Product + context | Lambda | LLM creates personalized offer | Customer offer message |
| **7. Notification** | Offer ready | Lambda | Push notification to mobile | User sees offer on phone |

### Demo vs Production Comparison

| Aspect | Demo (this repo) | Production |
|--------|-----------------|------------|
| **Position source** | Dropdown selector in browser | Mobile GPS every 1km |
| **Queues** | In-memory queues | AWS SQS / EventBridge |
| **Workers** | Node.js async functions | AWS Lambda (independent, scalable) |
| **Customer profile** | Dropdown selector | Internal Customer Profile Service |
| **Events** | Dropdown selector | Local Events Service (geo-aware) |
| **Weather** | Dropdown selector | Weather API (position-based) |
| **Notifications** | Server-Sent Events (SSE) | Push notifications (FCM/APNs) |
| **Scaling** | Single process | Each worker scales independently |
| **Fault tolerance** | None (restart loses state) | Dead-letter queues, retries, idempotency |

---

**See also:**
- [README.md](README.md) - Setup and overview
- [PLAN.md](PLAN.md) - Detailed architecture
- [STATUS.md](STATUS.md) - Current system state
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
