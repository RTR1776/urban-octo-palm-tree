# 🐋 Testing & Running Your Whale Monitor

## ✅ Current Status

Your bot is **READY TO GO!** Here's what's configured:

- ✅ Discord webhook: Configured and enabled
- ✅ Whale threshold: Set to $50 (for testing - will catch trades quickly)
- ✅ Notifications: **ENABLED**
- ✅ Backend running on port 3001
- ✅ Frontend running on http://localhost:3000

## 🧪 Testing Discord Notifications

### What Should Happen:

Within 1-2 minutes, you should see:
1. **In your terminal**: Alert messages like:
   ```
   [HIGH] NEW_WHALE: New whale detected! 0x1234...5678 made a $250.00 BUY on "..."
   ✅ Webhook notification sent
   ```

2. **In Discord**: A message in the channel where you created the webhook with:
   - Alert type and emoji
   - Trader address
   - Trade amount
   - Market name

### If You Don't See Alerts:

The whale threshold is currently **$50** - most trades should trigger it. If nothing appears after 2-3 minutes:

1. Check the terminal output for trade monitoring
2. Look for any webhook errors
3. Verify your Discord webhook URL is correct in `.env`

## 🚀 Running Options

### Option 1: With Web Dashboard (Current)
```bash
cd /Users/ljmac/urban-octo-palm-tree/urban-octo-palm-tree
npm run dev
```
- Backend monitoring + Discord alerts
- Web interface at http://localhost:3000
- See live whale activity, top traders, markets

### Option 2: Backend Only (No Webapp Needed)
```bash
cd /Users/ljmac/urban-octo-palm-tree/urban-octo-palm-tree/backend
tsx src/index.ts
```
- Just monitoring + Discord alerts
- No browser needed
- Perfect for running in background
- Lower resource usage

### Option 3: Production Mode
```bash
cd /Users/ljmac/urban-octo-palm-tree/urban-octo-palm-tree/backend
npm run build
npm start
```
- Compiled TypeScript
- Most efficient
- Recommended for 24/7 running

## 📊 Adjusting Alert Sensitivity

Edit `backend/.env`:

```bash
# Current (testing - catches most trades)
WHALE_THRESHOLD=50
LARGE_MOVEMENT_THRESHOLD=50

# Recommended for real monitoring (fewer alerts)
WHALE_THRESHOLD=10000
LARGE_MOVEMENT_THRESHOLD=5000

# Only major whales (very few alerts)
WHALE_THRESHOLD=50000
LARGE_MOVEMENT_THRESHOLD=20000
```

After changing, restart the bot for changes to take effect.

## 🔔 What Gets Sent to Discord

**HIGH Severity Alerts (sent to Discord):**
- 🐋 **NEW_WHALE**: First time a large trader appears
- 💰 **WHALE**: Known large trader makes another big move
- 📈 **LARGE_MOVEMENT**: Any trade over threshold

**MEDIUM Severity (shown in app, not sent to Discord):**
- 📊 **UNUSUAL_VOLUME**: Market sees abnormal trading volume

To change what gets sent, edit `backend/src/notification-service.ts` line 24.

## 🖥️ Running in Background (24/7 Monitoring)

### macOS (your system):
```bash
# Start in background
cd /Users/ljmac/urban-octo-palm-tree/urban-octo-palm-tree/backend
nohup tsx src/index.ts > monitor.log 2>&1 &

# Check if running
ps aux | grep tsx

# View logs
tail -f monitor.log

# Stop
pkill -f "tsx src/index.ts"
```

### Using screen (recommended for servers):
```bash
# Start a screen session
screen -S polymarket-monitor

# Inside screen, run:
cd /Users/ljmac/urban-octo-palm-tree/urban-octo-palm-tree/backend
tsx src/index.ts

# Detach with: Ctrl+A then D
# Reattach later with: screen -r polymarket-monitor
```

## 📱 Checking the Web Dashboard

Open http://localhost:3000 to see:

- **Top 10 Traders** (by 24h volume)
- **Top 10 Markets** (most active)
- **Largest Trades** (biggest individual trades)
- **Live Alerts** (whale activity)
- **Recent Trades** (all detected trades)
- **Market Stats** (volume, price changes)

Click **⚙️ Settings** to view notification configuration.

## 🐛 Troubleshooting

### "No alerts appearing in Discord"

1. **Check the webhook URL**: Should start with `https://discord.com/api/webhooks/`
2. **Verify it's enabled**: `NOTIFICATIONS_ENABLED=true` in `.env`
3. **Look for errors**: Check terminal for "Error sending webhook"
4. **Test the webhook manually**:
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     -d '{"content": "Test from Polymarket bot!"}' \
     "YOUR_WEBHOOK_URL_HERE"
   ```

### "Bot not finding any trades"

- The Data API is public and should work
- Check terminal for "Monitoring X active markets"
- Trades appear every 1-2 seconds on Polymarket

### "Web dashboard blank"

- Make sure both frontend and backend are running
- Backend should show "API server running on port 3001"
- Frontend should show "Local: http://localhost:3000"
- Try refreshing the browser

## 📈 Next Steps

1. **Test for 5-10 minutes** with current $50 threshold
2. **Check Discord** for whale alerts
3. **View the dashboard** at http://localhost:3000
4. **Raise threshold** to $10,000 for real monitoring
5. **Run in background** for continuous monitoring

## 💡 Tips

- **Lower threshold** = More alerts (good for testing)
- **Higher threshold** = Only major whales (less noise)
- **Check interval** = 60 seconds (can be changed in `.env`)
- **Discord is free** and works forever - no API keys needed!
- **Webapp is optional** - backend works standalone

---

**Your bot is monitoring right now!** Check your Discord channel in 1-2 minutes for whale alerts! 🐋
