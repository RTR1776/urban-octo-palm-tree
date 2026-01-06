# Quick Setup Guide

This guide will get you up and running with the Polymarket Monitor in under 5 minutes.

## Step 1: Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

## Step 2: Configure Backend

```bash
cd backend
cp .env.example .env
```

The defaults in `.env` work fine for most use cases. You can customize:
- `WHALE_THRESHOLD`: Default is $10,000
- `LARGE_MOVEMENT_THRESHOLD`: Default is $5,000
- `CHECK_INTERVAL_SECONDS`: Default is 60 seconds

## Step 3: Start the Application

From the root directory:

```bash
npm run dev
```

This starts both:
- Backend on http://localhost:3001
- Frontend on http://localhost:3000

## Step 4: Access the Dashboard

Open your browser to:
```
http://localhost:3000
```

You should see the dashboard with:
- Connection status indicator (should show "Connected" in green)
- Overview cards showing stats
- Empty lists that will populate as data is collected

## Step 5: Wait for Data Collection

The bot runs every 60 seconds by default. After the first cycle, you'll start seeing:
1. Trades appearing in the "Recent Trades" panel
2. Market statistics in "Top Markets"
3. Alerts when whale activity or large movements are detected
4. Whale traders in the "Whale Activity" panel

## Customizing Alert Thresholds

Edit `backend/.env`:

```env
# Detect traders with trades over $20,000
WHALE_THRESHOLD=20000

# Alert on movements over $10,000
LARGE_MOVEMENT_THRESHOLD=10000

# Alert when volume is 5x normal
UNUSUAL_VOLUME_MULTIPLIER=5

# Check every 30 seconds
CHECK_INTERVAL_SECONDS=30
```

Restart the backend after changes:
```bash
cd backend
npm run dev
```

## Testing the Connection

### Backend Health Check
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"ok","timestamp":1704587234567}
```

### WebSocket Test

Open browser console on `http://localhost:3000` and check for:
```
WebSocket connected
```

## Common Issues

### Port Already in Use
If port 3001 or 3000 is in use:

1. Change backend port in `backend/.env`:
```env
PORT=3002
```

2. Update frontend proxy in `frontend/vite.config.ts`:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3002',
  }
}
```

### No Data After 5 Minutes
Check backend logs for errors:
- API rate limiting
- Network connectivity issues
- Polymarket API availability

### WebSocket Not Connecting
- Ensure backend is running
- Check browser console for errors
- Verify no firewall blocking WebSocket connections

## Production Deployment

### Build for Production
```bash
npm run build
```

### Run Backend in Production
```bash
cd backend
NODE_ENV=production npm start
```

### Serve Frontend
```bash
cd frontend
npx serve -s dist -p 3000
```

Or use any static file server (nginx, Apache, etc.)

## Next Steps

- Monitor the dashboard for whale activity
- Adjust thresholds based on your needs
- Set up notifications (extend the alert system)
- Add more markets to monitor
- Export data for analysis

## Need Help?

Check the main README.md for:
- Detailed architecture explanation
- API endpoint documentation
- WebSocket message format
- Database schema
- Troubleshooting guide
