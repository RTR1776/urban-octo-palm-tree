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

    // Initialize CLOB client with wallet private key if available
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (privateKey) {
      this.initPromise = this.initializeClobClient(privateKey);
    }

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
      await this.ensureInitialized();
      
      if (!this.clobClient) {
        console.error('CLOB client not initialized. Set WALLET_PRIVATE_KEY in .env');
        return [];
      }
      
      const trades = await this.clobClient.getTrades({ market: marketId });
      return trades.slice(0, limit) as Trade[];
    } catch (error) {
      console.error(`Error fetching trades for market ${marketId}:`, error);
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
