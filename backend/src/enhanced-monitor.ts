/**
 * Enhanced Monitor Service
 * Integrates all detection, scoring, and routing components
 */

import { PolymarketClient } from './polymarket-client';
import { DatabaseService } from './database';
import { NotificationService } from './notification-service';
import { Trade } from './types';

// New components
import { getStateStore, MemoryStateStore } from './state/memory-store';
import { MarketMetricsTracker } from './scoring/market-metrics';
import { SeverityScorer, ScoringContext, ScoreBreakdown } from './scoring/severity-scorer';
import { ClusterDetector } from './detection/cluster-detector';
import { PriceImpactDetector } from './detection/price-impact-detector';
import { CooldownManager } from './routing/cooldown-manager';
import { AlertRouter } from './routing/alert-router';
import { AlertConfig, getTierForScore } from './config/alert-config';
import {
  ScoredEvent,
  EventType,
  MarketContext,
  TradeContext,
  WalletContext,
  PriceImpactContext,
} from './types/alert-types';

export class EnhancedMonitorService {
  private client: PolymarketClient;
  private db: DatabaseService;
  private notifications: NotificationService;
  
  // State and tracking
  private store: MemoryStateStore;
  private metricsTracker: MarketMetricsTracker;
  
  // Detection
  private scorer: SeverityScorer;
  private clusterDetector: ClusterDetector;
  private priceImpactDetector: PriceImpactDetector;
  
  // Routing
  private cooldowns: CooldownManager;
  private router: AlertRouter;
  
  // Wallet tracking
  private walletTradeHistory: Map<string, { trades: Trade[]; totalVolume: number }> = new Map();
  private processedTradeIds: Set<string> = new Set();

  constructor(
    client: PolymarketClient,
    db: DatabaseService,
    notifications: NotificationService
  ) {
    this.client = client;
    this.db = db;
    this.notifications = notifications;

    // Initialize components
    this.store = getStateStore();
    this.metricsTracker = new MarketMetricsTracker(this.store);
    this.scorer = new SeverityScorer();
    this.clusterDetector = new ClusterDetector(this.store);
    this.priceImpactDetector = new PriceImpactDetector(this.store, this.metricsTracker);
    this.cooldowns = new CooldownManager(this.store);
    this.router = new AlertRouter(this.store, notifications, this.cooldowns, db);

    // Load known whales from database
    this.loadKnownWhales();

    console.log('🚀 Enhanced Monitor initialized with:');
    console.log('   - Severity scoring (0-100)');
    console.log('   - Relative market detection');
    console.log('   - Price impact tracking');
    console.log('   - Cluster detection');
    console.log('   - Cooldown + escalation');
    console.log('   - Tiered routing');
  }

  private loadKnownWhales(): void {
    const whales = this.db.getWhaleActivity(1000);
    const addresses = whales.map(w => w.trader_address);
    this.store.loadKnownWhales(addresses);
  }

  /**
   * Main monitoring cycle
   */
  async monitorMarkets(): Promise<void> {
    console.log('Starting enhanced monitoring cycle...');

    try {
      // Get recent trades
      const trades = await this.client.getAllRecentTrades(500);
      console.log(`Processing ${trades.length} recent trades...`);

      // Filter to trades we haven't processed yet
      const newTrades = trades.filter(t => !this.processedTradeIds.has(t.id));
      
      // Track processed IDs (keep last 2000)
      for (const trade of newTrades) {
        this.processedTradeIds.add(trade.id);
      }
      if (this.processedTradeIds.size > 2000) {
        const ids = Array.from(this.processedTradeIds);
        this.processedTradeIds = new Set(ids.slice(-1000));
      }

      // Process each trade
      for (const trade of newTrades) {
        await this.processTrade(trade);
      }

      // Check for reversions
      const reversions = await this.priceImpactDetector.checkReversions();
      for (const reversion of reversions) {
        console.log(`[REVERSION] Detected ${reversion.reversionPercent?.toFixed(0)}% reversion`);
        // Could create alert for significant reversions
      }

      // Check for cross-market clusters
      const crossMarketClusters = await this.clusterDetector.detectCrossMarketClusters(
        newTrades,
        60000
      );
      for (const cluster of crossMarketClusters) {
        console.log(`[CROSS-MARKET] ${cluster.wallets.length} wallets across ${cluster.markets.length} markets`);
      }

      // Log state stats
      const stats = this.store.getStats();
      console.log(`State: ${JSON.stringify(stats)}`);

    } catch (error) {
      console.error('Error in monitoring cycle:', error);
    }
  }

