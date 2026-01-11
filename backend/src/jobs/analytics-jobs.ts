/**
 * Analytics Jobs - Background tasks for data collection and metrics calculation
 *
 * Schedules periodic jobs to:
 * - Update price history (OHLCV data)
 * - Calculate market metrics (volatility, momentum, etc.)
 * - Categorize new markets
 * - Calculate market correlations
 */

import cron from 'node-cron';
import { DatabaseService } from '../database';
import { PolymarketClient } from '../polymarket-client';
import { MarketAnalyzer } from '../analytics/market-analyzer';
import { TimeSeriesAggregator } from '../aggregation/timeseries-aggregator';
import { CategoryDetector } from '../analytics/category-detector';

export class AnalyticsJobs {
  private marketAnalyzer: MarketAnalyzer;
  private timeSeriesAggregator: TimeSeriesAggregator;
  private categoryDetector: CategoryDetector;
  private jobs: cron.ScheduledTask[] = [];

  constructor(
    private db: DatabaseService,
    private polymarketClient: PolymarketClient
  ) {
    this.marketAnalyzer = new MarketAnalyzer(db);
    this.timeSeriesAggregator = new TimeSeriesAggregator(
      db,
      polymarketClient
    );
    this.categoryDetector = new CategoryDetector(db);
  }

  /**
   * Start all analytics jobs
   */
  start(): void {
    console.log('[AnalyticsJobs] Starting background analytics jobs...');

    // Update 5-minute candles every 5 minutes
    this.jobs.push(
      cron.schedule('*/5 * * * *', () => this.update5MinuteCandles())
    );

    // Update 1-hour candles every hour
    this.jobs.push(
      cron.schedule('0 * * * *', () => this.update1HourCandles())
    );

    // Update daily candles at midnight
    this.jobs.push(
      cron.schedule('0 0 * * *', () => this.updateDailyCandles())
    );

    // Calculate market metrics every 15 minutes
    this.jobs.push(
      cron.schedule('*/15 * * * *', () => this.calculateAllMetrics())
    );

    // Categorize new markets every 30 minutes
    this.jobs.push(
      cron.schedule('*/30 * * * *', () => this.categorizeNewMarkets())
    );

    // Calculate correlations every hour
    this.jobs.push(
      cron.schedule('0 * * * *', () => this.calculateCorrelations())
    );

    // Cleanup old data daily at 3 AM
    this.jobs.push(
      cron.schedule('0 3 * * *', () => this.cleanupOldData())
    );

    console.log(`[AnalyticsJobs] Scheduled ${this.jobs.length} jobs`);
  }

  /**
   * Stop all jobs
   */
  stop(): void {
    console.log('[AnalyticsJobs] Stopping all analytics jobs...');
    this.jobs.forEach((job) => job.stop());
    this.jobs = [];
  }

  /**
   * Update 5-minute candles for top 50 markets
   */
  private async update5MinuteCandles(): Promise<void> {
    try {
      console.log('[AnalyticsJobs] Updating 5-minute candles...');
      const result = await this.timeSeriesAggregator.updateAllActiveMarkets(
        '5m',
        50,
        2 // Last 2 hours
      );
      console.log(
        `[AnalyticsJobs] 5m candles: ${result.success} success, ${result.failed} failed`
      );
    } catch (error) {
      console.error('[AnalyticsJobs] Error updating 5m candles:', error);
    }
  }

  /**
   * Update 1-hour candles for top 100 markets
   */
  private async update1HourCandles(): Promise<void> {
    try {
      console.log('[AnalyticsJobs] Updating 1-hour candles...');
      const result = await this.timeSeriesAggregator.updateAllActiveMarkets(
        '1h',
        100,
        48 // Last 48 hours
      );
      console.log(
        `[AnalyticsJobs] 1h candles: ${result.success} success, ${result.failed} failed`
      );
    } catch (error) {
      console.error('[AnalyticsJobs] Error updating 1h candles:', error);
    }
  }

  /**
   * Update daily candles for all tracked markets
   */
  private async updateDailyCandles(): Promise<void> {
    try {
      console.log('[AnalyticsJobs] Updating daily candles...');
      const result = await this.timeSeriesAggregator.updateAllActiveMarkets(
        '1d',
        200,
        168 // Last 7 days
      );
      console.log(
        `[AnalyticsJobs] 1d candles: ${result.success} success, ${result.failed} failed`
      );
    } catch (error) {
      console.error('[AnalyticsJobs] Error updating daily candles:', error);
    }
  }

