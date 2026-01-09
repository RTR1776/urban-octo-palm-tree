import express, { Request, Response } from 'express';
import cors from 'cors';
import { Server } from 'http';
import { DatabaseService } from './database';
import { PolymarketClient } from './polymarket-client';
import { KalshiClient } from './kalshi-client';
import { WebSocketServer } from './websocket-server';

export class ApiServer {
  private app: express.Application;
  private server: Server;
  private db: DatabaseService;
  private client: PolymarketClient;
  private kalshiClient?: KalshiClient;
  private wsServer: WebSocketServer;

  constructor(db: DatabaseService, client: PolymarketClient, kalshiClient?: KalshiClient) {
    this.app = express();
    this.db = db;
    this.client = client;
    this.kalshiClient = kalshiClient;
    this.setupMiddleware();
    this.setupRoutes();
    if (this.kalshiClient) {
      this.setupKalshiRoutes();
    }
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

    // NEW: Top 10 Most Active Markets (by trade count)
    this.app.get('/api/top/most-active', async (req: Request, res: Response) => {
      try {
        const trades = await this.client.getAllRecentTrades(1000);
        const marketActivity = new Map<string, {
          market_id: string;
          title: string;
          tradeCount: number;
          volume: number;
          lastPrice: number;
        }>();

        trades.forEach(trade => {
          const existing = marketActivity.get(trade.market_id);
          const value = trade.size * trade.price;

          if (existing) {
            existing.tradeCount += 1;
            existing.volume += value;
            existing.lastPrice = trade.price;
          } else {
            marketActivity.set(trade.market_id, {
              market_id: trade.market_id,
              title: trade.title || 'Unknown Market',
              tradeCount: 1,
              volume: value,
              lastPrice: trade.price,
            });
          }
        });

        const top = Array.from(marketActivity.values())
          .sort((a, b) => b.tradeCount - a.tradeCount)
          .slice(0, 10);

        res.json(top);
      } catch (error) {
        console.error('Most active error:', error);
        res.status(500).json({ error: 'Failed to fetch most active markets' });
      }
    });

    // NEW: Top 10 New Whales (first-time large traders)
    this.app.get('/api/top/new-whales', async (req: Request, res: Response) => {
      try {
        const trades = await this.client.getAllRecentTrades(1000);
        const whaleMap = new Map<string, {
          address: string;
          totalVolume: number;
          tradeCount: number;
          largestTrade: number;
          firstTradeTime: number;
          markets: Set<string>;
        }>();

        trades.forEach(trade => {
          if (!trade.trader_address) return;
          const value = trade.size * trade.price;

          const existing = whaleMap.get(trade.trader_address);
          if (existing) {
            existing.totalVolume += value;
            existing.tradeCount += 1;
            existing.largestTrade = Math.max(existing.largestTrade, value);
            existing.markets.add(trade.market_id);
          } else {
            whaleMap.set(trade.trader_address, {
              address: trade.trader_address,
              totalVolume: value,
              tradeCount: 1,
              largestTrade: value,
              firstTradeTime: trade.timestamp,
              markets: new Set([trade.market_id]),
            });
          }
        });

        // Filter to new whales: few trades but high volume
        const newWhales = Array.from(whaleMap.values())
          .filter(w => w.tradeCount <= 5 && w.totalVolume >= 5000)
          .map(w => ({
            address: w.address,
            totalVolume: w.totalVolume,
            tradeCount: w.tradeCount,
            largestTrade: w.largestTrade,
            marketsCount: w.markets.size,
            firstSeen: w.firstTradeTime,
          }))
          .sort((a, b) => b.totalVolume - a.totalVolume)
          .slice(0, 10);

        res.json(newWhales);
      } catch (error) {
        console.error('New whales error:', error);
        res.status(500).json({ error: 'Failed to fetch new whales' });
      }
    });

    // NEW: Top 10 Closing Today (markets resolving within 24h)
    this.app.get('/api/top/closing-today', async (req: Request, res: Response) => {
      try {
        const closing = await this.client.getClosingSoonMarkets(24, 10);
        const formatted = closing.map(m => ({
          market_id: m.id,
          question: m.question,
          end_date: m.end_date,
          volume: m.volume || 0,
          price: m.tokens?.[0]?.price || 0.5,
          hoursRemaining: Math.max(0, (new Date(m.end_date).getTime() - Date.now()) / (1000 * 60 * 60)),
        }));
        res.json(formatted);
      } catch (error) {
        console.error('Closing today error:', error);
        res.status(500).json({ error: 'Failed to fetch closing markets' });
      }
    });

    // NEW: Top 10 Price Movers (estimated from recent trade activity)
    this.app.get('/api/top/price-movers', async (req: Request, res: Response) => {
      try {
        const trades = await this.client.getAllRecentTrades(1000);
        const marketPrices = new Map<string, {
          market_id: string;
          title: string;
          prices: number[];
          volume: number;
        }>();

        // Group trades by market and collect prices
        trades.forEach(trade => {
          const existing = marketPrices.get(trade.market_id);
          const value = trade.size * trade.price;

          if (existing) {
            existing.prices.push(trade.price);
            existing.volume += value;
          } else {
            marketPrices.set(trade.market_id, {
              market_id: trade.market_id,
              title: trade.title || 'Unknown Market',
              prices: [trade.price],
              volume: value,
            });
          }
        });

        // Calculate price change for each market
        const movers = Array.from(marketPrices.values())
          .filter(m => m.prices.length >= 3) // Need enough trades to estimate
          .map(m => {
            const firstPrice = m.prices[m.prices.length - 1]; // Oldest
            const lastPrice = m.prices[0]; // Newest
            const priceChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

            return {
              market_id: m.market_id,
              title: m.title,
              priceChange: priceChange,
              currentPrice: lastPrice,
              volume: m.volume,
              tradeCount: m.prices.length,
            };
          })
          .sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange))
          .slice(0, 10);

        res.json(movers);
      } catch (error) {
        console.error('Price movers error:', error);
        res.status(500).json({ error: 'Failed to fetch price movers' });
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

    // Hourly volume - aggregate from recent trades
    this.app.get('/api/volume/hourly', async (req: Request, res: Response) => {
      try {
        // Fetch recent trades (up to 2000 to get more coverage)
        const trades = await this.client.getAllRecentTrades(2000);
        
        // Filter to trades within the last hour
        const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
        const hourlyTrades = trades.filter(t => t.timestamp > oneHourAgo);
        
        // Sum up the total volume
        const volume = hourlyTrades.reduce((sum, trade) => {
          return sum + (trade.size * trade.price);
        }, 0);

        res.json({ 
          volume,
          tradeCount: hourlyTrades.length,
          periodStart: oneHourAgo,
          periodEnd: Math.floor(Date.now() / 1000),
        });
      } catch (error) {
        console.error('Hourly volume error:', error);
        res.status(500).json({ error: 'Failed to fetch hourly volume' });
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

    // ========== Enhanced Market Discovery Endpoints ==========

    // Get trending events (event-level groupings)
    this.app.get('/api/events', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 20;
        const events = await this.client.getEvents(limit);
        res.json(events);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch events' });
      }
    });

    // Get volume leader markets
    // Volume leaders
    console.log('[SETUP] Registering /api/markets/volume-leaders endpoint');
    this.app.get('/api/markets/volume-leaders', async (req: Request, res: Response) => {
      console.log('[ENDPOINT HIT] /api/markets/volume-leaders');
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        console.log(`[API] Fetching volume leaders (limit: ${limit})`);
        const leaders = await this.client.getVolumeLeaders(limit);
        console.log(`[API] Got leaders:`, leaders);
        console.log(`[API] Returning ${leaders ? leaders.length : 'null'} volume leaders`);
        res.json(leaders);
      } catch (error: any) {
        console.error('Volume leaders error:', error?.message || error);
        res.status(500).json({ error: 'Failed to fetch volume leaders' });
      }
    });

    // Get newly created markets
    this.app.get('/api/markets/new', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        console.log(`[API] Fetching new markets (limit: ${limit})`);
        const newMarkets = await this.client.getNewMarkets(limit);
        console.log(`[API] Returning ${newMarkets.length} new markets`);
        res.json(newMarkets);
      } catch (error) {
        console.error('New markets error:', error);
        res.status(500).json({ error: 'Failed to fetch new markets' });
      }
    });

