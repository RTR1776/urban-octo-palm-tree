/**
 * TimeSeriesAggregator - Collect and store OHLCV price history
 *
 * Fetches candlestick data from Polymarket Data API and stores it
 * in the database for charting and analytics.
 */

import { DatabaseService } from '../database';
import { PolymarketClient } from '../polymarket-client';
import { PriceHistory } from '../types';

export class TimeSeriesAggregator {
  constructor(
    private db: DatabaseService,
    private polymarketClient: PolymarketClient
  ) {}

  /**
   * Fetch and store price history for a market
   */
  async updatePriceHistory(
    marketId: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    lookbackHours: number = 168 // 7 days
  ): Promise<number> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const startTs = now - lookbackHours * 3600;

      console.log(
        `[TimeSeriesAggregator] Fetching ${interval} data for market ${marketId}`
      );

      // Fetch from Polymarket API
      const rawData = await this.polymarketClient.getPriceHistory(
        marketId,
        interval,
        startTs,
        now
      );

      if (!rawData || rawData.length === 0) {
        console.log(
          `[TimeSeriesAggregator] No data returned for market ${marketId}`
        );
        return 0;
      }

      // Transform API data to our format
      const priceHistory: PriceHistory[] = rawData
        .map((point: any) => {
          // Polymarket returns: { t: timestamp, o: open, h: high, l: low, c: close, v: volume }
          if (!point || typeof point !== 'object') return null;

          return {
            market_id: marketId,
            timestamp: point.t || point.timestamp,
            open: parseFloat(point.o || point.open) || 0,
            high: parseFloat(point.h || point.high) || 0,
            low: parseFloat(point.l || point.low) || 0,
            close: parseFloat(point.c || point.close) || 0,
            volume: parseFloat(point.v || point.volume) || 0,
            interval,
          };
        })
        .filter((p) => p !== null) as PriceHistory[];

      if (priceHistory.length === 0) {
        console.log(
          `[TimeSeriesAggregator] No valid price points for market ${marketId}`
        );
        return 0;
      }

      // Store in database
      this.db.storePriceHistory(priceHistory);

      console.log(
        `[TimeSeriesAggregator] Stored ${priceHistory.length} price points for ${marketId}`
      );
      return priceHistory.length;
    } catch (error) {
      console.error(
        `[TimeSeriesAggregator] Error updating price history for ${marketId}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Update price history for multiple markets
   */
  async updateMultipleMarkets(
    marketIds: string[],
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    lookbackHours: number = 24
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const marketId of marketIds) {
      const count = await this.updatePriceHistory(
        marketId,
        interval,
        lookbackHours
      );
      if (count > 0) {
        success++;
      } else {
        failed++;
      }

      // Respect API rate limits - small delay between requests
      await this.sleep(200);
    }

    console.log(
      `[TimeSeriesAggregator] Batch update complete: ${success} success, ${failed} failed`
    );
    return { success, failed };
  }

  /**
   * Update price history for all active markets
   */
  async updateAllActiveMarkets(
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    limit: number = 50,
    lookbackHours: number = 24
  ): Promise<{ success: number; failed: number }> {
    console.log(
      `[TimeSeriesAggregator] Updating ${interval} data for top ${limit} markets`
    );

    // Get top markets by volume
    const markets = await this.polymarketClient.getVolumeLeaders(limit);
    const marketIds = markets.map((m) => m.id);

    return await this.updateMultipleMarkets(
      marketIds,
      interval,
      lookbackHours
    );
  }

  /**
   * Backfill historical data for a market
   */
  async backfillMarket(
    marketId: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    daysBack: number = 30
  ): Promise<number> {
    console.log(
      `[TimeSeriesAggregator] Backfilling ${daysBack} days of ${interval} data for ${marketId}`
    );

    const lookbackHours = daysBack * 24;
    return await this.updatePriceHistory(marketId, interval, lookbackHours);
  }

  /**
   * Get latest price for a market (from cache or fresh)
   */
  async getLatestPrice(marketId: string): Promise<number | null> {
    // Try to get from recent price history
    const recent = this.db.getPriceHistory(marketId, '1h', undefined, undefined, 1);

    if (recent.length > 0) {
      return recent[recent.length - 1].close;
    }

    // Otherwise fetch fresh data
    try {
      const market = await this.polymarketClient.getMarket(marketId);
      if (market && market.tokens.length > 0) {
        return market.tokens[0].price;
      }
    } catch (error) {
      console.error(`Error fetching latest price for ${marketId}:`, error);
    }

    return null;
  }

  /**
   * Calculate OHLCV from raw trades (for intervals not provided by API)
   */
  aggregateTradesToOHLCV(
    trades: Array<{ timestamp: number; price: number; size: number }>,
    intervalSeconds: number
  ): PriceHistory[] {
    if (trades.length === 0) return [];

    // Sort trades by timestamp
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);

    // Group trades into intervals
    const intervals: Map<number, typeof sortedTrades> = new Map();

    for (const trade of sortedTrades) {
      const intervalStart =
        Math.floor(trade.timestamp / intervalSeconds) * intervalSeconds;
      const existing = intervals.get(intervalStart) || [];
      existing.push(trade);
      intervals.set(intervalStart, existing);
    }

    // Convert to OHLCV
    const ohlcv: PriceHistory[] = [];

    for (const [timestamp, trades] of intervals.entries()) {
      const prices = trades.map((t) => t.price);
      const volume = trades.reduce((sum, t) => sum + t.size * t.price, 0);

      ohlcv.push({
        market_id: '', // Will be set by caller
        timestamp,
        open: prices[0],
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: prices[prices.length - 1],
        volume,
        interval: `${intervalSeconds}s` as any,
      });
    }

    return ohlcv.sort((a, b) => a.timestamp - b.timestamp);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
