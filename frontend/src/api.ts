import axios from 'axios';
import {
  Alert,
  WhaleActivity,
  Market,
  Trade,
  MarketStats,
  PriceHistory,
  MarketMetrics,
  MarketCategory,
  MarketCorrelation,
  CategoryStats,
  MarketComparison,
  MarketFilter,
} from './types';

// Use environment variable for API URL, fallback to relative path for local dev
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = {
  async getAlerts(unreadOnly = false): Promise<Alert[]> {
    const response = await axios.get(`${API_BASE}/alerts`, {
      params: { unreadOnly },
    });
    return response.data;
  },

  async markAlertAsRead(id: number): Promise<void> {
    await axios.post(`${API_BASE}/alerts/${id}/read`);
  },

  async getWhales(limit = 100): Promise<WhaleActivity[]> {
    const response = await axios.get(`${API_BASE}/whales`, {
      params: { limit },
    });
    return response.data;
  },

  async getWhaleByAddress(address: string): Promise<WhaleActivity[]> {
    const response = await axios.get(`${API_BASE}/whales/${address}`);
    return response.data;
  },

  async getMarkets(limit = 100): Promise<Market[]> {
    const response = await axios.get(`${API_BASE}/markets`, {
      params: { limit },
    });
    return response.data;
  },

  async getMarket(id: string): Promise<Market> {
    const response = await axios.get(`${API_BASE}/markets/${id}`);
    return response.data;
  },

  async getMarketTrades(id: string, limit = 100): Promise<Trade[]> {
    const response = await axios.get(`${API_BASE}/markets/${id}/trades`, {
      params: { limit },
    });
    return response.data;
  },

  async getStats(marketId?: string): Promise<MarketStats[]> {
    const response = await axios.get(`${API_BASE}/stats`, {
      params: marketId ? { marketId } : {},
    });
    return response.data;
  },

  async getHourlyVolume(): Promise<number> {
    const response = await axios.get(`${API_BASE}/volume/hourly`);
    return response.data.volume;
  },

  async getPlatformVolume(): Promise<{ volume24h: number; marketCount: number }> {
    const response = await axios.get(`${API_BASE}/volume/hourly`);
    return {
      volume24h: response.data.volume24h || 0,
      marketCount: response.data.marketCount || 0,
    };
  },

  async getRecentTrades(limit = 100): Promise<Trade[]> {
    const response = await axios.get(`${API_BASE}/trades/recent`, {
      params: { limit },
    });
    return response.data;
  },

  // ========== Analytics Endpoints ==========

  async getMarketMetrics(marketId: string): Promise<MarketMetrics> {
    const response = await axios.get(`${API_BASE}/analytics/market/${marketId}/metrics`);
    return response.data;
  },

  async getPriceHistory(
    marketId: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
    limit = 100,
    startTime?: number,
    endTime?: number
  ): Promise<PriceHistory[]> {
    const response = await axios.get(`${API_BASE}/analytics/market/${marketId}/price-history`, {
      params: { interval, limit, startTime, endTime },
    });
    return response.data;
  },

  async getMarketCategories(marketId: string): Promise<MarketCategory[]> {
    const response = await axios.get(`${API_BASE}/analytics/market/${marketId}/categories`);
    return response.data;
  },

  async getMarketCorrelations(marketId: string, minCorrelation = 0.5): Promise<MarketCorrelation[]> {
    const response = await axios.get(`${API_BASE}/analytics/market/${marketId}/correlations`, {
      params: { minCorrelation },
    });
    return response.data;
  },

  async compareMarkets(marketId1: string, marketId2: string): Promise<MarketComparison> {
    const response = await axios.get(`${API_BASE}/analytics/market/${marketId1}/compare/${marketId2}`);
    return response.data;
  },

  async getAllCategories(): Promise<CategoryStats[]> {
    const response = await axios.get(`${API_BASE}/analytics/categories`);
    return response.data;
  },

  async getCategoryMarkets(category: string, minConfidence = 0.5): Promise<Market[]> {
    const response = await axios.get(`${API_BASE}/analytics/category/${category}/markets`, {
      params: { minConfidence },
    });
    return response.data;
  },

  async getCategoryStats(category: string): Promise<CategoryStats> {
    const response = await axios.get(`${API_BASE}/analytics/category/${category}/stats`);
    return response.data;
  },

  async getAllMarketMetrics(limit = 100): Promise<MarketMetrics[]> {
    const response = await axios.get(`${API_BASE}/analytics/metrics/all`, {
      params: { limit },
    });
    return response.data;
  },

  async getFilteredMarkets(filter?: MarketFilter, limit = 100): Promise<Market[]> {
    const response = await axios.get(`${API_BASE}/analytics/markets/filtered`, {
      params: {
        limit,
        minVolume: filter?.minVolume,
        minLiquidity: filter?.minLiquidity,
        categories: filter?.categories?.join(','),
        excludeCategories: filter?.excludeCategories?.join(','),
      },
    });
    return response.data;
  },

  async getCorrelationMatrix(limit = 20): Promise<{
    markets: Array<{ id: string; question: string }>;
    matrix: Record<string, Record<string, number>>;
  }> {
    const response = await axios.get(`${API_BASE}/analytics/correlation-matrix`, {
      params: { limit },
    });
    return response.data;
  },
};
