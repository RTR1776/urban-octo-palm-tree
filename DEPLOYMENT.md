# Deployment Guide

This guide covers deploying the Polymarket Analytics Platform to Fly.io (backend) and Vercel (frontend).

## Prerequisites

- **Fly.io CLI** (`flyctl`) installed: https://fly.io/docs/hands-on/install-flyctl/
- **Vercel CLI** (`vercel`) installed: `npm install -g vercel`
- Fly.io account with app already created (`polymarket-whale-monitor`)
- Vercel account connected to your repository

---

## Backend Deployment (Fly.io)

### Quick Deploy

From the **root directory**, run:

```bash
cd backend
flyctl deploy
```

This will:
1. Build the Docker image using `Dockerfile`
2. Compile TypeScript to JavaScript
3. Install production dependencies
4. Deploy to Fly.io
5. Run health checks

### Configuration

The backend is configured via `backend/fly.toml`:
- **App Name**: `polymarket-whale-monitor`
- **Region**: `ord` (Chicago)
- **Port**: `3001`
- **Memory**: 1GB
- **Auto-scaling**: Enabled (stops when idle, starts on request)

### Environment Variables

Set environment variables on Fly.io:

```bash
# Required
flyctl secrets set WHALE_THRESHOLD=10000
flyctl secrets set LARGE_MOVEMENT_THRESHOLD=50000
flyctl secrets set CHECK_INTERVAL_SECONDS=300

# Optional
flyctl secrets set NOTIFICATIONS_ENABLED=true
flyctl secrets set NOTIFICATION_WEBHOOK=your_discord_webhook_url
flyctl secrets set KALSHI_ENABLED=false
```

### Health Check

After deployment, verify:

```bash
curl https://polymarket-whale-monitor.fly.dev/health
```

### View Logs

```bash
flyctl logs
```

---

## Frontend Deployment (Vercel)

### Option 1: Deploy via Git Integration (Recommended)

1. Connect repository to Vercel
2. Configure:
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Root Directory**: `frontend`

3. Add environment variable:
   ```
   VITE_API_URL=https://polymarket-whale-monitor.fly.dev/api
   ```

4. Deploy automatically on push to main

### Option 2: Deploy via CLI

```bash
cd frontend
vercel
```

For production:
```bash
vercel --prod
```

---

## Post-Deployment Verification

### Backend Health
```bash
curl https://polymarket-whale-monitor.fly.dev/health
curl https://polymarket-whale-monitor.fly.dev/api/analytics/categories
```

### Frontend
Visit your Vercel URL and test:
- Dashboard loads
- Analytics page works
- Market Screener filters
- Market Explorer charts

---

## Troubleshooting

### Backend
- Check logs: `flyctl logs`
- Verify secrets: `flyctl secrets list`
- Check status: `flyctl status`

### Frontend
- Check Vercel build logs
- Verify `VITE_API_URL` is set
- Check browser console for errors

---

## Rollback

### Fly.io
```bash
flyctl releases
flyctl releases rollback
```

### Vercel
Go to Deployments → Select previous → Promote to Production

---

**Ready to deploy!** 🚀
