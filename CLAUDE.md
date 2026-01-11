# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Polymarket Analytics Platform** - A comprehensive, multi-dimensional market analysis platform for prediction markets (Polymarket and Kalshi). The platform provides advanced data visualization, market screening, comparative analysis, and portfolio simulation tools comparable to professional trading platforms like TradingView and Bloomberg Terminal.

### Vision
Transform from a simple alert-focused whale tracker into a sophisticated analytics platform with:
- **Advanced charting**: Candlesticks, OHLCV, multi-market overlays
- **Market intelligence**: Volatility, momentum, correlation analysis
- **Powerful screening**: Filter markets by volume, category, performance
- **Comparative analysis**: Cross-market and cross-platform insights
- **Portfolio simulation**: Strategy testing and performance tracking

**See CLAUDE.instructions for comprehensive enhancement plan and roadmap.**

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

### Analytics & Data (Planned - See CLAUDE.instructions)
- `analytics/` - Market metrics, comparative analysis, trend detection
- `aggregation/` - Time-series data, category grouping, platform aggregation
- `jobs/` - Background data collection and metric recalculation
- `types/` - TypeScript type definitions

## Frontend Structure (`frontend/src/`)

### Current Structure
- `App.tsx` - Main app with React Router
- `pages/` - DashboardPage, LeaderboardsPage
- `components/` - Dashboard, AlertList, WhaleList, MarketList, TopTen, PriceChart, etc.
- `useWebSocket.ts` - Real-time WebSocket hook
- `api.ts` - REST API client
- `types.ts` - Shared TypeScript types

### Planned Enhancements (See CLAUDE.instructions)
- `pages/` - AnalyticsDashboard, MarketExplorer, Comparison, CategoryAnalysis, Screener, etc.
- `components/charts/` - Candlestick, AreaChart, VolumeChart, CorrelationMatrix, etc.
- `components/analytics/` - MetricsCard, PerformanceTable, MarketScreener, etc.
- `components/simulation/` - PortfolioBuilder, PerformanceTracker, StrategyTester
- `hooks/` - useMarketMetrics, useComparison, usePortfolio
- `store/` - State management (Zustand or Context API)

## Configuration

Backend environment variables (`backend/.env`):
- `PORT` - API server port (default: 3001)
- `WHALE_THRESHOLD` - USD value to classify as whale trade
- `LARGE_MOVEMENT_THRESHOLD` - USD value for large movement alerts
- `CHECK_INTERVAL_SECONDS` - Polling interval for market updates
- `NOTIFICATIONS_ENABLED` - Enable Discord webhook notifications
- `NOTIFICATION_WEBHOOK` - Discord webhook URL
- `KALSHI_ENABLED` - Enable Kalshi monitoring (requires credentials)
- `USE_ENHANCED_MONITOR` - Use enhanced monitoring with advanced detection

## Database

SQLite stored at `backend/data/polymarket.db`:
- `trades` - All detected trades
- `whale_activity` - Aggregated whale trading data
- `alerts` - Generated alerts (NEW_WHALE, LARGE_MOVEMENT, UNUSUAL_VOLUME)
- `market_stats` - 24-hour rolling statistics

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

**Planned Analytics Endpoints (See CLAUDE.instructions)**
- `GET /api/analytics/market/:id/metrics` - All metrics for one market
- `GET /api/analytics/market/:id/compare/:otherId` - Compare two markets
- `GET /api/analytics/categories` - Market categories with stats
- `GET /api/analytics/correlation-matrix` - Market relationships
- `GET /api/portfolio/:id/performance` - Portfolio tracking
- And many more...

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

### Design Principles
- **Data density over alerts** - Show comprehensive data, not just urgent alerts
- **Professional aesthetic** - Clean, Bloomberg/TradingView-inspired UI
- **Performance first** - Fast load times, smooth interactions
- **Mobile-friendly** - Responsive design for all screen sizes
- **Discoverable** - Clear navigation, searchable content
