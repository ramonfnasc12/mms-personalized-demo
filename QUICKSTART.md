# Quick Start Guide

**For anyone resuming this project** - follow these steps to get running in under 5 minutes.

## Prerequisites Check

```bash
node --version    # Should be 18+
npm --version     # Should be 8+
git --version     # Any recent version
```

## 1. Clone & Setup (First Time Only)

```bash
git clone https://github.com/ramonfnasc12/mms-personalized-demo.git
cd mms-personalized-demo

# Backend setup
cd backend
npm install
cp .env.example .env
# EDIT .env with your MongoDB and AWS credentials
nano .env  # or use your preferred editor

# Frontend setup
cd ../frontend
npm install
```

## 2. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Wait for: `✓ Server running on http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Wait for: `VITE ready in XXX ms`

## 3. Verify It's Working

**Test backend health:**
```bash
curl http://localhost:3000/api/health
# Should return: {"success":true,"status":"healthy",...}
```

**Open frontend:**
- Navigate to: http://localhost:5173/
- Should see MediaMarktSaturn branded interface
- Connection status should show "Connected"

## 4. Run a Test

In the browser:
1. Select: Weather = "🔥 Extreme Heat (40°C)"
2. Select: Location = "📍 Near MediaMarkt Munich Center"
3. Select: Event = "🌡️ Heatwave Alert"
4. Select: Profile = "🏕️ Outdoor Adventurer"
5. Click: **"Get Recommendation"**

**Expected Result** (3-5 seconds):
- Product recommendation appears
- Custom message displayed
- Store location shown

## 5. If Something Goes Wrong

### Backend won't start?
```bash
# Check .env file exists and has values
cat .env | grep MONGODB_URI

# Kill any process using port 3000
lsof -ti:3000 | xargs kill -9
```

### Frontend errors?
```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### No recommendations?
- Check backend terminal for errors
- Verify MongoDB connection in backend logs
- See TROUBLESHOOTING.md for detailed solutions

## Important Files

- **STATUS.md** - Current state of everything
- **TROUBLESHOOTING.md** - Solutions to common issues
- **PLAN.md** - Full architecture documentation
- **README.md** - Complete setup instructions

## Quick Commands Reference

```bash
# Check services
curl http://localhost:3000/api/health
curl http://localhost:5173/

# Restart backend
pkill -f "ts-node-dev" && npm run dev

# Restart frontend  
lsof -ti:5173 | xargs kill -9 && npm run dev

# View backend logs
tail -f <path-to-log>  # Logs appear in terminal where npm run dev was executed

# Database setup (if needed)
npm run setup
```

## Need More Help?

1. **First**: Check STATUS.md for current configuration
2. **Second**: Check TROUBLESHOOTING.md for your specific error
3. **Third**: Review backend terminal output for error messages
4. **Fourth**: Check browser console (F12) for frontend errors

---

**That's it!** You should now have a fully functional demo running at http://localhost:5173/
