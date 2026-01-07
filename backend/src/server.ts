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
    // CORS configuration for production
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
    ];
    
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
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

    this.app.get('/api/trades/recent', (req: Request, res: Response) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const trades = this.db.getRecentTrades(limit);
      res.json(trades);
    });

    // Top 10 endpoints
    this.app.get('/api/top/traders', (req: Request, res: Response) => {
      const trades = this.db.getRecentTrades(1000);
      const traderVolumes = new Map<string, number>();
      
      trades.forEach(trade => {
        if (trade.trader_address) {
          const current = traderVolumes.get(trade.trader_address) || 0;
          traderVolumes.set(trade.trader_address, current + (trade.size * trade.price));
        }
      });
      
      const top = Array.from(traderVolumes.entries())
        .map(([address, volume]) => ({ address, volume }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10);
      
      res.json(top);
    });

    this.app.get('/api/top/markets', (req: Request, res: Response) => {
      const stats = this.db.getMarketStats();
      const top = stats
        .sort((a, b) => b.total_volume_24h - a.total_volume_24h)
        .slice(0, 10);
      res.json(top);
    });

    this.app.get('/api/top/trades', (req: Request, res: Response) => {
      const trades = this.db.getRecentTrades(1000);
      const top = trades
        .map(trade => ({
          ...trade,
          value: trade.size * trade.price
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
      res.json(top);
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
