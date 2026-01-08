# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Polymarket Monitor is a real-time whale activity monitoring system for prediction markets. It tracks large traders, unusual trading patterns, and significant market movements on Polymarket and Kalshi.

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

- `index.ts` - Entry point, initializes database, server, and monitors
- `server.ts` - Express API routes and middleware
- `websocket-server.ts` - Real-time WebSocket updates to frontend
- `database.ts` - SQLite persistence layer (better-sqlite3)
- `polymarket-client.ts` - Polymarket Gamma/CLOB/Data API integration
- `kalshi-client.ts` - Kalshi trading API integration
- `monitor.ts` / `enhanced-monitor.ts` - Market monitoring logic
- `notification-service.ts` - Discord webhook notifications
- `detection/` - Price impact and cluster detection algorithms
- `scoring/` - Alert severity scoring, market metrics
- `routing/` - Alert routing, cooldown management
- `config/` - Alert configuration
- `types/` - TypeScript type definitions

## Frontend Structure (`frontend/src/`)

- `App.tsx` - Main app with React Router
- `pages/` - DashboardPage, LeaderboardsPage
- `components/` - Dashboard, AlertList, WhaleList, MarketList, TopTen, etc.
- `useWebSocket.ts` - Real-time WebSocket hook
- `api.ts` - REST API client
- `types.ts` - Shared TypeScript types

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

- `GET /health` - Health check
- `GET /api/alerts` - Get alerts (supports `?unreadOnly=true`)
- `POST /api/alerts/:id/read` - Mark alert as read
- `GET /api/whales` - Get whale activity
- `GET /api/markets` - Get active markets
- `GET /api/stats` - Get market statistics
- `GET /api/trades/recent` - Get recent trades

WebSocket at `ws://localhost:3001/ws` for real-time updates.

## Deployment

- Backend: Fly.io (`fly.toml`, `Dockerfile`)
- Frontend: Vercel (`vercel.json`)

## Key Dependencies

**Backend:** express, better-sqlite3, ws, axios, @polymarket/clob-client, ethers, node-cron
**Frontend:** react, react-router-dom, recharts, date-fns, tailwindcss, vite
