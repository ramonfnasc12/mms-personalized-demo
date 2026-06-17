# MediaMarktSaturn Contextualization Demo

Real-time personalized product recommendations powered by MongoDB Atlas, AWS Bedrock, and geospatial intelligence.

## Overview

This demo showcases **contextualization over personalization** - moving from traditional "who the customer is" recommendations to "where the customer is right now" recommendations. The system processes real-time customer location, weather conditions, and local events to deliver relevant product suggestions using MongoDB's real-time data platform.

**Presented at**: MediaMarktSaturn Tech Summit (June 18, 2026)

## Architecture

```
Frontend (React + TypeScript)
    ↓ POST /api/context/submit
Backend API (Express + Node.js)
    ↓ MongoDB Transaction (2 collections)
MongoDB Change Streams (real-time monitoring)
    ↓ Geospatial Query ($near 1km radius)
Proximity Queue → Recommendation Worker
    ↓ AWS Bedrock LLM (context generation)
    ↓ MongoDB Vector Search (product matching)
    ↓ AWS Bedrock LLM (message personalization)
Notification Queue → SSE Stream
    ↓ Real-time push notification
Frontend displays recommendation
```

## Technology Stack

### Backend
- **Node.js** with TypeScript
- **Express.js** - REST API
- **MongoDB Atlas** - Database with Change Streams, Vector Search, Geospatial Queries
- **AWS Bedrock** - Claude 3.5 Sonnet for LLM
- **Server-Sent Events (SSE)** - Real-time notifications
- **In-memory Queues** - Event processing

### Frontend
- **React** with TypeScript
- **Vite** - Build tool
- **MediaMarkt** color scheme
- **EventSource API** - SSE client

### MongoDB Features Demonstrated
- ✅ Change Streams (real-time position monitoring)
- ✅ Geospatial Queries (2dsphere index, $near operator)
- ✅ Vector Search with Auto-Embedding (Voyage-4 model)
- ✅ Transactions (atomic multi-collection writes)
- ✅ Aggregation Pipeline (complex queries)

## 📚 Documentation

This project includes comprehensive documentation to help you understand, set up, and troubleshoot the system:

### Quick Start
- **[QUICKSTART.md](QUICKSTART.md)** - 5-minute setup guide to get running immediately. Perfect for first-time setup or quick demos.

### Understanding the System
- **[FLOW.md](FLOW.md)** - Visual flow diagrams with Mermaid showing the complete end-to-end request flow, including sequence diagrams, data flow, error handling, and performance analysis.
- **[PLAN.md](PLAN.md)** - Detailed implementation plan covering architecture, database design, API endpoints, component structure, and implementation phases.

### Current State & Operations
- **[STATUS.md](STATUS.md)** - Current project state including what's working, known issues, configurations, environment variables, and next session checklist.
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Comprehensive troubleshooting guide covering MongoDB, AWS Bedrock, frontend, backend, and development environment issues with solutions.

### Project Context
- **[project.md](project.md)** - Original requirements and presentation context for the MediaMarktSaturn Tech Summit demo.
- **[CLAUDE.md](CLAUDE.md)** - Code style guide and development standards for the project.

**Recommended Reading Order:**
1. Start with this **README.md** for overview and setup
2. Use **QUICKSTART.md** to get running in 5 minutes
3. Read **FLOW.md** to understand how requests flow through the system
4. Check **STATUS.md** for current state and configurations
5. Refer to **TROUBLESHOOTING.md** when issues arise
6. Dive into **PLAN.md** for deep architectural details

## Prerequisites

- Node.js 18+
- MongoDB Atlas account (M30+ for PrivateLink)
- AWS account with Bedrock access
- AWS CLI configured with SSO (`aws configure sso`)
- Docker (for building deployment images)

## Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd mms-demo
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env` with your credentials:

```bash
# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/
MONGODB_DATABASE=mms_demo

# AWS Bedrock credentials
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
BEDROCK_TEXT_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0

# App config
NODE_ENV=development
PORT=3000
```

### 3. Database Initialization

Run the setup script to create collections, indexes, and seed data:

```bash
npm run setup
```

This creates:
- 4 collections (customerPosition, customerContext, stores, products)
- 2 indexes (2dsphere on stores, index on customerContext)
- 9 stores in major German cities
- 49 weather/event-contextual products

### 4. Create Vector Search Index

In MongoDB Atlas UI:
1. Go to **Search** → **Create Search Index** → **JSON Editor**
2. Settings:
   - Database: `mms_demo`
   - Collection/View: `products_searchable`
   - Index Name: `products_vector_index`
3. Definition:
```json
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
4. Wait for index to become **Active**