  /**
   * Process a single trade through the full pipeline
   */
  private async processTrade(trade: Trade): Promise<void> {
    const marketQuestion = (trade as any).title || 'Unknown Market';
    const tradeValue = trade.size * trade.price;

    // Skip tiny trades
    if (tradeValue < 100) return;

    // 1. Update market metrics
    const metrics = await this.metricsTracker.recordTrade(trade, marketQuestion);

    // 2. Track price
    this.priceImpactDetector.trackPrice(trade.market_id, trade.price, trade.timestamp * 1000);

    // 3. Build wallet context
    const walletContext = await this.buildWalletContext(trade);

    // 4. Check for cluster
    const clusterResult = await this.clusterDetector.processTrade(trade, marketQuestion);

    // 5. Analyze price impact
    const priceImpact = await this.priceImpactDetector.analyzeTrade(trade);

    // 6. Build scoring context
    const scoringContext: ScoringContext = {
      trade,
      marketQuestion,
      metrics,
      wallet: walletContext,
      cluster: clusterResult.cluster,
      priceImpact: priceImpact || undefined,
    };

    // 7. Calculate score
    const breakdown = this.scorer.score(scoringContext);

    // 8. Determine if this is worth alerting
    if (breakdown.total < 20 && !clusterResult.detected) {
      // Too low score, just track metrics
      return;
    }

    // 9. Build scored event
    const eventType = this.scorer.determineEventType(breakdown, scoringContext);
    const { message, shortMessage } = this.scorer.generateMessage(breakdown, scoringContext, eventType);

    const event: ScoredEvent = {
      id: `${trade.id}-${Date.now()}`,
      timestamp: Date.now(),
      type: eventType,
      score: breakdown.total,
      tier: getTierForScore(breakdown.total),
      scoreBreakdown: breakdown,
      market: {
        id: trade.market_id,
        question: marketQuestion,
        currentPrice: metrics.currentPrice,
        volume24h: metrics.volume24h,
        medianTradeSize: metrics.medianTradeSize,
        recentDepthProxy: metrics.recentDepthProxy,
      },
      trade: {
        id: trade.id,
        size: trade.size,
        price: trade.price,
        side: trade.side as 'BUY' | 'SELL',
        timestamp: trade.timestamp,
        valueUsd: tradeValue,
      },
      wallet: walletContext,
      cluster: clusterResult.cluster,
      priceImpact: priceImpact || undefined,
      message,
      shortMessage,
    };

    // 10. Route the event
    await this.router.route(event);

    // 11. Update whale tracking if significant
    if (breakdown.total >= 50 && trade.trader_address) {
      await this.store.addKnownWhale(trade.trader_address);
    }
  }

  /**
   * Build wallet context for scoring
   */
  private async buildWalletContext(trade: Trade): Promise<WalletContext> {
    const address = trade.trader_address || '0x0';
    const tradeValue = trade.size * trade.price;

    // Check if known whale
    const isKnownWhale = await this.store.isKnownWhale(address);

    // Check if new wallet
    let firstSeen = await this.store.getWalletFirstSeen(address);
    const isNew = !firstSeen;
    
    if (!firstSeen) {
      firstSeen = Date.now();
      await this.store.setWalletFirstSeen(address, firstSeen);
    }

    // Track wallet history (in-memory for speed)
    if (!this.walletTradeHistory.has(address)) {
      this.walletTradeHistory.set(address, { trades: [], totalVolume: 0 });
    }
    
    const history = this.walletTradeHistory.get(address)!;
    history.trades.push(trade);
    history.totalVolume += tradeValue;

    // Keep only last hour of trades
    const hourAgo = Date.now() / 1000 - 3600;
    history.trades = history.trades.filter(t => t.timestamp > hourAgo);
    history.totalVolume = history.trades.reduce((sum, t) => sum + t.size * t.price, 0);

    // Clean old entries periodically
    if (this.walletTradeHistory.size > 10000) {
      const entries = Array.from(this.walletTradeHistory.entries());
      const recent = entries
        .filter(([_, h]) => h.trades.length > 0)
        .slice(-5000);
      this.walletTradeHistory = new Map(recent);
    }

    return {
      address,
      isNew,
      isKnownWhale,
      recentTradeCount: history.trades.length,
      recentVolume: history.totalVolume,
      firstSeen,
    };
  }

  /**
   * Get current state stats (for debugging/API)
   */
  getStats(): object {
    return {
      ...this.store.getStats(),
      processedTradeIds: this.processedTradeIds.size,
      walletHistorySize: this.walletTradeHistory.size,
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    this.router.destroy();
    this.store.destroy();
  }
}
