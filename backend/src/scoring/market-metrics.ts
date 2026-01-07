/**
 * Market Metrics Tracker
 * Maintains rolling statistics per market for relative scoring
 */

import { MarketMetrics } from '../types/alert-types';
import { StateStore } from '../types/alert-types';
import { AlertConfig } from '../config/alert-config';
import { Trade } from '../types';

export class MarketMetricsTracker {
  private store: StateStore;

  constructor(store: StateStore) {
    this.store = store;
  }

  /**
   * Update metrics with a new trade
   */
  async recordTrade(trade: Trade, marketQuestion: string): Promise<MarketMetrics> {
    const marketId = trade.market_id;
    const tradeValue = trade.size * trade.price;
    const now = Date.now();

    let metrics = await this.store.getMarketMetrics(marketId);
    
    if (!metrics) {
      metrics = this.createEmptyMetrics(marketId);
    }

    // Update volume
    metrics.volume24h += tradeValue;
    metrics.volumeLastHour += tradeValue;
    metrics.tradeCount24h += 1;

    // Update trade sizes array (keep last N)
    metrics.tradeSizes.push(tradeValue);
    if (metrics.tradeSizes.length > AlertConfig.marketMetrics.medianWindowTrades) {
      metrics.tradeSizes.shift();
    }

    // Recalculate median and avg
    metrics.medianTradeSize = this.calculateMedian(metrics.tradeSizes);
    metrics.avgTradeSize = metrics.tradeSizes.reduce((a, b) => a + b, 0) / metrics.tradeSizes.length;

    // Update depth proxy (rolling window)
    const depthWindowStart = now - AlertConfig.marketMetrics.depthProxyWindowMs;
    if (metrics.depthProxyUpdatedAt < depthWindowStart) {
      // Reset if stale
      metrics.recentDepthProxy = tradeValue;
    } else {
      metrics.recentDepthProxy += tradeValue;
    }
    metrics.depthProxyUpdatedAt = now;

    // Update price tracking
    metrics.prices.push({ price: trade.price, timestamp: trade.timestamp * 1000 });
    
    // Keep only prices within window
    const priceWindowStart = now - AlertConfig.marketMetrics.priceWindowMs;
    metrics.prices = metrics.prices.filter(p => p.timestamp > priceWindowStart);
    
    metrics.currentPrice = trade.price;
    
    if (trade.price > metrics.priceHigh24h) metrics.priceHigh24h = trade.price;
    if (trade.price < metrics.priceLow24h || metrics.priceLow24h === 0) {
      metrics.priceLow24h = trade.price;
    }

    metrics.lastUpdated = now;

    await this.store.setMarketMetrics(marketId, metrics);
    return metrics;
  }

  /**
   * Get current metrics for a market
   */
  async getMetrics(marketId: string): Promise<MarketMetrics> {
    const metrics = await this.store.getMarketMetrics(marketId);
    return metrics || this.createEmptyMetrics(marketId);
  }

  /**
   * Get price before a specific timestamp (for price impact calculation)
   */
  async getPriceBefore(marketId: string, beforeTimestamp: number): Promise<number | null> {
    const metrics = await this.store.getMarketMetrics(marketId);
    if (!metrics || metrics.prices.length === 0) return null;

    // Find the most recent price before the given timestamp
    const pricesBefore = metrics.prices
      .filter(p => p.timestamp < beforeTimestamp)
      .sort((a, b) => b.timestamp - a.timestamp);

    return pricesBefore.length > 0 ? pricesBefore[0].price : null;
  }

  /**
   * Get price history for reversion detection
   */
  async getPriceHistory(marketId: string, windowMs: number): Promise<{ price: number; timestamp: number }[]> {
    const metrics = await this.store.getMarketMetrics(marketId);
    if (!metrics) return [];

    const cutoff = Date.now() - windowMs;
    return metrics.prices.filter(p => p.timestamp > cutoff);
  }

  /**
   * Decay old data periodically (call this every few minutes)
   */
  async decayMetrics(marketId: string): Promise<void> {
    const metrics = await this.store.getMarketMetrics(marketId);
    if (!metrics) return;

    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    // Decay hourly volume (rough approximation)
    if (metrics.lastUpdated < hourAgo) {
      metrics.volumeLastHour *= 0.5;
    }

    // Decay 24h volume
    if (metrics.lastUpdated < dayAgo) {
      metrics.volume24h *= 0.9;
      metrics.tradeCount24h = Math.floor(metrics.tradeCount24h * 0.9);
    }

    // Clean old prices
    const priceWindowStart = now - AlertConfig.marketMetrics.priceWindowMs;
    metrics.prices = metrics.prices.filter(p => p.timestamp > priceWindowStart);

    await this.store.setMarketMetrics(marketId, metrics);
  }

  private createEmptyMetrics(marketId: string): MarketMetrics {
    return {
      marketId,
      volume24h: 0,
      volumeLastHour: 0,
      tradeSizes: [],
      medianTradeSize: 0,
      avgTradeSize: 0,
      recentDepthProxy: 0,
      depthProxyUpdatedAt: 0,
      prices: [],
      currentPrice: 0,
      priceHigh24h: 0,
      priceLow24h: 0,
      lastUpdated: Date.now(),
      tradeCount24h: 0,
    };
  }

  private calculateMedian(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}
