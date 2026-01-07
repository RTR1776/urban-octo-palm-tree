/**
 * Kalshi Monitor Service
 * Monitors Kalshi prediction markets using the same scoring/routing as Polymarket
 */

import { KalshiClient, NormalizedTrade } from './kalshi-client';
import { DatabaseService } from './database';
import { NotificationService } from './notification-service';
import { WebSocketServer } from './websocket-server';
import { Trade } from './types';

// Reuse existing components
import { getStateStore, MemoryStateStore } from './state/memory-store';
import { MarketMetricsTracker } from './scoring/market-metrics';
import { SeverityScorer, ScoringContext } from './scoring/severity-scorer';
import { CooldownManager } from './routing/cooldown-manager';
import { AlertRouter } from './routing/alert-router';
import { getTierForScore } from './config/alert-config';
import { ScoredEvent, WalletContext } from './types/alert-types';

export class KalshiMonitorService {
  private client: KalshiClient;
  private db: DatabaseService;
  private notifications: NotificationService;
  private wsServer?: WebSocketServer;

  // State and tracking (separate from Polymarket)
  private store: MemoryStateStore;
  private metricsTracker: MarketMetricsTracker;
  private scorer: SeverityScorer;
  private cooldowns: CooldownManager;
  private router: AlertRouter;

  // Trade tracking
  private processedTradeIds: Set<string> = new Set();
  private enabled: boolean = false;

  constructor(
    client: KalshiClient,
    db: DatabaseService,
    notifications: NotificationService,
    wsServer?: WebSocketServer
  ) {
    this.client = client;
    this.db = db;
    this.notifications = notifications;
    this.wsServer = wsServer;

    // Initialize components (use separate state store instance for Kalshi)
    this.store = new MemoryStateStore();
    this.metricsTracker = new MarketMetricsTracker(this.store);
    this.scorer = new SeverityScorer();
    this.cooldowns = new CooldownManager(this.store);
    this.router = new AlertRouter(this.store, notifications, this.cooldowns, db, 'KALSHI');

    this.enabled = process.env.KALSHI_ENABLED === 'true';

    if (this.enabled) {
      console.log('📊 Kalshi Monitor initialized');
      console.log('   - Source prefix: [KALSHI]');
      console.log('   - Reusing scoring/routing from Polymarket');
    } else {
      console.log('📊 Kalshi Monitor disabled (set KALSHI_ENABLED=true to enable)');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Main monitoring cycle for Kalshi
   */
  async monitorMarkets(): Promise<void> {
    if (!this.enabled) return;

    console.log('[Kalshi] Starting monitoring cycle...');

    try {
      // Get recent trades from top Kalshi markets
      const trades = await this.client.getAllRecentTrades(300);
      console.log(`[Kalshi] Processing ${trades.length} recent trades...`);

      // Filter to new trades
      const newTrades = trades.filter(t => !this.processedTradeIds.has(t.id));

      // Track processed IDs
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

      // Log stats
      const stats = this.store.getStats();
      console.log(`[Kalshi] State: ${JSON.stringify(stats)}`);

    } catch (error) {
      console.error('[Kalshi] Error in monitoring cycle:', error);
    }
  }

  /**
   * Process a single Kalshi trade through the scoring pipeline
   */
  private async processTrade(trade: NormalizedTrade): Promise<void> {
    const marketQuestion = trade.title || 'Unknown Market';
    const tradeValue = trade.size * trade.price;

    // Skip tiny trades (Kalshi uses contract counts, typically $1 per contract)
    if (tradeValue < 50) return;

    // Convert to internal Trade format for compatibility
    const normalizedTrade: Trade = {
      id: trade.id,
      market_id: trade.market_id,
      trader_address: trade.trader_address,
      side: trade.side,
      size: trade.size,
      price: trade.price,
      timestamp: trade.timestamp,
      outcome: trade.outcome,
      title: trade.title,
    };

    // 1. Update market metrics
    const metrics = await this.metricsTracker.recordTrade(normalizedTrade, marketQuestion);

    // 2. Build wallet context (Kalshi doesn't expose trader addresses, so limited)
    const walletContext: WalletContext = {
      address: trade.trader_address || 'anonymous',
      isNew: false,
      isKnownWhale: false,
      recentTradeCount: 1,
      recentVolume: tradeValue,
      firstSeen: Date.now(),
    };

    // 3. Build scoring context
    const scoringContext: ScoringContext = {
      trade: normalizedTrade,
      marketQuestion,
      metrics,
      wallet: walletContext,
      cluster: undefined,
      priceImpact: undefined,
    };

    // 4. Calculate score
    const breakdown = this.scorer.score(scoringContext);

    // 5. Skip low scores
    if (breakdown.total < 25) return;

    // 6. Build scored event
    const eventType = this.scorer.determineEventType(breakdown, scoringContext);
    const { message, shortMessage } = this.scorer.generateMessage(breakdown, scoringContext, eventType);

    const event: ScoredEvent = {
      id: `kalshi-${trade.id}-${Date.now()}`,
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
        side: trade.side,
        timestamp: trade.timestamp,
        valueUsd: tradeValue,
      },
      wallet: walletContext,
      message,
      shortMessage,
    };

    // 7. Route the event (AlertRouter will add [KALSHI] prefix)
    await this.router.route(event);
  }

  /**
   * Get current state stats
   */
  getStats(): object {
    return {
      ...this.store.getStats(),
      processedTradeIds: this.processedTradeIds.size,
      enabled: this.enabled,
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
