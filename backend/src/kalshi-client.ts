/**
 * Kalshi API Client
 * https://trading-api.readme.io/reference/getting-started
 *
 * Kalshi has a public API similar to Polymarket.
 * Key differences:
 * - Uses API key authentication (email/password -> token)
 * - Different data structure for markets/trades
 * - REST API with rate limits
 */

import axios, { AxiosInstance } from 'axios';

// Kalshi API types
export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle?: string;
  status: string;
  close_time: string;
  expiration_time: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  volume_24h: number;
  open_interest: number;
  category: string;
  result?: string;
}

export interface KalshiTrade {
  trade_id: string;
  ticker: string;
  side: 'yes' | 'no';
  yes_price: number;
  no_price: number;
  count: number;
  created_time: string;
  taker_side: 'yes' | 'no';
}

export interface KalshiOrderbook {
  ticker: string;
  yes: Array<[number, number]>; // [price, quantity]
  no: Array<[number, number]>;
}

export interface KalshiEvent {
  event_ticker: string;
  title: string;
  category: string;
  markets: KalshiMarket[];
}

// Normalized types (compatible with Polymarket for easy integration)
export interface NormalizedMarket {
  id: string;
  question: string;
  description: string;
  end_date: string;
  active: boolean;
  volume: number;
  volume_24h: number;
  outcomes: string[];
  outcomePrices: number[];
  source: 'kalshi';
}

export interface NormalizedTrade {
  id: string;
  market_id: string;
  trader_address?: string; // Kalshi doesn't expose this
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  timestamp: number;
  outcome: string;
  title?: string;
  source: 'kalshi';
}

export class KalshiClient {
  private api: AxiosInstance;
  private authenticated: boolean = false;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    // Kalshi API base URL
    const baseURL = process.env.KALSHI_API_URL || 'https://trading-api.kalshi.com/trade-api/v2';

