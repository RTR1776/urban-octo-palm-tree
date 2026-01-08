import axios, { AxiosInstance } from 'axios';
import { ClobClient } from '@polymarket/clob-client';
import { Wallet } from 'ethers';
import { Market, Trade, OrderBookData } from './types';

export class PolymarketClient {
  private gammaApi: AxiosInstance;
  private clobClient: ClobClient | null = null;
  private dataApi: AxiosInstance;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.gammaApi = axios.create({
      baseURL: process.env.GAMMA_API_URL || 'https://gamma-api.polymarket.com',
      timeout: 10000,
    });

    // Using public Data API for trade data - no authentication needed!
    console.log('🐋 Whale tracking enabled via public Data API');

    this.dataApi = axios.create({
      baseURL: process.env.DATA_API_URL || 'https://data-api.polymarket.com',
      timeout: 10000,
    });
  }

  private async initializeClobClient(privateKey: string): Promise<void> {
    try {
      // Create an ethers Wallet from the private key
      const wallet = new Wallet(privateKey);
      
      this.clobClient = new ClobClient(
        process.env.CLOB_API_URL || 'https://clob.polymarket.com',
        137, // Polygon chain ID
        wallet // Pass the Wallet object, not the private key string
      );
      
      // Derive or create API credentials
      await this.clobClient.createOrDeriveApiKey();
      console.log('✅ CLOB client initialized with API credentials');
    } catch (error) {
      console.error('Failed to initialize CLOB client:', error);
      this.clobClient = null;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  async getMarkets(limit: number = 100, active: boolean = true): Promise<Market[]> {
    try {
      const response = await this.gammaApi.get('/markets', {
        params: {
          limit,
          active,
          closed: false,
        },
      });
      
      const markets = response.data || [];
      
      // Map API response to our Market type
      return markets.map((m: any) => ({
        id: m.id,
        question: m.question,
        description: m.description || '',
        end_date: m.endDate || m.end_date,
        volume: parseFloat(m.volume) || 0,
        liquidity: parseFloat(m.liquidity) || 0,
        active: m.active !== false,
        closed: m.closed === true,
        outcomes: typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : (m.outcomes || []),
        tokens: (m.tokens || []).map((t: any) => ({
          token_id: t.token_id || t.tokenId,
          outcome: t.outcome,
          price: parseFloat(t.price) || 0,
          winner: t.winner || false,
        })),
      }));
    } catch (error) {
      console.error('Error fetching markets:', error);
      return [];
    }
  }

  async getMarket(marketId: string): Promise<Market | null> {
    try {
      const response = await this.gammaApi.get(`/markets/${marketId}`);
      const m = response.data;
      
      if (!m) return null;
      
      return {
        id: m.id,
        question: m.question,
        description: m.description || '',
        end_date: m.endDate || m.end_date,
        volume: parseFloat(m.volume) || 0,
        liquidity: parseFloat(m.liquidity) || 0,
        active: m.active !== false,
        closed: m.closed === true,
        outcomes: typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : (m.outcomes || []),
        tokens: (m.tokens || []).map((t: any) => ({
          token_id: t.token_id || t.tokenId,
          outcome: t.outcome,
          price: parseFloat(t.price) || 0,
          winner: t.winner || false,
        })),
      };
    } catch (error) {
      console.error(`Error fetching market ${marketId}:`, error);
      return null;
    }
  }

  async getTrades(marketId: string, limit: number = 100): Promise<Trade[]> {
    try {
      // Use public Data API endpoint - no authentication required!
      // Get recent trades globally (market filtering doesn't work well with conditionId)
      const response = await this.dataApi.get('/trades', {
        params: {
          limit: limit || 100,
        },
      });
      
      const allTrades = response.data || [];
      
      // Map the data API format to our Trade type
      const mappedTrades = allTrades.map((trade: any) => ({
        id: trade.transactionHash,
        market_id: trade.conditionId,
        trader_address: trade.proxyWallet,
        side: trade.side,
        size: trade.size,
        price: trade.price,
        timestamp: trade.timestamp,
        outcome: trade.outcome,
        title: trade.title, // Market title from API
      }));
      
      return mappedTrades;
    } catch (error) {
      console.error(`Error fetching trades:`, error);
      return [];
    }
  }

  // Get all recent trades globally for whale monitoring
  async getAllRecentTrades(limit: number = 500): Promise<Trade[]> {
    try {
      const response = await this.dataApi.get('/trades', {
        params: { limit },
      });
      
      const allTrades = response.data || [];
      
      return allTrades.map((trade: any) => ({
        id: trade.transactionHash,
        market_id: trade.conditionId,
        trader_address: trade.proxyWallet,
        side: trade.side,
        size: trade.size,
        price: trade.price,
        timestamp: trade.timestamp,
        outcome: trade.outcome,
        title: trade.title,
      }));
    } catch (error) {
      console.error('Error fetching all trades:', error);
      return [];
    }
  }

  async getOrderBook(tokenId: string): Promise<OrderBookData | null> {
    try {
      if (!this.clobClient) {
        console.warn('CLOB client not initialized, cannot fetch order book');
        return null;
      }
      const book = await this.clobClient.getOrderBook(tokenId);
      return book as unknown as OrderBookData;
    } catch (error) {
      console.error(`Error fetching order book for token ${tokenId}:`, error);
      return null;
    }
  }

  async getUserTrades(address: string, limit: number = 100): Promise<Trade[]> {
    try {
      // Use data API for user trades since CLOB client may not be initialized
      const response = await this.dataApi.get('/trades', {
        params: {
          user: address,
          limit,
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching trades for user ${address}:`, error);
      return [];
    }
  }

  async getActiveMarketIds(): Promise<string[]> {
    try {
      const markets = await this.getMarkets(1000, true);
      return markets.map(m => m.id);
    } catch (error) {
      console.error('Error fetching active market IDs:', error);
      return [];
    }
  }

  async getMarketVolume(marketId: string): Promise<number> {
    try {
      const market = await this.getMarket(marketId);
      return market?.volume || 0;
    } catch (error) {
      console.error(`Error fetching volume for market ${marketId}:`, error);
      return 0;
    }
  }

  // ========== Additional API Features ==========

  /**
   * Get trending/featured events (groups of related markets)
   */
  async getEvents(limit: number = 20, archived: boolean = false): Promise<any[]> {
    try {
      const response = await this.gammaApi.get('/events', {
        params: { limit, archived },
      });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  /**
   * Get price history for a specific market/token
   * Returns OHLCV (candlestick) data
   */
  async getPriceHistory(
    conditionId: string,
    interval: '1m' | '5m' | '1h' | '1d' = '1h',
    startTs?: number,
    endTs?: number
  ): Promise<any[]> {
    try {
      const params: any = {
        market: conditionId,
        interval,
      };
      if (startTs) params.startTs = startTs;
      if (endTs) params.endTs = endTs;

      const response = await this.dataApi.get('/prices', { params });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching price history:', error);
      return [];
    }
  }

  /**
   * Get current orderbook depth (bids/asks) for better liquidity analysis
   */
  async getOrderBookDepth(tokenId: string): Promise<{
    bids: Array<{ price: number; size: number }>;
    asks: Array<{ price: number; size: number }>;
    spread: number;
    midPrice: number;
  } | null> {
    try {
      const book = await this.getOrderBook(tokenId);
      if (!book) return null;

      const bids = (book.bids || []).map((b: any) => ({
        price: parseFloat(b.price),
        size: parseFloat(b.size),
      }));
      const asks = (book.asks || []).map((a: any) => ({
        price: parseFloat(a.price),
        size: parseFloat(a.size),
      }));

      const bestBid = bids[0]?.price || 0;
      const bestAsk = asks[0]?.price || 1;
      const spread = bestAsk - bestBid;
      const midPrice = (bestBid + bestAsk) / 2;

      return { bids, asks, spread, midPrice };
    } catch (error) {
      console.error('Error analyzing orderbook depth:', error);
      return null;
    }
  }

  /**
   * Get markets by tag/category for topical filtering
   * Note: Polymarket API may not support tag filtering, so we filter client-side
   */
  async getMarketsByTag(tag: string, limit: number = 50): Promise<Market[]> {
    try {
      // Get all active markets and filter by keyword matching
      const response = await this.gammaApi.get('/markets', {
        params: {
          limit: 200,
          active: true,
          closed: false,
        },
      });
      
      const markets = response.data || [];
      
      // Filter by keywords in question text - expanded keyword lists for better matching
      const keywords: Record<string, string[]> = {
        politics: ['trump', 'biden', 'election', 'president', 'congress', 'senate', 'political', 'vote', 'democratic', 'republican', 'democrat', 'gop', 'governor', 'mayor', 'primary', 'nominee', 'poll', 'ballot', 'administration', 'white house', 'cabinet', 'supreme court', 'impeach', 'legislation', 'bill', 'law'],
        sports: ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball', 'super bowl', 'championship', 'game', 'team', 'player', 'coach', 'playoffs', 'finals', 'world series', 'stanley cup', 'mvp', 'draft', 'trade', 'score', 'win', 'loss', 'match', 'tournament', 'league', 'ufc', 'boxing', 'tennis', 'golf', 'f1', 'racing', 'olympics'],
        crypto: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'blockchain', 'defi', 'nft', 'solana', 'ada', 'cardano', 'xrp', 'ripple', 'doge', 'dogecoin', 'binance', 'coinbase', 'token', 'altcoin', 'wallet', 'mining', 'staking', 'web3'],
        finance: ['stock', 'market', 'fed', 'economy', 'inflation', 'gdp', 'recession', 'dollar', 'interest rate', 'wall street', 'nasdaq', 's&p', 'dow', 'bond', 'yield', 'treasury', 'bank', 'federal reserve', 'powell', 'rate cut', 'rate hike', 'cpi', 'jobs report', 'unemployment'],
        'pop-culture': ['movie', 'film', 'actor', 'actress', 'celebrity', 'award', 'oscar', 'grammy', 'emmy', 'music', 'album', 'song', 'artist', 'singer', 'band', 'concert', 'tour', 'netflix', 'streaming', 'tv show', 'series', 'hollywood', 'entertainment', 'kardashian', 'taylor swift', 'kanye', 'drake', 'beyonce', 'tiktok', 'viral', 'influencer', 'youtube', 'podcast', 'box office'],
        science: ['climate', 'space', 'nasa', 'research', 'study', 'vaccine', 'covid', 'medicine', 'technology', 'ai', 'artificial intelligence', 'openai', 'spacex', 'mars', 'moon', 'rocket', 'satellite', 'environment', 'carbon', 'energy', 'solar', 'nuclear', 'health', 'fda', 'drug', 'trial', 'breakthrough'],
        business: ['company', 'ceo', 'merger', 'ipo', 'earnings', 'amazon', 'apple', 'google', 'tesla', 'meta', 'microsoft', 'nvidia', 'revenue', 'profit', 'startup', 'acquisition', 'layoff', 'hire', 'stock price', 'valuation', 'market cap', 'quarter', 'fiscal', 'elon musk', 'bezos', 'zuckerberg'],
        world: ['china', 'russia', 'ukraine', 'europe', 'asia', 'war', 'conflict', 'nato', 'un', 'israel', 'gaza', 'palestine', 'iran', 'north korea', 'taiwan', 'india', 'uk', 'france', 'germany', 'japan', 'brazil', 'mexico', 'canada', 'saudi', 'opec', 'sanctions', 'treaty', 'diplomat', 'summit', 'g7', 'g20'],
      };
      
      const tagKeywords = keywords[tag.toLowerCase()] || [];
      
      if (tagKeywords.length === 0) {
        // No keywords for this tag, return all markets (mapped)
        return this.getMarkets(limit, true);
      }
      
      // Map raw markets to our Market type first
      const mappedMarkets = markets.map((m: any) => ({
        id: m.id,
        question: m.question,
        description: m.description || '',
        end_date: m.endDate || m.end_date,
        volume: parseFloat(m.volume) || 0,
        liquidity: parseFloat(m.liquidity) || 0,
        active: m.active !== false,
        closed: m.closed === true,
        outcomes: typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : (m.outcomes || []),
        tokens: (m.tokens || []).map((t: any) => ({
          token_id: t.token_id || t.tokenId,
          outcome: t.outcome,
          price: parseFloat(t.price) || 0,
          winner: t.winner || false,
        })),
      }));
      
      // Filter markets that match any keyword
      const filtered = mappedMarkets.filter((market: Market) => {
        const question = market.question.toLowerCase();
        return tagKeywords.some(keyword => question.includes(keyword));
      });
      
      console.log(`[getMarketsByTag] Tag: ${tag}, Found: ${filtered.length} markets`);
      return filtered.slice(0, limit);
    } catch (error) {
      console.error(`Error fetching markets for tag ${tag}:`, error);
      return [];
    }
  }

  /**
   * Get simplified market snapshots with key metrics
   * Perfect for dashboard widgets
   */
  async getMarketSnapshots(marketIds: string[]): Promise<Array<{
    id: string;
    question: string;
    volume: number;
    liquidity: number;
    probability: number;
    change24h: number;
    tradesCount: number;
  }>> {
    try {
      const markets = await Promise.all(
        marketIds.slice(0, 20).map(id => this.getMarket(id))
      );

      return markets
        .filter(m => m !== null)
        .map(m => ({
          id: m!.id,
          question: m!.question,
          volume: m!.volume || 0,
          liquidity: m!.liquidity || 0,
          probability: m!.tokens?.[0]?.price || 0.5,
          change24h: 0, // Would need price history to calculate
          tradesCount: 0, // Would need to aggregate from trades API
        }));
    } catch (error) {
      console.error('Error fetching market snapshots:', error);
      return [];
    }
  }

  /**
   * Get volume leaders (markets sorted by 24h volume)
   */
  async getVolumeLeaders(limit: number = 10): Promise<Market[]> {
    console.log(`[getVolumeLeaders] CALLED with limit ${limit}`);
    try {
      console.log(`[getVolumeLeaders] About to call getMarkets(100, true)`);
      const markets = await this.getMarkets(100, true);
      console.log(`[getVolumeLeaders] Got ${markets.length} markets, first:`, markets[0]?.question);
      const sorted = markets
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, limit);
      console.log(`[getVolumeLeaders] Returning ${sorted.length} volume leaders`);
      return sorted;
    } catch (error) {
      console.error('[getVolumeLeaders] EXCEPTION:', error);
      return [];
    }
  }

  /**
   * Get recently created markets (newest first)
   */
  async getNewMarkets(limit: number = 10): Promise<Market[]> {
    try {
      // Polymarket API doesn't support order param, so we get markets and sort client-side
      const response = await this.gammaApi.get('/markets', {
        params: {
          limit: 100,
          active: true,
          closed: false,
        },
      });

      const markets = response.data || [];

      // Map API response to our Market type (same mapping as getMarkets)
      const mappedMarkets = markets.map((m: any) => ({
        id: m.id,
        question: m.question,
        description: m.description || '',
        end_date: m.endDate || m.end_date,
        volume: parseFloat(m.volume) || 0,
        liquidity: parseFloat(m.liquidity) || 0,
        active: m.active !== false,
        closed: m.closed === true,
        outcomes: typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : (m.outcomes || []),
        tokens: (m.tokens || []).map((t: any) => ({
          token_id: t.token_id || t.tokenId,
          outcome: t.outcome,
          price: parseFloat(t.price) || 0,
          winner: t.winner || false,
        })),
      }));

      // Sort by end_date ascending (markets ending soonest are often newer/more relevant)
      // Since we don't have createdAt, we use liquidity as a proxy - lower liquidity = newer market
      const sorted = mappedMarkets.sort((a: Market, b: Market) => {
        return (a.liquidity || 0) - (b.liquidity || 0);
      });

      return sorted.slice(0, limit);
    } catch (error) {
      console.error('Error fetching new markets:', error);
      return [];
    }
  }

  /**
   * Get markets closing soon (for urgency/FOMO features)
   */
  async getClosingSoonMarkets(hoursAhead: number = 24, limit: number = 10): Promise<Market[]> {
    try {
      const markets = await this.getMarkets(200, true);
      const now = Date.now();
      const cutoff = now + (hoursAhead * 60 * 60 * 1000);

      const closing = markets
        .filter(m => {
          if (!m.end_date) return false;
          try {
            const endDate = new Date(m.end_date).getTime();
            return !isNaN(endDate) && endDate > now && endDate <= cutoff;
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          const aTime = new Date(a.end_date).getTime();
          const bTime = new Date(b.end_date).getTime();
          return aTime - bTime;
        })
        .slice(0, limit);
        
      return closing;
    } catch (error) {
      console.error('Error fetching closing soon markets:', error);
      return [];
    }
  }

  /**
   * Analyze market momentum (price movement + volume)
   * Useful for "hot markets" detection
   */
  async getMarketMomentum(conditionId: string): Promise<{
    volumeChange: number;
    priceChange: number;
    momentumScore: number;
  } | null> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 86400;

      // Get recent price history
      const prices = await this.getPriceHistory(conditionId, '1h', oneDayAgo, now);
      
      if (prices.length < 2) return null;

      const oldestPrice = prices[0]?.c || 0.5;
      const latestPrice = prices[prices.length - 1]?.c || 0.5;
      const priceChange = ((latestPrice - oldestPrice) / oldestPrice) * 100;

      // Volume change (first half vs second half of period)
      const midpoint = Math.floor(prices.length / 2);
      const firstHalfVol = prices.slice(0, midpoint).reduce((sum: number, p: any) => sum + (p.v || 0), 0);
      const secondHalfVol = prices.slice(midpoint).reduce((sum: number, p: any) => sum + (p.v || 0), 0);
      const volumeChange = firstHalfVol > 0 ? ((secondHalfVol - firstHalfVol) / firstHalfVol) * 100 : 0;

      // Momentum score (weighted combination)
      const momentumScore = Math.abs(priceChange) * 2 + volumeChange;

      return { volumeChange, priceChange, momentumScore };
    } catch (error) {
      console.error('Error analyzing market momentum:', error);
      return null;
    }
  }
}
