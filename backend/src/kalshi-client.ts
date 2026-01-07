/**
 * Kalshi API Client
 * https://kalshi.com/docs/api
 * 
 * Kalshi has a public API similar to Polymarket.
 * Key differences:
 * - Uses API key authentication (not wallet-based)
 * - Different data structure for markets/trades
 * - REST API only (no WebSocket for public data)
 */

import axios, { AxiosInstance } from 'axios';

// Kalshi API types
export interface KalshiMarket {
  ticker: string;
  title: string;
  status: string;
  close_time: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  volume: number;
  open_interest: number;
  category: string;
  result?: string;
}

export interface KalshiTrade {
  trade_id: string;
  ticker: string;
  side: 'yes' | 'no';
  price: number;
  count: number;
  created_time: string;
  taker_side: 'yes' | 'no';
}

export interface KalshiOrderbook {
  ticker: string;
  yes: { price: number; quantity: number }[];
  no: { price: number; quantity: number }[];
}

// Normalized types (same as Polymarket for easy integration)
export interface NormalizedMarket {
  id: string;
  question: string;
  active: boolean;
  volume: number;
  outcomes: string[];
  outcomePrices: number[];
}

export interface NormalizedTrade {
  id: string;
  market_id: string;
  trader_address?: string;
  side: string;
  size: number;
  price: number;
  timestamp: number;
  outcome: string;
  title?: string;
}

export class KalshiClient {
  private api: AxiosInstance;
  private authenticated: boolean = false;

  constructor() {
    // Kalshi public API base
    this.api = axios.create({
      baseURL: 'https://api.elections.kalshi.com/trade-api/v2',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('📊 Kalshi client initialized');
  }

  /**
   * Authenticate with API key (optional, for private endpoints)
   */
  async authenticate(email: string, password: string): Promise<void> {
    try {
      const response = await this.api.post('/login', { email, password });
      const token = response.data.token;
      
      this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      this.authenticated = true;
      console.log('🔐 Kalshi authenticated');
    } catch (error) {
      console.error('Kalshi auth failed:', error);
      throw error;
    }
  }

  /**
   * Get active markets
   */
  async getMarkets(limit: number = 100, activeOnly: boolean = true): Promise<NormalizedMarket[]> {
    try {
      const response = await this.api.get('/markets', {
        params: {
          limit,
          status: activeOnly ? 'open' : undefined,
        },
      });

      return response.data.markets.map((m: KalshiMarket) => this.normalizeMarket(m));
    } catch (error) {
      console.error('Error fetching Kalshi markets:', error);
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
    } catch (error) {
      console.error(`Error fetching Kalshi market ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Get trades for a market
   */
  async getTrades(ticker: string, limit: number = 100): Promise<NormalizedTrade[]> {
    try {
      const response = await this.api.get(`/markets/${ticker}/trades`, {
        params: { limit },
      });

      const market = await this.getMarket(ticker);

      return response.data.trades.map((t: KalshiTrade) => 
        this.normalizeTrade(t, market?.question || ticker)
      );
    } catch (error) {
      console.error(`Error fetching Kalshi trades for ${ticker}:`, error);
      return [];
    }
  }

  /**
   * Get all recent trades across all markets
   */
  async getAllRecentTrades(limit: number = 500): Promise<NormalizedTrade[]> {
    try {
      // Kalshi doesn't have a global trades endpoint, so we aggregate from top markets
      const markets = await this.getMarkets(20, true);
      const allTrades: NormalizedTrade[] = [];

      for (const market of markets.slice(0, 10)) {
        const trades = await this.getTrades(market.id, Math.floor(limit / 10));
        allTrades.push(...trades);
        await this.sleep(100); // Rate limiting
      }

      return allTrades
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching all Kalshi trades:', error);
      return [];
    }
  }

  /**
   * Get orderbook for price depth
   */
  async getOrderbook(ticker: string): Promise<KalshiOrderbook | null> {
    try {
      const response = await this.api.get(`/markets/${ticker}/orderbook`);
      return response.data.orderbook;
    } catch (error) {
      console.error(`Error fetching Kalshi orderbook for ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Normalize Kalshi market to standard format
   */
  private normalizeMarket(market: KalshiMarket): NormalizedMarket {
    return {
      id: market.ticker,
      question: market.title,
      active: market.status === 'open',
      volume: market.volume,
      outcomes: ['Yes', 'No'],
      outcomePrices: [market.yes_bid / 100, market.no_bid / 100], // Kalshi uses cents
    };
  }

  /**
   * Normalize Kalshi trade to standard format
   */
  private normalizeTrade(trade: KalshiTrade, title: string): NormalizedTrade {
    return {
      id: trade.trade_id,
      market_id: trade.ticker,
      side: trade.taker_side === 'yes' ? 'BUY' : 'SELL',
      size: trade.count,
      price: trade.price / 100, // Kalshi uses cents
      timestamp: new Date(trade.created_time).getTime() / 1000,
      outcome: trade.side === 'yes' ? 'Yes' : 'No',
      title,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
