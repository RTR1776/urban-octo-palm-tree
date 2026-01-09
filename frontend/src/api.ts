import axios from 'axios';
import { Alert, WhaleActivity, Market, Trade, MarketStats } from './types';

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

  async getRecentTrades(limit = 100): Promise<Trade[]> {
    const response = await axios.get(`${API_BASE}/trades/recent`, {
      params: { limit },
    });
    return response.data;
  },
};