### 5. Frontend Setup

```bash
cd ../frontend
npm install
```

### 6. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Access the demo:**
- Frontend: http://localhost:5173/
- Backend API: http://localhost:3000/api

## AWS Deployment

The demo can be deployed to AWS with a public HTTPS endpoint using ECS Fargate (backend) and S3 + CloudFront (frontend), connected to MongoDB Atlas via PrivateLink.

### Architecture (Production)

```
Users → CloudFront (HTTPS) → S3 (static frontend)
              ↓ /api/*
        CloudFront → ALB → ECS Fargate (backend)
                              ↓ PrivateLink
                        MongoDB Atlas (M30)
                              ↓
                        AWS Bedrock (LLM)
```

### Deploy

```bash
# First time: full deployment (creates VPC, ALB, ECS, S3, CloudFront, PrivateLink)
./infra/deploy.sh
```

This single command:
1. Creates an ECR repository and pushes the Docker image (linux/amd64)
2. Deploys the CloudFormation stack (VPC, ALB, ECS cluster, S3, CloudFront)
3. Builds and uploads the frontend to S3
4. Sets up MongoDB Atlas PrivateLink (VPC endpoint + Atlas registration)
5. Scales ECS to 1 task once PrivateLink is active

### Redeploy (after code changes)

```bash
./infra/redeploy.sh backend   # Rebuild image + restart ECS (~60s)
./infra/redeploy.sh frontend  # Rebuild + upload to S3 + invalidate cache (~30s)
./infra/redeploy.sh all       # Both
```

### Teardown

```bash
./infra/teardown.sh   # Removes all AWS resources (VPC endpoint, stack, ECR)
```

### Configuration

All deployment scripts use:
- **AWS Profile**: `ramon-mongo` (override with `AWS_PROFILE` env var)
- **Region**: `us-east-1` (override with `AWS_REGION` env var)
- **Secrets**: Read from `backend/.env` at deploy time

The MongoDB connection uses PrivateLink (`main-pl-1.w2o6yv.mongodb.net`) — traffic stays within the AWS VPC, no public internet exposure.

## Usage

1. Open http://localhost:5173/ in your browser
2. Select simulation parameters:
   - **Weather**: Choose temperature and conditions
   - **Event**: Select local event (sports, festivals, etc.)
   - **Location**: Pick customer position near/far from stores
   - **Profile**: Choose customer persona
3. Click **"Get Recommendation"**
4. View personalized product recommendation with:
   - Contextually relevant product
   - Custom LLM-generated message
   - Store location and availability
   - Match score

## Demo Scenarios

### Scenario 1: Heatwave Near Store
- Position: Near MediaMarkt Munich
- Weather: 🔥 Extreme Heat (40°C)
- Event: Heatwave Alert
- Expected: Cooling products (fans, AC, coolers)

### Scenario 2: Sports Event
- Position: Near any store
- Weather: Any
- Event: ⚽ FIFA World Cup 2026
- Profile: 📺 Home Entertainment
- Expected: TVs, soundbars, projectors

### Scenario 3: No Nearby Store
- Position: 🏞️ Rural Bavaria
- Expected: "No nearby offers" notification

## Project Structure

```
mms-demo/
├── backend/
│   ├── src/
│   │   ├── config/         # Database connection
│   │   ├── models/         # TypeScript types
│   │   ├── services/       # LLM, vector search, notifications
│   │   ├── queues/         # In-memory queue implementation
│   │   ├── workers/        # Change stream & recommendation workers
│   │   ├── routes/         # API endpoints
│   │   └── server.ts       # Main entry point
│   ├── scripts/
│   │   └── setup-database.ts  # Database initialization
│   ├── Dockerfile          # Multi-stage build for ECS deployment
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── data/           # Dropdown options
│   │   ├── services/       # API client & SSE
│   │   ├── types/          # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── App.css
│   └── package.json
├── infra/
│   ├── cloudformation.yaml    # Full AWS stack (VPC, ALB, ECS, S3, CloudFront)
│   ├── deploy.sh              # One-command deployment to AWS
│   ├── redeploy.sh            # Fast redeploy (backend/frontend/all)
│   ├── teardown.sh            # Remove all AWS resources
│   └── setup-privatelink.sh   # MongoDB Atlas PrivateLink setup
├── PLAN.md                 # Detailed implementation plan
├── project.md              # Original requirements
└── README.md
```

## API Endpoints

### POST `/api/context/submit`
Submit customer context for recommendation processing.

