# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dual-Platform Prediction Market Trading Terminal** - A professional trading platform that combines Kalshi execution with Polymarket intelligence. Primary use case: Execute trades on Kalshi (US-regulated) while monitoring Polymarket whale activity, sentiment signals, and arbitrage opportunities.

### Vision: Best of Both Worlds

**Trading Execution** (Kalshi):
- 🤖 **Bot Trading**: Automated trade execution via Kalshi API
- 💰 **Position Management**: Real-time portfolio tracking
- 📊 **Order Management**: Create, modify, cancel orders programmatically
- 🔐 **Account Integration**: Secure OAuth authentication
- 📈 **Higher Volume**: Access to 60% market share platform

**Market Intelligence** (Polymarket):
- 🐋 **Whale Tracking**: Monitor large trader addresses and positions
- 🚨 **Smart Alerts**: Get notified when whales move markets
- 🧠 **Sentiment Analysis**: Track trader clustering and behavior
- 🔍 **Trade Transparency**: Full visibility into market participant activity
- 📉 **Technical Analysis**: Advanced charting and indicators

**Cross-Platform Features**:
- ⚖️ **Arbitrage Detection**: Identify price discrepancies between platforms
- 🔄 **Market Matching**: Auto-match equivalent events across Kalshi/Polymarket
- 💡 **Smart Signals**: Polymarket whale moves → Kalshi trade opportunities
- 📊 **Dual Dashboard**: Side-by-side comparison of both platforms
- 🎯 **Strategy Testing**: Backtest using Polymarket sentiment + Kalshi execution

**See CLAUDE.instructions for comprehensive implementation plan and roadmap.**

## Architecture

**Monorepo Structure** using npm workspaces:
- `backend/` - Node.js/TypeScript server with Express REST API, SQLite database, WebSocket server
- `frontend/` - React/TypeScript SPA with Vite, Tailwind CSS, real-time WebSocket updates

## Common Commands

```bash
# Development (runs both backend and frontend)
npm run dev

# Build both packages
npm run build

# Backend only
cd backend && npm run dev      # Development with hot reload
cd backend && npm run build    # Compile TypeScript
cd backend && npm start        # Run compiled JS

# Frontend only
cd frontend && npm run dev     # Vite dev server
cd frontend && npm run build   # Production build
cd frontend && npm run lint    # ESLint check
```

## Backend Structure (`backend/src/`)

### Core Services
- `index.ts` - Entry point, initializes database, server, and monitors
- `server.ts` - Express API routes and middleware (100+ endpoints)
- `websocket-server.ts` - Real-time WebSocket updates to frontend
- `database.ts` - SQLite persistence layer (better-sqlite3)
- `polymarket-client.ts` - Polymarket Gamma/CLOB/Data API integration
- `kalshi-client.ts` - Kalshi trading API integration

### Monitoring & Alerts (Legacy)
- `monitor.ts` / `enhanced-monitor.ts` - Market monitoring logic
- `notification-service.ts` - Discord webhook notifications
- `detection/` - Price impact and cluster detection algorithms
- `scoring/` - Alert severity scoring, market metrics
- `routing/` - Alert routing, cooldown management
- `config/` - Alert configuration

### Analytics & Data
- `analytics/` - Market metrics, comparative analysis, trend detection, arbitrage detection
- `aggregation/` - Time-series data, category grouping, platform aggregation
- `jobs/` - Background data collection and metric recalculation
- `trading/` - Kalshi order execution, position management, bot strategies
- `matching/` - Cross-platform event matching, market normalization
- `types/` - TypeScript type definitions

## Frontend Structure (`frontend/src/`)

### Current Structure
- `App.tsx` - Main app with React Router
- `pages/` - DashboardPage, LeaderboardsPage
- `components/` - Dashboard, AlertList, WhaleList, MarketList, TopTen, PriceChart, etc.
- `useWebSocket.ts` - Real-time WebSocket hook
- `api.ts` - REST API client
- `types.ts` - Shared TypeScript types

### Enhanced Structure (Current + Planned)
- `pages/` - TradingDashboard, ArbitrageView, AnalyticsDashboard, MarketExplorer, WhaleDetail, etc.
- `components/charts/` - CorrelationHeatmap, CategoryHeatmap, PriceHistoryChart, VolumeChart, etc.
- `components/analytics/` - MetricsCard, MarketScreener, ArbitrageFinder, etc.
- `components/trading/` - OrderForm, PositionManager, TradeHistory, BotControls
- `components/matching/` - MarketMatcher, DualPriceDisplay, SpreadCalculator
- `hooks/` - useMarketMetrics, useKalshiAccount, useArbitrage, useWhaleAlerts
- `store/` - State management (Zustand or Context API)

## Configuration

Backend environment variables (`backend/.env`):

**Core Settings:**
- `PORT` - API server port (default: 3001)
- `CHECK_INTERVAL_SECONDS` - Polling interval for market updates

