# Troubleshooting Guide

Common issues encountered during development and their solutions.

## Table of Contents
- [MongoDB Issues](#mongodb-issues)
- [AWS Bedrock Issues](#aws-bedrock-issues)
- [Frontend Issues](#frontend-issues)
- [Backend Issues](#backend-issues)
- [Development Environment](#development-environment)

---

## MongoDB Issues

### Vector Search Index Not Initialized

**Error Message**:
```
MongoServerError: PlanExecutor error during aggregation :: caused by :: Index products_vector_index not initialized
```

**Cause**: Vector search index was created on the `products_searchable` view instead of the `products` collection, or the index hasn't finished building.

**Solution**:
1. Delete the existing index in Atlas UI
2. Create a new index with these exact settings:
   - **Database**: `mms_demo`
   - **Collection**: `products` (NOT products_searchable)
   - **Index Name**: `products_vector_index`
   - **Definition**:
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
3. Wait for index status to show "Active" (1-2 minutes)

**Temporary Workaround**: The system includes a fallback mechanism that returns random in-stock products when vector search fails.

### Connection String Issues

**Error Message**:
```
Error: MONGODB_URI environment variable is not set
```

**Solution**:
1. Verify `.env` file exists in `backend/` directory
2. Check connection string format:
   ```bash
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/
   ```
3. Ensure username and password are URL-encoded (no special characters without encoding)
4. Test connection: Run setup script to verify connectivity

**Error Message**:
```
MongoServerError: Authentication failed
```

**Solution**:
1. Verify database user credentials in MongoDB Atlas → Database Access
2. Check user has "Read and write to any database" privileges
3. Ensure IP is whitelisted in Network Access (or use 0.0.0.0/0 for testing)

### Change Streams Not Detecting Changes

**Symptoms**: Position submitted but no recommendation generated.

**Debug Steps**:
1. Check backend logs for "Change stream worker started"
2. Verify change stream is connected:
   ```bash
   # Should see this in logs
   🔄 Starting change stream worker...
   ✓ Change stream worker started
   ```
3. Check MongoDB version (requires 4.0+ for change streams)
4. Verify replica set (Atlas clusters are replica sets by default)

**Common Issue**: MongoDB M0 free tier has change stream limitations
- **Solution**: Upgrade to M10+ or test with fewer concurrent changes

---

## AWS Bedrock Issues

### Model Not Found (404)

**Error Message**:
```
ResourceNotFoundException: This model version has reached the end of its life
```

**Cause**: Using deprecated model ID in `.env` file.

**Solution**:
Update `BEDROCK_TEXT_MODEL` in `backend/.env`:
```bash
# OLD (deprecated)
BEDROCK_TEXT_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0

# NEW (current)
BEDROCK_TEXT_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0
```

Restart backend after changing.

### Access Denied Errors

**Error Message**:
```
AccessDeniedException: User is not authorized to perform: bedrock:InvokeModel
```

**Solution**:
1. Verify IAM user has Bedrock permissions:
   ```json
   {
     "Effect": "Allow",
     "Action": [
       "bedrock:InvokeModel",
       "bedrock:InvokeModelWithResponseStream"
     ],
     "Resource": "*"
   }
   ```
2. Check region matches model availability (use `us-east-1`)
3. Verify model access has been requested in Bedrock console

### Rate Limiting

**Error Message**:
```
ThrottlingException: Too many requests
```

**Solution**:
1. Request quota increase in AWS Service Quotas console
2. Add retry logic with exponential backoff
3. Implement request queuing
4. Consider caching LLM responses for similar contexts

---

## Frontend Issues

### TypeScript Import Errors

**Error Message**:
```
SyntaxError: The requested module '/src/types/index.ts' does not provide an export named 'ActivityProfile'
```

**Cause**: Vite's HMR (Hot Module Replacement) caching issue with TypeScript imports.

**Solution**:
1. Use `import type` for type-only imports:
   ```typescript
   // Instead of:
   import { ActivityProfile } from '../types';
   
   // Use:
   import type { ActivityProfile } from '../types/index.js';
   ```
2. Clear Vite cache:
   ```bash
   cd frontend
   rm -rf node_modules/.vite
   npm run dev
   ```

### SSE Connection Failures

**Symptoms**: "Connecting..." status never changes to "Connected".

**Debug Steps**:
1. Check backend is running: `curl http://localhost:3000/api/health`
2. Verify CORS headers in backend allow localhost:5173
3. Check browser console for connection errors
4. Verify customerId and tabId are being generated:
   ```javascript
   console.log(sessionStorage.getItem('customerId'));
   console.log(sessionStorage.getItem('tabId'));
   ```

**Solution**:
- Ensure backend SSE endpoint returns correct headers:
  ```typescript
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*'
  ```

### No Recommendations Displayed

**Symptoms**: Submit button works but no product appears.

**Debug Steps**:
1. Open browser DevTools → Network tab → EventSource/WS
2. Check SSE connection is active
3. Verify backend logs show recommendation processing:
   ```
   📍 New position event: customer [id]
   ✓ Customer near store: [store name]
   ✓ Found product: [product name]
   ```
4. Check SSE message is being sent to correct customerId-tabId key

**Common Issue**: Customer not within 1km of any store
- **Solution**: Use position dropdown near a store (e.g., "Near MediaMarkt Munich")

---

## Backend Issues

### Port Already in Use

**Error Message**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**:
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or change port in .env
PORT=3001
```

### TypeScript Compilation Errors

**Error Message**:
```
TSError: Unable to compile TypeScript
```

**Solution**:
1. Verify tsconfig.json exists and is valid
2. Install dependencies:
   ```bash
   npm install
   ```
3. Check for type mismatches in recent changes
4. Use `--transpile-only` flag to skip type checking temporarily:
   ```bash
   ts-node-dev --transpile-only src/server.ts
   ```

### LLM Timeout

**Symptoms**: Recommendation takes > 10 seconds or fails.

**Solution**:
1. Check AWS Bedrock service status
2. Verify network connectivity
3. Consider adding timeout and fallback:
   ```typescript
   const timeout = 10000; // 10s
   const response = await Promise.race([
     llm.invoke(prompt),
     new Promise((_, reject) => 
       setTimeout(() => reject(new Error('Timeout')), timeout)
     )
   ]);
   ```

---

## Development Environment

### Node Version Mismatch

**Error Message**:
```
Unsupported engine
```

**Solution**:
- Project requires Node.js 18+
- Check version: `node --version`
- Use nvm to switch: `nvm use 18`

### npm Install Failures

**Error Message**:
```
ERESOLVE unable to resolve dependency tree
```

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock
rm -rf node_modules package-lock.json

# Reinstall
npm install --legacy-peer-deps
```

### Environment Variables Not Loading

**Symptoms**: `undefined` or `null` for environment variables.

**Debug**:
```typescript
console.log('All env vars:', process.env);
```

**Solution**:
1. Ensure `.env` is in correct directory (backend/ or frontend/)
2. Restart development server after changing .env
3. Verify dotenv is imported at top of file:
   ```typescript
   import * as dotenv from 'dotenv';
   dotenv.config();
   ```

---

## Testing Issues

### Manual Test Not Triggering Flow

**Checklist**:
- [ ] Backend running on port 3000
- [ ] Frontend running on port 5173
- [ ] MongoDB connected (check backend logs)
- [ ] Change stream worker started (check backend logs)
- [ ] Selected position is near a store (within 1km)
- [ ] Store has products in inventory
- [ ] SSE connection established (check frontend console)

**Test Command**:
```bash
# Test backend is receiving requests
curl -X POST http://localhost:3000/api/context/submit \
  -H "Content-Type: application/json" \
  -d '{"customerId":"test","tabId":"test","position":{"type":"Point","coordinates":[11.5755,48.1374]},"weather":{"condition":"sunny","temperature":40,"label":"Hot"},"event":{"type":"none","label":"None","description":"None"},"customerActivity":{"profile":"tech","recentViews":[],"recentPurchases":[],"cartItems":[]}}'

# Should return: {"success":true,"message":"Context submitted successfully"}
```

---

## Performance Issues

### Slow Recommendations (> 10s)

**Possible Causes**:
1. LLM API latency → Check AWS region proximity
2. MongoDB slow queries → Check index usage with explain()
3. Network issues → Test latency to services

**Solution**:
1. Add performance logging:
   ```typescript
   const start = Date.now();
   await someOperation();
   console.log(`Operation took ${Date.now() - start}ms`);
   ```
2. Consider caching frequently used queries
3. Use concurrent processing where possible

---

## Getting Help

If none of these solutions work:

1. **Check Logs**:
   - Backend: Look for errors in terminal output
   - Frontend: Check browser DevTools console
   - MongoDB: Check Atlas logs

2. **Verify Versions**:
   ```bash
   node --version  # Should be 18+
   npm --version   # Should be 8+
   ```

3. **Test Components Individually**:
   - Database: Run setup script
   - API: Test with curl
   - Frontend: Check build with `npm run build`

4. **Review Documentation**:
   - README.md - Setup instructions
   - PLAN.md - Architecture details
   - STATUS.md - Current state

5. **Contact**:
   - Project: Ramon Nascimento
   - MongoDB Support: For Atlas-specific issues
   - AWS Support: For Bedrock issues
