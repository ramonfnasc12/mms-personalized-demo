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

## AWS Deployment Architecture

The production deployment uses AWS services with MongoDB Atlas PrivateLink for secure, low-latency connectivity.

```mermaid
graph TB
    subgraph Internet
        Users[Users / Browser]
    end

    subgraph AWS["AWS (us-east-1)"]
        subgraph CloudFront["CloudFront (HTTPS)"]
            CF[Distribution<br/>d3lnlnmn92ryfo.cloudfront.net]
        end

        subgraph S3["S3 Bucket"]
            Static[React SPA<br/>index.html + assets]
        end

        subgraph VPC["VPC (10.0.0.0/16)"]
            subgraph PublicSubnets["Public Subnets (2 AZs)"]
                ALB[Application Load Balancer<br/>HTTP :80]
                subgraph ECS["ECS Fargate"]
                    Task[Backend Container<br/>Node.js :3000]
                end
            end
            subgraph PrivateLink["PrivateLink Endpoint"]
                VPCE[VPC Endpoint<br/>Interface type]
            end
        end
    end

    subgraph Atlas["MongoDB Atlas (M30)"]
        Cluster[Cluster: Main<br/>main-pl-1.w2o6yv.mongodb.net]
        VS[Vector Search<br/>Voyage-4 Auto-Embed]
    end

    subgraph Bedrock["AWS Bedrock"]
        LLM[Claude Sonnet<br/>Text Generation]
    end

    Users -->|HTTPS| CF
    CF -->|"/* (static)"| S3
    CF -->|"/api/* (proxy, TTL=0)"| ALB
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

    Note over Dev,Atlas: Initial Deploy (./infra/deploy.sh)
    Dev->>ECR: 1. Create repo + push Docker image<br/>(linux/amd64)
    Dev->>CF: 2. Deploy stack<br/>(VPC, ALB, ECS, S3, CloudFront)
    CF-->>Dev: Stack outputs (URLs, bucket name)
    Dev->>S3: 3. Build frontend + upload<br/>(VITE_API_URL = CloudFront/api)
    Dev->>Atlas: 4. Setup PrivateLink<br/>(VPC Endpoint ↔ Atlas PE Service)
    Atlas-->>Dev: Connection available
    Dev->>ECS: 5. Scale to 1 task<br/>(uses private connection string)

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
        CF[CloudFront<br/>HTTPS only]
    end

    subgraph VPC["Private VPC"]
        ALB[ALB<br/>Internal routing]
        ECS[ECS Task<br/>No public IP]
        VPCE[VPC Endpoint<br/>ENI in subnet]
    end

    subgraph AtlasNet["Atlas Network"]
        PES[PE Service]
        DB[(MongoDB)]
    end

    User -->|HTTPS 443| CF
    CF -->|HTTP 80<br/>internal| ALB
    ALB -->|Port 3000| ECS
    ECS -->|Port 27017<br/>private| VPCE
    VPCE ===|"AWS PrivateLink<br/>(no internet)"| PES
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

---

**See also:**
- [README.md](README.md) - Setup and overview
- [PLAN.md](PLAN.md) - Detailed architecture
- [STATUS.md](STATUS.md) - Current system state
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