    this.api = axios.create({
      baseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add response interceptor for rate limit handling
    this.api.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 5;
          console.log(`[Kalshi] Rate limited, waiting ${retryAfter}s...`);
          await this.sleep(parseInt(retryAfter) * 1000);
          return this.api.request(error.config);
        }
        throw error;
      }
    );

    console.log('📊 Kalshi client initialized');
  }

  /**
   * Authenticate with email/password to get access token
   */
  async authenticate(): Promise<boolean> {
    const email = process.env.KALSHI_EMAIL;
    const password = process.env.KALSHI_PASSWORD;

    if (!email || !password) {
      console.log('[Kalshi] No credentials provided, using public endpoints only');
      return false;
    }

    try {
      const response = await this.api.post('/login', { email, password });
      this.token = response.data.token;
      this.tokenExpiry = Date.now() + (23 * 60 * 60 * 1000); // 23 hours

      this.api.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      this.authenticated = true;
      console.log('🔐 Kalshi authenticated successfully');
      return true;
    } catch (error: any) {
      console.error('[Kalshi] Auth failed:', error?.response?.data || error.message);
      return false;
    }
  }

  /**
   * Ensure we have a valid token
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.authenticated || Date.now() > this.tokenExpiry) {
      await this.authenticate();
    }
  }

  /**
   * Get active markets
   */
  async getMarkets(limit: number = 100, status: string = 'open'): Promise<NormalizedMarket[]> {
    try {
      const response = await this.api.get('/markets', {
        params: {
          limit,
          status,
        },
      });

      const markets = response.data.markets || [];
      return markets.map((m: KalshiMarket) => this.normalizeMarket(m));
    } catch (error: any) {
      console.error('[Kalshi] Error fetching markets:', error?.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get market by ticker
   */
  async getMarket(ticker: string): Promise<NormalizedMarket | null> {
    try {
      const response = await this.api.get(`/markets/${ticker}`);
      return this.normalizeMarket(response.data.market);
    } catch (error: any) {
      console.error(`[Kalshi] Error fetching market ${ticker}:`, error?.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get events (groups of related markets)
   */
  async getEvents(limit: number = 50, status: string = 'open'): Promise<KalshiEvent[]> {
    try {
      const response = await this.api.get('/events', {
        params: { limit, status },
      });
      return response.data.events || [];
    } catch (error: any) {
      console.error('[Kalshi] Error fetching events:', error?.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get trades for a specific market
   */
  async getTrades(ticker: string, limit: number = 100): Promise<NormalizedTrade[]> {
    try {
      const response = await this.api.get(`/markets/${ticker}/trades`, {
        params: { limit },
      });

      const trades = response.data.trades || [];
      const market = await this.getMarket(ticker);

      return trades.map((t: KalshiTrade) =>
        this.normalizeTrade(t, market?.question || ticker)
      );
    } catch (error: any) {
      console.error(`[Kalshi] Error fetching trades for ${ticker}:`, error?.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get all recent trades across top markets
   * Kalshi doesn't have a global trades endpoint, so we aggregate from active markets
   */
  async getAllRecentTrades(limit: number = 500): Promise<NormalizedTrade[]> {
    try {
      // Get top markets by volume
      const markets = await this.getMarkets(30, 'open');
      const sortedMarkets = markets.sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0));

      const allTrades: NormalizedTrade[] = [];
      const tradesPerMarket = Math.ceil(limit / 15);

      // Fetch trades from top 15 markets in parallel (with batching)
      const marketBatches = this.chunk(sortedMarkets.slice(0, 15), 5);

      for (const batch of marketBatches) {
        const batchResults = await Promise.all(
          batch.map(market => this.getTrades(market.id, tradesPerMarket))
        );
        batchResults.forEach(trades => allTrades.push(...trades));
        await this.sleep(200); // Rate limit between batches
      }

      return allTrades
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    } catch (error: any) {
      console.error('[Kalshi] Error fetching all trades:', error?.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get orderbook for a market
   */
  async getOrderbook(ticker: string): Promise<KalshiOrderbook | null> {
    try {
      const response = await this.api.get(`/markets/${ticker}/orderbook`);
      return response.data.orderbook;
    } catch (error: any) {
      console.error(`[Kalshi] Error fetching orderbook for ${ticker}:`, error?.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get volume leaders
   */
  async getVolumeLeaders(limit: number = 10): Promise<NormalizedMarket[]> {
    try {
      const markets = await this.getMarkets(100, 'open');
      return markets
        .sort((a, b) => (b.volume_24h || b.volume || 0) - (a.volume_24h || a.volume || 0))
        .slice(0, limit);
    } catch (error) {
      console.error('[Kalshi] Error getting volume leaders:', error);
      return [];
    }
  }

  /**
   * Get markets closing soon
   */
  async getClosingSoonMarkets(hoursAhead: number = 24, limit: number = 10): Promise<NormalizedMarket[]> {
    try {
      const markets = await this.getMarkets(200, 'open');
      const now = Date.now();
      const cutoff = now + (hoursAhead * 60 * 60 * 1000);

      return markets
        .filter(m => {
          if (!m.end_date) return false;
          const endDate = new Date(m.end_date).getTime();
          return !isNaN(endDate) && endDate > now && endDate <= cutoff;
        })
        .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('[Kalshi] Error getting closing markets:', error);
      return [];
    }
  }

  /**
   * Normalize Kalshi market to standard format
   */
  private normalizeMarket(market: KalshiMarket): NormalizedMarket {
    return {
      id: market.ticker,
      question: market.title + (market.subtitle ? ` - ${market.subtitle}` : ''),
      description: '',
      end_date: market.expiration_time || market.close_time,
      active: market.status === 'open',
      volume: market.volume || 0,
      volume_24h: market.volume_24h || 0,
      outcomes: ['Yes', 'No'],
      outcomePrices: [
        (market.yes_bid || market.last_price || 50) / 100,
        (market.no_bid || (100 - (market.last_price || 50))) / 100
      ],
      source: 'kalshi',
    };
  }

  /**
   * Normalize Kalshi trade to standard format
   */
  private normalizeTrade(trade: KalshiTrade, title: string): NormalizedTrade {
    const isBuy = trade.taker_side === 'yes';
    return {
      id: trade.trade_id,
      market_id: trade.ticker,
      side: isBuy ? 'BUY' : 'SELL',
      size: trade.count,
      price: (trade.yes_price || 50) / 100, // Kalshi uses cents
      timestamp: new Date(trade.created_time).getTime() / 1000,
      outcome: trade.side === 'yes' ? 'Yes' : 'No',
      title,
      source: 'kalshi',
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }
}