**Polymarket Intelligence:**
- `WHALE_THRESHOLD` - USD value to classify as whale trade (default: 10000)
- `LARGE_MOVEMENT_THRESHOLD` - USD value for large movement alerts
- `NOTIFICATIONS_ENABLED` - Enable Discord webhook notifications
- `NOTIFICATION_WEBHOOK` - Discord webhook URL
- `USE_ENHANCED_MONITOR` - Use enhanced monitoring with advanced detection

**Kalshi Trading Account:**
- `KALSHI_ENABLED` - Enable Kalshi trading features (default: true)
- `KALSHI_EMAIL` - Your Kalshi account email
- `KALSHI_PASSWORD` - Your Kalshi account password
- `KALSHI_API_KEY` - Alternative: Use API key instead of email/password
- `KALSHI_DEMO_MODE` - Use demo account for testing (default: false)

**Arbitrage Detection:**
- `ARBITRAGE_MIN_SPREAD` - Minimum spread % to trigger arbitrage alert (default: 2.0)
- `ARBITRAGE_CHECK_INTERVAL` - How often to check for arbitrage (seconds, default: 30)
- `AUTO_TRADE_ENABLED` - Enable automated bot trading (default: false, REQUIRES MANUAL ENABLE)
- `MAX_POSITION_SIZE` - Maximum $ per automated trade (default: 100)

## Database

SQLite stored at `backend/data/polymarket.db`:

**Polymarket Intelligence:**
- `trades` - All detected Polymarket trades with trader addresses
- `whale_activity` - Aggregated whale trading data
- `alerts` - Generated alerts (NEW_WHALE, LARGE_MOVEMENT, UNUSUAL_VOLUME)
- `market_stats` - 24-hour rolling statistics

**Analytics:**
- `price_history` - OHLCV candlestick data for both platforms
- `market_metrics` - Volatility, momentum, Sharpe ratio calculations
- `market_categories` - Auto-detected market categories
- `market_correlations` - Inter-market correlation data

**Kalshi Trading:**
- `kalshi_orders` - Order history (placed, filled, cancelled)
- `kalshi_positions` - Current open positions
- `kalshi_trades` - Executed trade history

**Cross-Platform:**
- `market_matches` - Links equivalent events between Kalshi and Polymarket
- `arbitrage_opportunities` - Detected price spreads with timestamps
- `arbitrage_executions` - Trades executed based on arbitrage signals

## API Endpoints

### Current Endpoints (100+)

**Health & System**
- `GET /health` - Health check
- `GET /api/health` - Detailed health status

**Alerts & Monitoring (Legacy)**
- `GET /api/alerts` - Get alerts (supports `?unreadOnly=true`)
- `POST /api/alerts/:id/read` - Mark alert as read
- `GET /api/whales` - Get whale activity
- `GET /api/whales/:address` - Get specific trader activity

**Markets - Polymarket**
- `GET /api/markets` - Get active markets (limit, filters)
- `GET /api/markets/:id` - Get specific market
- `GET /api/markets/:id/trades` - Market trade history
- `GET /api/markets/:id/price-history` - OHLCV candlestick data
- `GET /api/markets/:id/momentum` - Volume & price change metrics
- `GET /api/markets/:id/orderbook-depth` - Bid/ask depth analysis
- `GET /api/markets/volume-leaders` - Top markets by volume
- `GET /api/markets/new` - Recently created markets
- `GET /api/markets/closing-soon` - Markets closing within hours
- `GET /api/markets/hot` - High momentum markets
- `GET /api/markets/by-tag/:tag` - Filter by category

**Events**
- `GET /api/events` - Event groupings (related markets)

**Trades**
- `GET /api/trades/recent` - Recent trades (filtered $500+, no crypto)

**Top 10 Leaderboards**
- `GET /api/top/traders` - Top traders by volume
- `GET /api/top/markets` - Top markets by volume
- `GET /api/top/trades` - Largest recent trades
- `GET /api/top/most-active` - Markets by trade count
- `GET /api/top/new-whales` - New large traders
- `GET /api/top/closing-today` - Markets closing within 24h
- `GET /api/top/price-movers` - Biggest price changes

**Platform Stats**
- `GET /api/stats` - Market statistics
- `GET /api/volume/hourly` - Platform-wide volume (estimated)

**Kalshi (if enabled)**
- `GET /api/kalshi/markets` - Kalshi markets
- `GET /api/kalshi/markets/:ticker` - Specific market
- `GET /api/kalshi/markets/:ticker/trades` - Trade history
- `GET /api/kalshi/markets/:ticker/orderbook` - Live orderbook
- `GET /api/kalshi/trades/recent` - Recent trades
- `GET /api/kalshi/events` - Event groupings
- `GET /api/kalshi/status` - Connection status

**Notifications**
- `GET /api/notifications/settings` - Get notification config
- `POST /api/notifications/settings` - Update notification config

**Analytics Endpoints (See CLAUDE.instructions)**
- `GET /api/analytics/market/:id/metrics` - All metrics for one market
- `GET /api/analytics/market/:id/compare/:otherId` - Compare two markets
- `GET /api/analytics/categories` - Market categories with stats
- `GET /api/analytics/correlation-matrix` - Market relationships
- `GET /api/analytics/market/:id/price-history` - OHLCV candlestick data
- And many more...