  /**
   * Calculate metrics for all markets with recent data
   */
  private async calculateAllMetrics(): Promise<void> {
    try {
      console.log('[AnalyticsJobs] Calculating market metrics...');

      // Get markets with recent price history
      const marketIds = this.db.getAllActiveMarketIds();

      let calculated = 0;
      for (const marketId of marketIds.slice(0, 100)) {
        // Limit to top 100
        try {
          const metrics = await this.marketAnalyzer.calculateMetrics(
            marketId,
            24
          );
          this.db.storeMarketMetrics(metrics);
          calculated++;
        } catch (error) {
          console.error(
            `[AnalyticsJobs] Error calculating metrics for ${marketId}:`,
            error
          );
        }
      }

      console.log(
        `[AnalyticsJobs] Calculated metrics for ${calculated} markets`
      );
    } catch (error) {
      console.error('[AnalyticsJobs] Error calculating metrics:', error);
    }
  }

  /**
   * Categorize new markets
   */
  private async categorizeNewMarkets(): Promise<void> {
    try {
      console.log('[AnalyticsJobs] Categorizing markets...');

      // Get recent active markets
      const markets = await this.polymarketClient.getMarkets(100, true);

      // Categorize markets that aren't already categorized
      let categorized = 0;
      for (const market of markets) {
        const existing = this.db.getMarketCategories(market.id);
        if (existing.length === 0) {
          await this.categoryDetector.categorizeMarket(market);
          categorized++;
        }
      }

      console.log(
        `[AnalyticsJobs] Categorized ${categorized} new markets`
      );
    } catch (error) {
      console.error('[AnalyticsJobs] Error categorizing markets:', error);
    }
  }

  /**
   * Calculate correlations between top markets
   */
  private async calculateCorrelations(): Promise<void> {
    try {
      console.log('[AnalyticsJobs] Calculating market correlations...');

      // Get top 20 markets by volume
      const markets = await this.polymarketClient.getVolumeLeaders(20);
      const marketIds = markets.map((m) => m.id);

      let calculated = 0;
      // Calculate pairwise correlations
      for (let i = 0; i < marketIds.length; i++) {
        for (let j = i + 1; j < marketIds.length; j++) {
          try {
            const correlation =
              await this.marketAnalyzer.calculateCorrelation(
                marketIds[i],
                marketIds[j],
                24
              );

            if (Math.abs(correlation) > 0.3) {
              // Only store significant correlations
              this.db.storeMarketCorrelation({
                market_id_1: marketIds[i],
                market_id_2: marketIds[j],
                correlation,
                lookback_hours: 24,
                updated_at: Math.floor(Date.now() / 1000),
              });
              calculated++;
            }
          } catch (error) {
            console.error(
              `[AnalyticsJobs] Error calculating correlation between ${marketIds[i]} and ${marketIds[j]}:`,
              error
            );
          }
        }
      }

      console.log(
        `[AnalyticsJobs] Calculated ${calculated} correlations`
      );
    } catch (error) {
      console.error('[AnalyticsJobs] Error calculating correlations:', error);
    }
  }

  /**
   * Clean up old price history data (keep last 30 days)
   */
  private async cleanupOldData(): Promise<void> {
    try {
      console.log('[AnalyticsJobs] Cleaning up old data...');

      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;

      // This would require adding a cleanup method to DatabaseService
      // For now, we'll just log it
      console.log(
        `[AnalyticsJobs] Would cleanup data older than ${new Date(thirtyDaysAgo * 1000).toISOString()}`
      );

      // TODO: Implement actual cleanup in DatabaseService
    } catch (error) {
      console.error('[AnalyticsJobs] Error cleaning up old data:', error);
    }
  }

  /**
   * Run all jobs once immediately (for testing/initialization)
   */
  async runAll(): Promise<void> {
    console.log('[AnalyticsJobs] Running all jobs immediately...');

    await this.update1HourCandles();
    await this.calculateAllMetrics();
    await this.categorizeNewMarkets();
    // Skip correlations on first run (needs price history first)

    console.log('[AnalyticsJobs] Initial run complete');
  }
}
