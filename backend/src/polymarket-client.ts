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
      return response.data;
    } catch (error) {
      console.error('Error fetching markets:', error);
      return [];
    }
  }

  async getMarket(marketId: string): Promise<Market | null> {
    try {
      const response = await this.gammaApi.get(`/markets/${marketId}`);
      return response.data;
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
      const response = await this.clobApi.get('/book', {
        params: {
          token_id: tokenId,
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching order book for token ${tokenId}:`, error);
      return null;
    }
  }

  async getUserTrades(address: string, limit: number = 100): Promise<Trade[]> {
    try {
      const response = await this.clobApi.get('/trades', {
        params: {
          maker_address: address,
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
}