**Kalshi Trading Endpoints (NEW)**
- `POST /api/kalshi/auth/login` - Authenticate with Kalshi account
- `GET /api/kalshi/auth/status` - Check authentication status
- `GET /api/kalshi/account/balance` - Get account balance
- `GET /api/kalshi/account/positions` - Get open positions
- `POST /api/kalshi/orders/create` - Place a new order
- `GET /api/kalshi/orders` - List your orders (open/filled/cancelled)
- `DELETE /api/kalshi/orders/:id` - Cancel an order
- `GET /api/kalshi/trades/history` - Your trade history

**Arbitrage & Matching Endpoints (NEW)**
- `GET /api/arbitrage/opportunities` - Current arbitrage opportunities
- `GET /api/arbitrage/history` - Past arbitrage detections
- `POST /api/arbitrage/execute` - Execute arbitrage trade on Kalshi
- `GET /api/matching/events` - Matched events across platforms
- `POST /api/matching/create` - Manually link Kalshi<->Polymarket markets
- `GET /api/matching/:kalshiTicker/polymarket` - Get matched Polymarket market

**Bot Trading Endpoints (NEW)**
- `POST /api/bot/start` - Start automated trading bot
- `POST /api/bot/stop` - Stop automated trading bot
- `GET /api/bot/status` - Bot running status and stats
- `POST /api/bot/strategy` - Update bot trading strategy
- `GET /api/bot/performance` - Bot performance metrics

**WebSocket**: `ws://localhost:3001/ws` for real-time updates

## Deployment

- Backend: Fly.io (`fly.toml`, `Dockerfile`)
- Frontend: Vercel (`vercel.json`)

## External Data Sources

### Polymarket APIs
- **CLOB API** (`https://clob.polymarket.com`) - Order management, prices, orderbooks
- **Gamma API** (`https://gamma-api.polymarket.com`) - Market discovery, metadata, events
- **Data API** (`https://data-api.polymarket.com`) - User positions, activity, price history
- **WebSocket** - Real-time orderbook updates and price feeds
- **Documentation**: https://docs.polymarket.com/

### Kalshi API
- **Trade API** (`https://api.elections.kalshi.com/trade-api/v2`) - Markets, trades, orderbooks
- **WebSocket** - Real-time market data streaming
- **Documentation**: https://docs.kalshi.com/

### Data Capabilities
**What we can pull from APIs:**
- Historical price data (OHLCV format)
- Trade history with trader addresses
- Live orderbooks (bid/ask depth)
- Market metadata (volume, liquidity, end dates)
- Event groupings (related markets)
- User positions and activity
- Real-time price updates via WebSocket
- Market categories/tags

**Time intervals supported:** 1m, 5m, 15m, 1h, 4h, 1d

## Key Dependencies

**Backend:** express, better-sqlite3, ws, axios, @polymarket/clob-client, ethers, node-cron
**Frontend:** react, react-router-dom, recharts, date-fns, tailwindcss, vite

**Planned additions:**
- **Backend**: redis (caching), bull (job queue), zod (validation)
- **Frontend**: react-query (data fetching), zustand (state), d3 (custom charts), react-financial-charts (candlesticks)

## Development Guidelines

### When Building Analytics Features
1. **Cache expensive calculations** (use Redis or in-memory with TTL)
2. **Filter noise aggressively** (exclude crypto markets, small trades <$500)
3. **Pre-calculate metrics** (use background jobs, don't compute on-demand)
4. **Respect API rate limits** (cache responses, batch requests)
5. **Optimize database queries** (add indexes, use prepared statements)
6. **Lazy load charts** (don't render all visualizations at once)

### When Building Trading Features
1. **Safety first** - Never auto-enable bot trading, require explicit user confirmation
2. **Demo mode** - Test all trading logic in Kalshi demo account first
3. **Position limits** - Enforce MAX_POSITION_SIZE on all automated trades
4. **Error handling** - Gracefully handle API failures, don't leave hanging orders
5. **Audit trail** - Log every order placement, modification, cancellation
6. **Order validation** - Verify prices, sizes, tickers before submission
7. **Rate limiting** - Respect Kalshi API rate limits (authenticated: higher limits)
8. **Secure credentials** - Store Kalshi API keys encrypted, never in frontend
9. **Confirmation dialogs** - Always confirm before executing real trades
10. **Paper trading** - Provide dry-run mode for strategy testing

### Arbitrage Detection
1. **Accurate matching** - Verify Kalshi and Polymarket markets are truly equivalent
2. **Fee calculations** - Include trading fees in spread calculations
3. **Execution speed** - Arbitrage windows close fast, minimize latency
4. **Slippage estimation** - Account for potential price movement during execution
5. **Market impact** - Avoid large orders that move the market
6. **Alert fatigue** - Only show arbitrage opportunities above MIN_SPREAD threshold

### Design Principles
- **Professional aesthetic** - Clean, Bloomberg/TradingView-inspired UI
- **Performance first** - Fast load times, smooth interactions
- **Mobile-friendly** - Responsive design for all screen sizes
- **Discoverable** - Clear navigation, searchable content
- **Trading-focused** - Emphasize actionable signals over raw data
