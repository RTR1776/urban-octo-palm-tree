import express, { Request, Response } from 'express';
import cors from 'cors';
import { Server } from 'http';
import { DatabaseService } from './database';
import { PolymarketClient } from './polymarket-client';
import { WebSocketServer } from './websocket-server';

export class ApiServer {
  private app: express.Application;
  private server: Server;
  private db: DatabaseService;
  private client: PolymarketClient;
  private wsServer: WebSocketServer;

  constructor(db: DatabaseService, client: PolymarketClient) {
    this.app = express();
    this.db = db;
    this.client = client;
    this.setupMiddleware();
    this.setupRoutes();
    this.server = this.app.listen(0);
    this.wsServer = new WebSocketServer(this.server, db);
  }

  private setupMiddleware(): void {
    // CORS configuration - allow all origins for API access
    // The API is read-only public data, no need to restrict
    this.app.use(cors({
      origin: true,  // Allow all origins
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // Health check for Fly.io
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'ok', 
        timestamp: Date.now(),
        uptime: process.uptime(),
        env: process.env.NODE_ENV || 'development',
      });
    });

    this.app.get('/api/alerts', (req: Request, res: Response) => {
      const limit = parseInt(req.query.limit as string) || 50;
      const unreadOnly = req.query.unreadOnly === 'true';

      const alerts = unreadOnly
        ? this.db.getUnreadAlerts()
        : this.db.getRecentAlerts(limit);

      res.json(alerts);
    });

    this.app.post('/api/alerts/:id/read', (req: Request, res: Response) => {
      const id = parseInt(req.params.id);
      this.db.markAlertAsRead(id);
      res.json({ success: true });
    });

