# Deployment Guide

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Vercel         │     │  Fly.io          │     │  Discord    │
│  (Frontend)     │◄───▶│  (Backend API +  │────▶│  Webhook    │
│  React/Vite     │     │   Monitor Bot)   │     │             │
└─────────────────┘     └──────────────────┘     └─────────────┘
        │                        │
        │                        │
        ▼                        ▼
   Your Browser            SQLite (Fly Volume)
```

---

## 1. Deploy Backend to Fly.io

### Prerequisites
```bash
# Install Fly CLI
brew install flyctl

# Login
fly auth login
```

### Deploy
```bash
cd backend

# Create app (first time only)
fly launch --name polymarket-whale-monitor --region ord

# Create persistent volume for SQLite
fly volumes create polymarket_data --size 1 --region ord

# Set secrets (environment variables)
fly secrets set \
  NOTIFICATION_WEBHOOK="https://discord.com/api/webhooks/YOUR_WEBHOOK" \
  NOTIFICATIONS_ENABLED="true" \
  WHALE_THRESHOLD="10000" \
  LARGE_MOVEMENT_THRESHOLD="5000" \
  ALLOWED_ORIGINS="https://your-app.vercel.app"

# Deploy
fly deploy

# Check logs
fly logs
```

### Estimated Cost: ~$5-7/month
- Shared CPU with 512MB RAM
- 1GB persistent volume
- Always-on for monitoring

---

## 2. Deploy Frontend to Vercel

### Prerequisites
```bash
npm install -g vercel
```

### Deploy
```bash
cd frontend

# Login
vercel login

# Deploy (first time - will prompt for settings)
vercel

# Set environment variable
vercel env add VITE_API_URL
# Enter: https://polymarket-whale-monitor.fly.dev/api

# Deploy production
vercel --prod
```

### Estimated Cost: FREE (Hobby tier)

---

## 3. Environment Variables

### Fly.io (Backend)
| Variable | Description |
|----------|-------------|
| `NOTIFICATION_WEBHOOK` | Discord webhook URL |
| `NOTIFICATIONS_ENABLED` | `true` or `false` |
| `WHALE_THRESHOLD` | Min USD for whale alert (e.g., `10000`) |
| `LARGE_MOVEMENT_THRESHOLD` | Min USD for large trade (e.g., `5000`) |
| `ALLOWED_ORIGINS` | Comma-separated allowed origins for CORS |
| `USE_ENHANCED_MONITOR` | `true` for new scoring system |

### Vercel (Frontend)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL (e.g., `https://polymarket-whale-monitor.fly.dev/api`) |

---

## 4. Custom Domain (Optional)

### Fly.io
```bash
fly certs create api.yourdomain.com
```
Then add CNAME record: `api.yourdomain.com -> polymarket-whale-monitor.fly.dev`

### Vercel
Add domain in Vercel dashboard, then add DNS records as instructed.

---

## 5. Monitoring & Logs

### Fly.io
```bash
# Live logs
fly logs

# SSH into container
fly ssh console

# Check app status
fly status
```

### Vercel
- View logs in Vercel dashboard
- Enable Web Analytics for traffic insights

---

## 6. Scaling

### Fly.io (if needed)
```bash
# Scale up memory
fly scale memory 1024

# Add more machines
fly scale count 2
```

### Auto-restart
Fly.io automatically restarts crashed apps. The `auto_stop_machines = false` in fly.toml ensures the monitor keeps running.

---

## Kalshi Replication

To add Kalshi monitoring alongside Polymarket:

### 1. Already Created
- `backend/src/kalshi-client.ts` - Kalshi API client

### 2. Create Kalshi Monitor
```typescript
// backend/src/kalshi-monitor.ts
import { KalshiClient } from './kalshi-client';
import { EnhancedMonitorService } from './enhanced-monitor';

// Use same EnhancedMonitorService with KalshiClient
// Just swap the client!
```

### 3. Update Index
```typescript
// In index.ts, add:
const kalshiClient = new KalshiClient();
const kalshiMonitor = new EnhancedMonitorService(kalshiClient, db, notifications);

// Run both monitors
await Promise.all([
  polymarketMonitor.monitorMarkets(),
  kalshiMonitor.monitorMarkets(),
]);
```

### 4. Kalshi API Differences
| Feature | Polymarket | Kalshi |
|---------|------------|--------|
| Auth | Wallet (optional for reads) | Email/password (optional for reads) |
| Prices | 0-1 decimal | 0-100 cents |
| Global trades | ✅ `/trades` endpoint | ❌ Per-market only |
| WebSocket | ✅ Available | ❌ REST only |
| Rate limits | Generous | More strict |

### 5. Combined Dashboard
The frontend already works - just add a "source" field to trades/alerts and filter in the UI.

---

## Troubleshooting

### Backend won't start
```bash
fly logs --app polymarket-whale-monitor
```

### CORS errors
Add your Vercel domain to `ALLOWED_ORIGINS`:
```bash
fly secrets set ALLOWED_ORIGINS="https://your-app.vercel.app,http://localhost:3000"
```

### SQLite errors on Fly.io
Ensure volume is mounted:
```bash
fly volumes list
```

### Discord not receiving alerts
1. Check webhook URL is correct
2. Check `NOTIFICATIONS_ENABLED=true`
3. Check logs for rate limiting errors

---

## Quick Reference

```bash
# Deploy backend
cd backend && fly deploy

# Deploy frontend
cd frontend && vercel --prod

# View backend logs
fly logs

# SSH into backend
fly ssh console

# Update secrets
fly secrets set KEY=value

# Restart backend
fly apps restart polymarket-whale-monitor
```
