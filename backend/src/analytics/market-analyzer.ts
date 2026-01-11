/**
 * MarketAnalyzer - Calculate advanced market metrics
 *
 * Calculates:
 * - Volatility (standard deviation of returns)
 * - Momentum (rate of price change)
 * - Sharpe Ratio (risk-adjusted returns)
 * - Volume Trend (increasing/decreasing volume)
 * - Price Trend (slope of price over time)
 * - Depth Score (orderbook liquidity)
 */

import { DatabaseService } from '../database';
import { MarketMetrics, PriceHistory, Trade } from '../types';

export class MarketAnalyzer {
  constructor(private db: DatabaseService) {}

  /**
   * Calculate all metrics for a market
   */
  async calculateMetrics(
    marketId: string,
    timeframeHours: number = 24
  ): Promise<MarketMetrics> {
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - timeframeHours * 3600;

    // Get price history
    const priceHistory = this.db.getPriceHistory(marketId, '1h', startTime, now);

    // Get trade data for trader count
    const recentTrades = this.db.getRecentTrades(1000);
    const marketTrades = recentTrades.filter(
      (t) => t.market_id === marketId && t.timestamp >= startTime
    );

    const traderCount = new Set(
      marketTrades.map((t) => t.trader_address).filter(Boolean)
    ).size;

    // Calculate individual metrics
    const volatility = this.calculateVolatility(priceHistory);
    const momentum = this.calculateMomentum(priceHistory);
    const sharpe = this.calculateSharpeRatio(priceHistory);
    const volumeTrend = this.calculateVolumeTrend(priceHistory);
    const priceTrend = this.calculatePriceTrend(priceHistory);

    return {
      market_id: marketId,
      volatility_24h: volatility,
      momentum_24h: momentum,
      spread_pct: 0, // Requires orderbook data
      depth_score: 0, // Requires orderbook data
      sharpe_ratio: sharpe,
      volume_trend: volumeTrend,
      price_trend: priceTrend,
      trader_count_24h: traderCount,
      updated_at: now,
    };
  }

  /**
   * Calculate volatility (standard deviation of returns)
   */
  private calculateVolatility(prices: PriceHistory[]): number {
    if (prices.length < 2) return 0;

    // Calculate returns (percentage change)
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const prevClose = prices[i - 1].close;
      const currClose = prices[i].close;
      if (prevClose > 0) {
        returns.push((currClose - prevClose) / prevClose);
      }
    }

    if (returns.length === 0) return 0;

    // Calculate mean
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Calculate variance
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      returns.length;

    // Standard deviation (volatility)
    return Math.sqrt(variance);
  }

  /**
   * Calculate momentum (rate of change over period)
   */
  private calculateMomentum(prices: PriceHistory[]): number {
    if (prices.length < 2) return 0;

    const oldPrice = prices[0].close;
    const newPrice = prices[prices.length - 1].close;

    if (oldPrice === 0) return 0;

    return ((newPrice - oldPrice) / oldPrice) * 100;
  }

  /**
   * Calculate Sharpe Ratio (risk-adjusted returns)
   * Assumes risk-free rate of 0 for simplicity
   */
  private calculateSharpeRatio(prices: PriceHistory[]): number {
    if (prices.length < 2) return 0;

    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const prevClose = prices[i - 1].close;
      const currClose = prices[i].close;
      if (prevClose > 0) {
        returns.push((currClose - prevClose) / prevClose);
      }
    }

    if (returns.length === 0) return 0;

    // Calculate mean return
    const meanReturn =
      returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Calculate standard deviation
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
      returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Sharpe Ratio = (Mean Return - Risk Free Rate) / Std Dev
    // Assuming risk-free rate = 0
    return meanReturn / stdDev;
  }

  /**
   * Calculate volume trend (first half vs second half)
   * Positive = increasing volume, Negative = decreasing
   */
  private calculateVolumeTrend(prices: PriceHistory[]): number {
    if (prices.length < 4) return 0;

    const midpoint = Math.floor(prices.length / 2);

    const firstHalfVolume = prices
      .slice(0, midpoint)
      .reduce((sum, p) => sum + p.volume, 0);
    const secondHalfVolume = prices
      .slice(midpoint)
      .reduce((sum, p) => sum + p.volume, 0);

    if (firstHalfVolume === 0) return 0;

    return ((secondHalfVolume - firstHalfVolume) / firstHalfVolume) * 100;
  }

  /**
   * Calculate price trend (linear regression slope)
   */
  private calculatePriceTrend(prices: PriceHistory[]): number {
    if (prices.length < 2) return 0;

    // Simple linear regression
    const n = prices.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = prices[i].close;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    // Slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 0;

    const slope = (n * sumXY - sumX * sumY) / denominator;

    // Normalize slope by average price to get percentage trend
    const avgPrice = sumY / n;
    if (avgPrice === 0) return 0;

    return (slope / avgPrice) * 100;
  }

  /**
   * Calculate correlation between two markets
   */
  async calculateCorrelation(
    marketId1: string,
    marketId2: string,
    lookbackHours: number = 24
  ): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - lookbackHours * 3600;

    const prices1 = this.db.getPriceHistory(marketId1, '1h', startTime, now);
    const prices2 = this.db.getPriceHistory(marketId2, '1h', startTime, now);

    if (prices1.length < 2 || prices2.length < 2) return 0;

    // Ensure same length
    const minLength = Math.min(prices1.length, prices2.length);
    const p1 = prices1.slice(-minLength);
    const p2 = prices2.slice(-minLength);

    // Calculate returns for both
    const returns1: number[] = [];
    const returns2: number[] = [];

    for (let i = 1; i < minLength; i++) {
      if (p1[i - 1].close > 0 && p2[i - 1].close > 0) {
        returns1.push((p1[i].close - p1[i - 1].close) / p1[i - 1].close);
        returns2.push((p2[i].close - p2[i - 1].close) / p2[i - 1].close);
      }
    }

    if (returns1.length === 0) return 0;

    // Calculate means
    const mean1 = returns1.reduce((sum, r) => sum + r, 0) / returns1.length;
    const mean2 = returns2.reduce((sum, r) => sum + r, 0) / returns2.length;

    // Calculate correlation coefficient
    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < returns1.length; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);
    if (denominator === 0) return 0;

    return numerator / denominator;
  }
}