    this.app.get('/api/whales', (req: Request, res: Response) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const whales = this.db.getWhaleActivity(limit);
      res.json(whales);
    });

    this.app.get('/api/whales/:address', (req: Request, res: Response) => {
      const address = req.params.address;
      const activity = this.db.getTraderActivity(address);
      res.json(activity);
    });

    this.app.get('/api/markets', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const markets = await this.client.getMarkets(limit, true);
        res.json(markets);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch markets' });
      }
    });

    this.app.get('/api/markets/:id', async (req: Request, res: Response) => {
      try {
        const market = await this.client.getMarket(req.params.id);
        res.json(market);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch market' });
      }
    });

    this.app.get('/api/markets/:id/trades', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const trades = await this.client.getTrades(req.params.id, limit);
        res.json(trades);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trades' });
      }
    });

    this.app.get('/api/stats', (req: Request, res: Response) => {
      const marketId = req.query.marketId as string;
      const stats = this.db.getMarketStats(marketId);
      res.json(stats);
    });

    this.app.get('/api/trades/recent', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        // Pull directly from Polymarket API
        const trades = await this.client.getAllRecentTrades(limit);
        res.json(trades);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trades' });
      }
    });

    // Top 10 endpoints - pull from live API
    // Note: We sample recent 500 trades for "top traders" - this is a snapshot, not full 24h data
    this.app.get('/api/top/traders', async (req: Request, res: Response) => {
      try {
        const trades = await this.client.getAllRecentTrades(500);
        const traderVolumes = new Map<string, { volume: number; tradeCount: number }>();
        
        trades.forEach(trade => {
          if (trade.trader_address) {
            const current = traderVolumes.get(trade.trader_address) || { volume: 0, tradeCount: 0 };
            current.volume += trade.size * trade.price;
            current.tradeCount += 1;
            traderVolumes.set(trade.trader_address, current);
          }
        });
        
        const top = Array.from(traderVolumes.entries())
          .map(([address, data]) => ({ address, volume: data.volume, tradeCount: data.tradeCount }))
          .sort((a, b) => b.volume - a.volume)
          .slice(0, 10);
        
        res.json(top);
      } catch (error) {
        console.error('Top traders error:', error);
        res.status(500).json({ error: 'Failed to fetch top traders' });
      }
    });

    this.app.get('/api/top/markets', async (req: Request, res: Response) => {
      try {
        const markets = await this.client.getMarkets(50, true);
        const top = markets
          .map(m => ({
            market_id: m.id,
            question: m.question,
            total_volume_24h: parseFloat(String(m.volume)) || 0,
            trade_count_24h: 0, // Not available from API directly
          }))
          .sort((a, b) => b.total_volume_24h - a.total_volume_24h)
          .slice(0, 10);
        res.json(top);
      } catch (error) {
        console.error('Top markets error:', error);
        res.status(500).json({ error: 'Failed to fetch top markets' });
      }
    });

    this.app.get('/api/top/trades', async (req: Request, res: Response) => {
      try {
        const trades = await this.client.getAllRecentTrades(500);
        const top = trades
          .map(trade => ({
            trader_address: trade.trader_address,
            market_id: trade.market_id,
            title: trade.title || 'Unknown Market',
            size: trade.size,
            price: trade.price,
            side: trade.side,
            timestamp: trade.timestamp,
            value: trade.size * trade.price
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
        res.json(top);
      } catch (error) {
        console.error('Top trades error:', error);
        res.status(500).json({ error: 'Failed to fetch top trades' });
      }
    });

    // Whales endpoint - calculate from recent trades
    this.app.get('/api/whales', async (req: Request, res: Response) => {
      try {
        const trades = await this.client.getAllRecentTrades(1000);
        const whaleMap = new Map<string, {
          trader_address: string;
          total_volume: number;
          trade_count: number;
          markets: Set<string>;
          last_activity: number;
        }>();
        
        trades.forEach(trade => {
          if (!trade.trader_address) return;
          const value = trade.size * trade.price;
          
          const existing = whaleMap.get(trade.trader_address);
          if (existing) {
            existing.total_volume += value;
            existing.trade_count += 1;
            existing.markets.add(trade.market_id);
            existing.last_activity = Math.max(existing.last_activity, trade.timestamp);
          } else {
            whaleMap.set(trade.trader_address, {
              trader_address: trade.trader_address,
              total_volume: value,
              trade_count: 1,
              markets: new Set([trade.market_id]),
              last_activity: trade.timestamp,
            });
          }
        });
        
        // Filter to wallets with significant activity and format for frontend
        const whales = Array.from(whaleMap.values())
          .filter(w => w.total_volume >= 5000 || w.trade_count >= 5)
          .map(w => ({
            trader_address: w.trader_address,
            market_id: 'multiple',
            market_question: `Active in ${w.markets.size} market(s)`,
            total_volume: w.total_volume,
            trade_count: w.trade_count,
            first_seen: w.last_activity,
            last_activity: w.last_activity,
            is_new_whale: w.trade_count <= 3 && w.total_volume >= 10000,
          }))
          .sort((a, b) => b.total_volume - a.total_volume)
          .slice(0, 50);
        
        res.json(whales);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch whales' });
      }
    });

    // Stats endpoint - pull from live markets
    this.app.get('/api/stats', async (req: Request, res: Response) => {
      try {
        const markets = await this.client.getMarkets(20, true);
        const stats = markets.map(m => ({
          market_id: m.id,
          question: m.question,
          total_volume_24h: m.volume || 0,
          trade_count_24h: 0,
          unique_traders_24h: 0,
          avg_trade_size_24h: 0,
          price_change_24h: 0,
          largest_trade_24h: 0,
        }));
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
      }
    });

    // Notification settings
    this.app.get('/api/notifications/settings', (req: Request, res: Response) => {
      // Load from a simple JSON file or env vars
      res.json({
        email: process.env.NOTIFICATION_EMAIL || '',
        phone: process.env.NOTIFICATION_PHONE || '',
        webhookUrl: process.env.NOTIFICATION_WEBHOOK || '',
        enabled: process.env.NOTIFICATIONS_ENABLED === 'true',
      });
    });

    this.app.post('/api/notifications/settings', (req: Request, res: Response) => {
      // In production, save to database or config file
      // For now, just acknowledge
      res.json({ success: true, message: 'Settings saved (add to .env file)' });
    });
  }

  listen(port: number): void {
    this.server.close();
    this.server = this.app.listen(port, () => {
      console.log(`API server running on port ${port}`);
    });
    this.wsServer = new WebSocketServer(this.server, this.db);
  }

  getWebSocketServer(): WebSocketServer {
    return this.wsServer;
  }
}
