/**
 * Analytics API Routes
 *
 * New endpoints for the analytics platform:
 * - Market metrics (volatility, momentum, Sharpe ratio)
 * - Price history (OHLCV candlestick data)
 * - Market categories and filtering
 * - Market correlations
 * - Category statistics
 */

import { Router, Request, Response } from 'express';
import { DatabaseService } from '../database';
import { PolymarketClient } from '../polymarket-client';
import { MarketAnalyzer } from '../analytics/market-analyzer';
import { CategoryDetector } from '../analytics/category-detector';
import { DataFilter } from '../analytics/data-filter';
import { cacheManager } from '../aggregation/cache-manager';

export function createAnalyticsRoutes(
  db: DatabaseService,
  client: PolymarketClient
): Router {
  const router = Router();
  const marketAnalyzer = new MarketAnalyzer(db);
  const categoryDetector = new CategoryDetector(db);

  /**
   * GET /api/analytics/market/:id/metrics
   * Get all calculated metrics for a specific market
   */
  router.get('/market/:id/metrics', async (req: Request, res: Response) => {
    try {
      const marketId = req.params.id;

      // Try to get from cache first
      const cached = await cacheManager.get(
        `metrics:${marketId}`,
        async () => {
          // Check if we have pre-calculated metrics
          let metrics = db.getMarketMetrics(marketId);

          // If not, calculate them now
          if (!metrics) {
            metrics = await marketAnalyzer.calculateMetrics(marketId, 24);
            db.storeMarketMetrics(metrics);
          }

          return metrics;
        },
        300 // 5 minute cache
      );

      res.json(cached);
    } catch (error: any) {
      console.error('Error fetching market metrics:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch metrics' });
    }
  });

  /**
   * GET /api/analytics/market/:id/price-history
   * Get OHLCV price history for charting
   */
  router.get('/market/:id/price-history', async (req: Request, res: Response) => {
    try {
      const marketId = req.params.id;
      const interval = (req.query.interval as string) || '1h';
      const limit = parseInt(req.query.limit as string) || 100;
      const startTime = req.query.startTime
        ? parseInt(req.query.startTime as string)
        : undefined;
      const endTime = req.query.endTime
        ? parseInt(req.query.endTime as string)
        : undefined;

      const priceHistory = db.getPriceHistory(
        marketId,
        interval,
        startTime,
        endTime,
        limit
      );

      res.json(priceHistory);
    } catch (error: any) {
      console.error('Error fetching price history:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch price history' });
    }
  });

  /**
   * GET /api/analytics/market/:id/categories
   * Get categories for a specific market
   */
  router.get('/market/:id/categories', async (req: Request, res: Response) => {
    try {
      const marketId = req.params.id;
      const categories = db.getMarketCategories(marketId);

      // If no categories, detect them now
      if (categories.length === 0) {
        const market = await client.getMarket(marketId);
        if (market) {
          const detected = categoryDetector.detectCategories(market);
          if (detected.length > 0) {
            db.storeMarketCategories(marketId, detected);
            res.json(detected);
            return;
          }
        }
      }

      res.json(categories);
    } catch (error: any) {
      console.error('Error fetching market categories:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch categories' });
    }
  });

  /**
   * GET /api/analytics/market/:id/correlations
   * Get markets correlated with this one
   */
  router.get('/market/:id/correlations', async (req: Request, res: Response) => {
    try {
      const marketId = req.params.id;
      const minCorrelation = parseFloat(req.query.minCorrelation as string) || 0.5;

      const correlations = db.getMarketCorrelations(marketId, minCorrelation);

      res.json(correlations);
    } catch (error: any) {
      console.error('Error fetching correlations:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch correlations' });
    }
  });

  /**
   * GET /api/analytics/market/:id1/compare/:id2
   * Compare two markets side-by-side
   */
  router.get('/market/:id1/compare/:id2', async (req: Request, res: Response) => {
    try {
      const id1 = req.params.id1;
      const id2 = req.params.id2;

      const [market1, market2, metrics1, metrics2, correlation] = await Promise.all([
        client.getMarket(id1),
        client.getMarket(id2),
        marketAnalyzer.calculateMetrics(id1, 24),
        marketAnalyzer.calculateMetrics(id2, 24),
        marketAnalyzer.calculateCorrelation(id1, id2, 24),
      ]);

      res.json({
        market1: {
          ...market1,
          metrics: metrics1,
        },
        market2: {
          ...market2,
          metrics: metrics2,
        },
        correlation,
      });
    } catch (error: any) {
      console.error('Error comparing markets:', error);
      res.status(500).json({ error: error.message || 'Failed to compare markets' });
    }
  });

  /**
   * GET /api/analytics/categories
   * Get all categories with market counts
   */
  router.get('/categories', async (req: Request, res: Response) => {
    try {
      const categories = db.getAllCategories();

      // Get market counts for each category
      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          const marketIds = db.getMarketsByCategory(category, 0.5);
          return {
            category,
            marketCount: marketIds.length,
          };
        })
      );

      res.json(categoriesWithCounts);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch categories' });
    }
  });

  /**
   * GET /api/analytics/category/:category/markets
   * Get markets in a specific category
   */
  router.get('/category/:category/markets', async (req: Request, res: Response) => {
    try {
      const category = req.params.category;
      const minConfidence = parseFloat(req.query.minConfidence as string) || 0.5;

      const marketIds = db.getMarketsByCategory(category, minConfidence);

      // Fetch full market details
      const markets = await Promise.all(
        marketIds.slice(0, 50).map((id) => client.getMarket(id))
      );

      res.json(markets.filter(Boolean));
    } catch (error: any) {
      console.error('Error fetching category markets:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch category markets' });
    }
  });

  /**
   * GET /api/analytics/category/:category/stats
   * Get statistics for a category
   */
  router.get('/category/:category/stats', async (req: Request, res: Response) => {
    try {
      const category = req.params.category;
      const marketIds = db.getMarketsByCategory(category, 0.5);

      // Fetch markets to calculate stats
      const markets = await Promise.all(
        marketIds.slice(0, 100).map((id) => client.getMarket(id))
      );

      const validMarkets = markets.filter(Boolean);

      if (validMarkets.length === 0) {
        res.json({
          category,
          marketCount: 0,
          totalVolume24h: 0,
          avgVolume24h: 0,
          totalLiquidity: 0,
          topMarket: null,
        });
        return;
      }

      const totalVolume = validMarkets.reduce((sum, m) => sum + (m?.volume || 0), 0);
      const totalLiquidity = validMarkets.reduce((sum, m) => sum + (m?.liquidity || 0), 0);

      // Find top market by volume
      const topMarket = validMarkets.reduce((top, m) =>
        (m?.volume || 0) > (top?.volume || 0) ? m : top
      );

      res.json({
        category,
        marketCount: validMarkets.length,
        totalVolume24h: totalVolume,
        avgVolume24h: totalVolume / validMarkets.length,
        totalLiquidity,
        topMarket: topMarket
          ? {
              id: topMarket.id,
              question: topMarket.question,
              volume: topMarket.volume,
            }
          : null,
      });
    } catch (error: any) {
      console.error('Error fetching category stats:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch category stats' });
    }
  });

  /**
   * GET /api/analytics/metrics/all
   * Get metrics for all markets
   */
  router.get('/metrics/all', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const metrics = db.getAllMarketMetrics(limit);
      res.json(metrics);
    } catch (error: any) {
      console.error('Error fetching all metrics:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch metrics' });
    }
  });

  /**
   * GET /api/analytics/markets/filtered
   * Get markets with filtering applied
   */
  router.get('/markets/filtered', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const markets = await client.getMarkets(limit * 2, true); // Fetch extra for filtering

      // Apply filters
      const minVolume = parseFloat(req.query.minVolume as string);
      const minLiquidity = parseFloat(req.query.minLiquidity as string);
      const categories = req.query.categories
        ? (req.query.categories as string).split(',')
        : undefined;
      const excludeCategories = req.query.excludeCategories
        ? (req.query.excludeCategories as string).split(',')
        : ['crypto', 'test'];

      const filtered = DataFilter.filterMarkets(markets, {
        minVolume24h: minVolume || 1000,
        minLiquidity: minLiquidity || 500,
        categories,
        excludeCategories,
        activeOnly: true,
      });

      res.json(filtered.slice(0, limit));
    } catch (error: any) {
      console.error('Error fetching filtered markets:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch filtered markets' });
    }
  });

  /**
   * GET /api/analytics/correlation-matrix
   * Get correlation matrix for top markets
   */
  router.get('/correlation-matrix', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;

      // Get top markets
      const markets = await client.getVolumeLeaders(limit);
      const marketIds = markets.map((m) => m.id);

      // Build correlation matrix
      const matrix: any = {};

      for (const id1 of marketIds) {
        matrix[id1] = {};
        for (const id2 of marketIds) {
          if (id1 === id2) {
            matrix[id1][id2] = 1.0;
          } else {
            // Check if we have this correlation stored
            const correlations = db.getMarketCorrelations(id1, 0);
            const found = correlations.find(
              (c) => c.market_id_1 === id2 || c.market_id_2 === id2
            );
            matrix[id1][id2] = found ? found.correlation : 0;
          }
        }
      }

      res.json({
        markets: markets.map((m) => ({ id: m.id, question: m.question })),
        matrix,
      });
    } catch (error: any) {
      console.error('Error building correlation matrix:', error);
      res.status(500).json({ error: error.message || 'Failed to build correlation matrix' });
    }
  });

  return router;
}
