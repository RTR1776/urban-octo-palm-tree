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
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
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