**Request:**
```json
{
  "customerId": "uuid",
  "tabId": "uuid",
  "position": {
    "type": "Point",
    "coordinates": [longitude, latitude]
  },
  "weather": {...},
  "event": {...},
  "customerActivity": {...}
}
```

### GET `/api/notifications/stream/:customerId/:tabId`
SSE endpoint for real-time recommendation notifications.

### GET `/api/health`
Health check endpoint.

### GET `/api/stores`
List all store locations (optional, for debugging).

## Key Features

- ✅ **Real-time Change Streams**: Monitors customer positions as they're inserted
- ✅ **Geospatial Proximity**: Detects customers within 1km of stores
- ✅ **LLM-Powered Context**: Uses AWS Bedrock to generate semantic search queries
- ✅ **Vector Search**: Semantic product matching (with fallback)
- ✅ **Personalized Messages**: Custom LLM-generated recommendations
- ✅ **SSE Notifications**: Real-time push to frontend
- ✅ **Multi-Tab Support**: Independent sessions per browser tab
- ✅ **Error Handling**: Graceful degradation with fallbacks

## Troubleshooting

### Vector Search Not Working
If you see "Index products_vector_index not initialized":
- Verify the index is **Active** in Atlas UI
- Check it's on the `products` collection (not view)
- Fallback mode will use random in-stock products

### LLM Errors
If AWS Bedrock returns 404:
- Verify your AWS credentials have Bedrock access
- Check the model ID is correct for your region
- Ensure model quota is not exceeded

### No Recommendations
- Check customer position is within 1km of a store
- Verify products have inventory at that store
- Check backend logs for errors

## Performance

- **API Response**: < 100ms (context submission)
- **Change Stream Latency**: < 500ms
- **LLM Generation**: 1-2 seconds (per call, 2 calls total)
- **Vector Search**: < 200ms
- **Total Flow**: 3-5 seconds (submit to notification)

## Production Architecture

This demo simulates a production-grade, event-driven pipeline for real-time contextualized offers. In production, the system would operate as follows:

```
Mobile App (GPS every 1km)
    → API Gateway
        → Position Queue (SQS)
            → Proximity Worker (Lambda)
                → MongoDB Geospatial Query: store within 1km?
                    → Recommendation Queue (SQS)
                        → Recommendation Worker (Lambda)
                            → Customer Profile Service
                            → Local Events Service (geo-aware)
                            → Weather Service (position-based)
                            → LLM: generate semantic search query
                            → MongoDB Vector Search (stock-filtered)
                            → LLM: generate personalized offer
                                → Notification Queue (SQS)
                                    → Notification Worker (Lambda)
                                        → Push Notification (FCM/APNs)
                                            → Mobile App shows offer
```

**Key differences from this demo:**

| Aspect | Demo | Production |
|--------|------|------------|
| Position source | UI dropdown | Mobile GPS (every 1km moved) |
| Queues | In-memory | AWS SQS with dead-letter queues |
| Workers | Node.js async | AWS Lambda (independent scaling) |
| Customer context | UI selectors | Internal services (profile, events, weather) |
| Notifications | SSE in browser | Push notifications (FCM/APNs) |
| Fault tolerance | None | Retries, idempotency, DLQ |

Each stage is decoupled through message queues, enabling independent scaling and fault tolerance. See [FLOW.md](FLOW.md#production-architecture) for detailed sequence diagrams.

## Cost Estimates

- **MongoDB Atlas**: M30 Dedicated (~$0.54/hr) — required for PrivateLink and Vector Search
- **Vector Search**: $0.06/1M tokens (Voyage-4 auto-embedding)
- **AWS Bedrock**: ~$0.15-0.75 per demo session (Claude Sonnet)
- **AWS Infra**: ECS Fargate (~$0.04/hr), ALB (~$0.02/hr), CloudFront (minimal), PrivateLink (~$0.01/hr)
- **Total**: ~$0.62/hr running + < $1 per demo session in LLM costs

## Additional Resources

For more detailed information, see:

- **[QUICKSTART.md](QUICKSTART.md)** - Get running in 5 minutes
- **[FLOW.md](FLOW.md)** - Visual diagrams of the complete system flow
- **[STATUS.md](STATUS.md)** - Current project state and configurations
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Solutions to common issues
- **[PLAN.md](PLAN.md)** - Detailed architecture and implementation plan

## Contributing

This is a demo project for the MediaMarktSaturn Tech Summit. For questions or improvements, contact Ramon Nascimento.

## License

Proprietary - MongoDB Solutions Architecture Demo

## Acknowledgments

- **MongoDB Atlas** - Real-time data platform
- **AWS Bedrock** - LLM infrastructure
- **MediaMarktSaturn** - Use case and requirements
