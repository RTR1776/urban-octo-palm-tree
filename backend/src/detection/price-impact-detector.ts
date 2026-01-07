/**
 * Price Impact Detector
 * Detects price movements, book walking, and reversions
 */

import { AlertConfig } from '../config/alert-config';
import { StateStore, PriceImpactContext, ReversionWatch } from '../types/alert-types';
import { MarketMetricsTracker } from '../scoring/market-metrics';
import { Trade } from '../types';

export class PriceImpactDetector {
  private store: StateStore;
  private metricsTracker: MarketMetricsTracker;
  private priceHistory: Map<string, { price: number; timestamp: number }[]> = new Map();

  constructor(store: StateStore, metricsTracker: MarketMetricsTracker) {
    this.store = store;
    this.metricsTracker = metricsTracker;
  }

  /**
   * Analyze price impact of a trade
   */
  async analyzeTrade(trade: Trade): Promise<PriceImpactContext | null> {
    const marketId = trade.market_id;
    const tradeTimestamp = trade.timestamp * 1000;
    const tradeValue = trade.size * trade.price;

    // Get price before trade
    const priceBefore = await this.metricsTracker.getPriceBefore(marketId, tradeTimestamp);
    
    if (priceBefore === null || priceBefore === 0) {
      // Not enough price history
      return null;
    }

    const priceAfter = trade.price;
    const deltaPercent = ((priceAfter - priceBefore) / priceBefore) * 100;

    // Only analyze significant moves
    if (Math.abs(deltaPercent) < 0.5) {
      return null;
    }

    // Estimate levels walked (rough proxy using price delta)
    const levelsWalked = this.estimateLevelsWalked(Math.abs(deltaPercent));

    const impact: PriceImpactContext = {
      priceBefore,
      priceAfter,
      deltaPercent,
      levelsWalked,
      reversionDetected: false,
    };

    // If significant move, set up reversion watch
    if (Math.abs(deltaPercent) >= AlertConfig.reversion.minOriginalMove) {
      await this.setupReversionWatch(trade, impact);
    }

    return impact;
  }

  /**
   * Estimate how many price levels were walked
   * (Proxy since we don't have full order book)
   */
  private estimateLevelsWalked(deltaPct: number): number {
    // Rough heuristic: each 0.5% move ~ 1 level
    // Polymarket prices are 0-1, so each "level" is roughly 0.005-0.01
    if (deltaPct >= 5.0) return 5;
    if (deltaPct >= 3.0) return 4;
    if (deltaPct >= 2.0) return 3;
    if (deltaPct >= 1.0) return 2;
    if (deltaPct >= 0.5) return 1;
    return 0;
  }

  /**
   * Set up a watch for price reversion after a large move
   */
  private async setupReversionWatch(trade: Trade, impact: PriceImpactContext): Promise<void> {
    const now = Date.now();
    const checkTimes = AlertConfig.reversion.checkIntervals.map(
      seconds => now + seconds * 1000
    );

    const watch: ReversionWatch = {
      tradeId: trade.id,
      marketId: trade.market_id,
      originalPrice: impact.priceBefore,
      tradePrice: impact.priceAfter,
      movePercent: impact.deltaPercent,
      side: trade.side as 'BUY' | 'SELL',
      timestamp: now,
      checkTimes,
      resolved: false,
    };

    await this.store.addReversionWatch(watch);
  }

  /**
   * Check all pending reversion watches
   * Call this periodically (every 30-60 seconds)
   */
  async checkReversions(): Promise<PriceImpactContext[]> {
    const now = Date.now();
    const watches = await this.store.getReversionWatches();
    const reversions: PriceImpactContext[] = [];

    for (const watch of watches) {
      if (watch.resolved) continue;

      // Check if any check time has passed
      const dueChecks = watch.checkTimes.filter(t => t <= now);
      if (dueChecks.length === 0) continue;

      // Get current price
      const metrics = await this.metricsTracker.getMetrics(watch.marketId);
      const currentPrice = metrics.currentPrice;

      if (currentPrice === 0) continue;

      // Calculate reversion
      const originalMove = watch.tradePrice - watch.originalPrice;
      const currentMove = currentPrice - watch.originalPrice;
      
      // Reversion = how much of the move has been undone
      let reversionPercent = 0;
      if (Math.abs(originalMove) > 0) {
        reversionPercent = (1 - (currentMove / originalMove)) * 100;
      }

      // Significant reversion detected
      if (reversionPercent >= AlertConfig.reversion.reversionThreshold * 100) {
        watch.resolved = true;
        await this.store.removeReversionWatch(watch.tradeId);

        reversions.push({
          priceBefore: watch.originalPrice,
          priceAfter: watch.tradePrice,
          deltaPercent: watch.movePercent,
          levelsWalked: this.estimateLevelsWalked(Math.abs(watch.movePercent)),
          reversionDetected: true,
          reversionPercent,
          reversionTimeMs: now - watch.timestamp,
        });
      }

      // Remove oldest check time
      watch.checkTimes = watch.checkTimes.filter(t => t > now);
      
      // If no more checks, mark resolved
      if (watch.checkTimes.length === 0) {
        watch.resolved = true;
        await this.store.removeReversionWatch(watch.tradeId);
      }
    }

    return reversions;
  }

  /**
   * Track price for a market (call for each trade)
   */
  trackPrice(marketId: string, price: number, timestamp: number): void {
    if (!this.priceHistory.has(marketId)) {
      this.priceHistory.set(marketId, []);
    }

    const history = this.priceHistory.get(marketId)!;
    history.push({ price, timestamp });

    // Keep only last 10 minutes of prices
    const cutoff = Date.now() - 10 * 60 * 1000;
    const filtered = history.filter(p => p.timestamp > cutoff);
    this.priceHistory.set(marketId, filtered);
  }

  /**
   * Get recent price volatility for a market
   */
  getVolatility(marketId: string): number {
    const history = this.priceHistory.get(marketId);
    if (!history || history.length < 2) return 0;

    const prices = history.map(p => p.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    
    return Math.sqrt(variance);
  }
}