    // Get markets closing soon
    this.app.get('/api/markets/closing-soon', async (req: Request, res: Response) => {
      try {
        const hours = parseInt(req.query.hours as string) || 24;
        const limit = parseInt(req.query.limit as string) || 10;
        console.log(`[API] Fetching markets closing in ${hours} hours (limit: ${limit})`);
        const closing = await this.client.getClosingSoonMarkets(hours, limit);
        console.log(`[API] Returning ${closing.length} closing markets`);
        res.json(closing);
      } catch (error) {
        console.error('Closing markets error:', error);
        res.status(500).json({ error: 'Failed to fetch closing markets' });
      }
    });

    // Get markets by category/tag
    this.app.get('/api/markets/by-tag/:tag', async (req: Request, res: Response) => {
      try {
        const tag = req.params.tag;
        const limit = parseInt(req.query.limit as string) || 50;
        console.log(`[API] Fetching markets for tag '${tag}' (limit: ${limit})`);
        const markets = await this.client.getMarketsByTag(tag, limit);
        console.log(`[API] Returning ${markets.length} markets for tag '${tag}'`);
        res.json(markets);
      } catch (error) {
        console.error('Markets by tag error:', error);
        res.status(500).json({ error: 'Failed to fetch markets by tag' });
      }
    });

