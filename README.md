# Polymarket Monitor

A comprehensive monitoring system for Polymarket prediction markets that tracks whale activity, large movements, and unusual trading patterns in real-time.

## Features

- **Real-time Monitoring**: Continuously tracks all active Polymarket markets
- **Whale Detection**: Identifies large traders and tracks their activity across markets
- **New Whale Alerts**: Automatically detects when new whales enter the market
- **Large Movement Tracking**: Monitors for significant trades above configurable thresholds
- **Unusual Volume Detection**: Identifies markets with abnormal trading volume spikes
- **Live Dashboard**: React-based web interface with real-time WebSocket updates
- **Historical Data**: SQLite database stores all trades, whale activity, and alerts
- **Market Statistics**: 24-hour rolling statistics for all active markets

## Architecture

### Backend
- **Node.js/TypeScript** server with Express REST API
- **Polymarket API Integration** using Gamma, CLOB, and Data APIs
- **SQLite Database** for persistent storage
- **WebSocket Server** for real-time updates to frontend
- **Scheduled Monitoring** with configurable intervals

### Frontend
- **React/TypeScript** with Vite
- **Tailwind CSS** for styling
- **Real-time Updates** via WebSocket
- **Responsive Dashboard** with multiple views

## Prerequisites

- Node.js 18+ and npm
- Git

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd urban-octo-palm-tree
```

2. Install dependencies for both backend and frontend:
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

3. Set up environment variables:
```bash
cd backend
cp .env.example .env
```

Edit `.env` to configure your settings:
```env
PORT=3001
NODE_ENV=development

# Polymarket API endpoints (defaults are fine)
GAMMA_API_URL=https://gamma-api.polymarket.com
CLOB_API_URL=https://clob.polymarket.com
DATA_API_URL=https://data-api.polymarket.com

# Monitoring thresholds
WHALE_THRESHOLD=10000          # USD value to consider a trader a whale
LARGE_MOVEMENT_THRESHOLD=5000  # USD value for large movement alerts
UNUSUAL_VOLUME_MULTIPLIER=3    # Multiplier for unusual volume detection
CHECK_INTERVAL_SECONDS=60      # How often to check markets (in seconds)

# Database
DB_PATH=./data/polymarket.db
```

## Running the Application

### Development Mode

Run both backend and frontend in development mode:
```bash
npm run dev
```

This will start:
- Backend API server on `http://localhost:3001`
- Frontend dev server on `http://localhost:3000`

### Production Mode

1. Build both applications:
```bash
npm run build
```

2. Start the backend:
```bash
cd backend
npm start
```

3. Serve the frontend (you'll need a static file server):
```bash
cd frontend
npx serve -s dist -p 3000
```

## Usage

### Web Dashboard

Navigate to `http://localhost:3000` to access the dashboard, which shows:

1. **Overview Cards**
   - Unread alerts count
   - Active whales count
   - New whales in last 24 hours

2. **Alert Feed**
   - Real-time alerts for whale activity, large movements, and unusual volume
   - Color-coded by severity (High/Medium/Low)
   - Timestamps and trade values

3. **Whale Activity**
   - List of all detected whales
   - Total volume and trade count per market
   - "NEW" badge for newly detected whales

4. **Recent Trades**
   - Live feed of all trades across monitored markets
   - Buy/Sell indicators
   - Trade size and value

5. **Top Markets**
   - Markets sorted by 24-hour volume
   - Volume, trade count, unique traders
   - 24-hour price change

### API Endpoints

The backend exposes these REST endpoints:

- `GET /health` - Health check
- `GET /api/alerts` - Get recent alerts
- `GET /api/alerts?unreadOnly=true` - Get only unread alerts
- `POST /api/alerts/:id/read` - Mark alert as read
- `GET /api/whales` - Get whale activity
- `GET /api/whales/:address` - Get activity for specific trader
- `GET /api/markets` - Get active markets from Polymarket
- `GET /api/markets/:id` - Get specific market details
- `GET /api/markets/:id/trades` - Get trades for a market
- `GET /api/stats` - Get market statistics
- `GET /api/trades/recent` - Get recent trades

### WebSocket Connection

Connect to `ws://localhost:3001/ws` for real-time updates:

**Incoming message types:**
- `initial_data` - Initial data on connection
- `new_alert` - New alert created
- `new_trade` - New trade detected
- `whale_activity_update` - Whale activity updated

**Outgoing message types:**
- `mark_alert_read` - Mark an alert as read
- `get_whale_activity` - Request whale activity
- `get_alerts` - Request alerts

## Configuration

### Monitoring Thresholds

Adjust these in `backend/.env`:

- **WHALE_THRESHOLD**: Minimum USD value for a trade to be considered whale activity (default: $10,000)
- **LARGE_MOVEMENT_THRESHOLD**: Minimum USD value to trigger large movement alert (default: $5,000)
- **UNUSUAL_VOLUME_MULTIPLIER**: How many times normal volume to trigger unusual activity alert (default: 3x)
- **CHECK_INTERVAL_SECONDS**: How frequently to poll Polymarket APIs (default: 60 seconds)

### Database

The SQLite database is stored at `backend/data/polymarket.db` by default. It contains:

- `trades` - All detected trades
- `whale_activity` - Aggregated whale trading data
- `alerts` - All generated alerts
- `market_stats` - 24-hour rolling statistics

## How It Works

1. **Market Discovery**: The bot fetches all active markets from Polymarket's Gamma API
2. **Trade Collection**: For each market, it retrieves recent trades from the CLOB API
3. **Analysis**: Each trade is analyzed for:
   - Whale activity (large traders)
   - New whale detection (first-time large traders)
   - Large movements (significant trades)
   - Unusual volume (abnormal trading activity)
4. **Alerts**: When patterns are detected, alerts are created and broadcast via WebSocket
5. **Statistics**: Market statistics are calculated and updated regularly
6. **Storage**: All data is persisted to SQLite for historical analysis

## API Sources

This project uses Polymarket's public APIs:
- **Gamma Markets API**: Market discovery and metadata
- **CLOB API**: Order book and trade data
- **Data API**: Position and activity data

No API key is required for read-only access.

## Troubleshooting

### Backend won't start
- Check that port 3001 is not in use
- Verify all dependencies are installed: `cd backend && npm install`
- Check `.env` file exists and is configured

### Frontend won't connect to backend
- Ensure backend is running on port 3001
- Check browser console for WebSocket connection errors
- Verify CORS is not blocking requests

### No data appearing
- The bot needs time to collect initial data
- Check backend logs for API errors
- Verify Polymarket APIs are accessible
- Try reducing CHECK_INTERVAL_SECONDS for faster updates

### Database errors
- Ensure `backend/data` directory exists
- Check file permissions for database file
- Delete `polymarket.db` to start fresh if corrupted

## License

MIT

## Disclaimer

This tool is for informational and educational purposes only. It is not financial advice. Always do your own research before making trading decisions.
