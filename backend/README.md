# MMS Demo Backend

Backend service for the MediaMarktSaturn contextualization demo.

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```bash
# Get MongoDB connection string from Atlas:
# 1. Go to cloud.mongodb.com
# 2. Select Cluster0 → Connect → Drivers
# 3. Copy connection string and replace <username> and <password>
MONGODB_URI=mongodb+srv://your-username:your-password@cluster0.xxxxx.mongodb.net/

# AWS Bedrock credentials
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
```

### 3. Run Database Setup Script

This script will:
- Create collections (customerPosition, customerContext, stores, products)
- Create indexes (2dsphere on stores, index on customerContext)
- Create view (products_searchable)
- Seed stores data (9 stores in German cities)
- Seed products data (53 weather/event-contextual products)

```bash
npm run setup
```

### 4. Create Vector Search Index

After running the setup script, you need to create the vector search index manually in Atlas UI:

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Navigate to: Database → Search → Create Search Index
3. Choose **JSON Editor**
4. Settings:
   - **Database**: `mms_demo`
   - **Collection/View**: `products_searchable`
   - **Index Name**: `products_vector_index`
5. Paste this index definition:

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

6. Click **Create Search Index**
7. Wait for the index to build (usually 1-2 minutes)

## Development

Run the backend server in development mode:

```bash
npm run dev
```

Server will start on `http://localhost:3000` (or PORT from .env)

## Production Build

```bash
npm run build
npm start
```

## Project Structure

```
backend/
├── src/
│   ├── config/          # Database connection
│   ├── models/          # TypeScript interfaces
│   ├── services/        # Business logic (LLM, vector search, notifications)
│   ├── queues/          # In-memory queue implementation
│   ├── workers/         # Change stream and recommendation workers
│   ├── routes/          # API endpoints
│   └── server.ts        # Main entry point
├── scripts/
│   └── setup-database.ts  # Database initialization script
└── package.json
```