    // Get price history/candlestick data
    this.app.get('/api/markets/:id/price-history', async (req: Request, res: Response) => {
      try {
        const marketId = req.params.id;
        const interval = (req.query.interval as any) || '1h';
        const startTs = req.query.startTs ? parseInt(req.query.startTs as string) : undefined;
        const endTs = req.query.endTs ? parseInt(req.query.endTs as string) : undefined;
        
        const history = await this.client.getPriceHistory(marketId, interval, startTs, endTs);
        res.json(history);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch price history' });
      }
    });

    // Get market momentum analysis
    this.app.get('/api/markets/:id/momentum', async (req: Request, res: Response) => {
      try {
        const marketId = req.params.id;
        const momentum = await this.client.getMarketMomentum(marketId);
        res.json(momentum || { volumeChange: 0, priceChange: 0, momentumScore: 0 });
      } catch (error) {
        res.status(500).json({ error: 'Failed to analyze momentum' });
      }
    });

    // Get orderbook depth for liquidity analysis
    this.app.get('/api/markets/:id/orderbook-depth', async (req: Request, res: Response) => {
      try {
        const tokenId = req.params.id;
        const depth = await this.client.getOrderBookDepth(tokenId);
        res.json(depth);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orderbook depth' });
      }
    });

    // Get hot markets (high volume + activity)
    this.app.get('/api/markets/hot', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        
        // Get top volume markets as "hot" for now
        // Momentum calculation is expensive and may not have enough data
        const topMarkets = await this.client.getVolumeLeaders(limit);
        
        // Add mock momentum data
        const hot = topMarkets.map(market => ({
          ...market,
          momentum: (market.volume || 0) / 10000, // Simple momentum score
          priceChange: 0, // Would need historical data
          volumeChange: 0,
        }));

        res.json(hot);
      } catch (error) {
        console.error('Hot markets error:', error);
        res.status(500).json({ error: 'Failed to fetch hot markets' });
      }
    });
  }

  /**
   * Setup Kalshi-specific API routes
   */
  private setupKalshiRoutes(): void {
    if (!this.kalshiClient) return;

    console.log('[SETUP] Registering Kalshi API endpoints');

    // Kalshi markets
    this.app.get('/api/kalshi/markets', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const markets = await this.kalshiClient!.getMarkets(limit);
        res.json(markets);
      } catch (error) {
        console.error('Kalshi markets error:', error);
        res.status(500).json({ error: 'Failed to fetch Kalshi markets' });
      }
    });

    // Kalshi single market
    this.app.get('/api/kalshi/markets/:ticker', async (req: Request, res: Response) => {
      try {
        const market = await this.kalshiClient!.getMarket(req.params.ticker);
        res.json(market);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Kalshi market' });
      }
    });

    // Kalshi trades for a market
    this.app.get('/api/kalshi/markets/:ticker/trades', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const trades = await this.kalshiClient!.getTrades(req.params.ticker, limit);
        res.json(trades);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Kalshi trades' });
      }
    });

    // Kalshi recent trades (aggregated)
    this.app.get('/api/kalshi/trades/recent', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const trades = await this.kalshiClient!.getAllRecentTrades(limit);
        res.json(trades);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Kalshi trades' });
      }
    });

    // Kalshi volume leaders
    this.app.get('/api/kalshi/markets/volume-leaders', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        const leaders = await this.kalshiClient!.getVolumeLeaders(limit);
        res.json(leaders);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Kalshi volume leaders' });
      }
    });

    // Kalshi closing soon
    this.app.get('/api/kalshi/markets/closing-soon', async (req: Request, res: Response) => {
      try {
        const hours = parseInt(req.query.hours as string) || 24;
        const limit = parseInt(req.query.limit as string) || 10;
        const closing = await this.kalshiClient!.getClosingSoonMarkets(hours, limit);
        res.json(closing);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Kalshi closing markets' });
      }
    });

    // Kalshi events
    this.app.get('/api/kalshi/events', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 20;
        const events = await this.kalshiClient!.getEvents(limit);
        res.json(events);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Kalshi events' });
      }
    });

    // Kalshi orderbook
    this.app.get('/api/kalshi/markets/:ticker/orderbook', async (req: Request, res: Response) => {
      try {
        const orderbook = await this.kalshiClient!.getOrderbook(req.params.ticker);
        res.json(orderbook);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Kalshi orderbook' });
      }
    });

    // Combined stats endpoint showing Kalshi status
    this.app.get('/api/kalshi/status', async (req: Request, res: Response) => {
      try {
        const markets = await this.kalshiClient!.getMarkets(5);
        res.json({
          enabled: true,
          authenticated: this.kalshiClient!.isAuthenticated(),
          sampleMarkets: markets.length,
        });
      } catch (error) {
        res.json({
          enabled: true,
          authenticated: false,
          error: 'Failed to connect to Kalshi API',
        });
      }
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
