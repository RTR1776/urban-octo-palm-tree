/**
 * Unified Severity Scoring Engine
 * Calculates 0-100 score for any trade/event
 */

import { AlertConfig } from '../config/alert-config';
import {
  ScoredEvent,
  EventType,
  MarketMetrics,
  WalletContext,
  ClusterContext,
  PriceImpactContext,
} from '../types/alert-types';
import { Trade } from '../types';

export interface ScoringContext {
  trade: Trade;
  marketQuestion: string;
  metrics: MarketMetrics;
  wallet: WalletContext;
  cluster?: ClusterContext;
  priceImpact?: PriceImpactContext;
}

export interface ScoreBreakdown {
  absoluteSize: number;
  volumeRatio: number;
  medianMultiple: number;
  depthRatio: number;
  priceImpact: number;
  walkedBook: number;
  reversion: number;
  walletBehavior: number;
  coordination: number;
  total: number;
}

export class SeverityScorer {
  /**
   * Calculate comprehensive severity score for a trade event
   */
  score(ctx: ScoringContext): ScoreBreakdown {
    const breakdown: ScoreBreakdown = {
      absoluteSize: 0,
      volumeRatio: 0,
      medianMultiple: 0,
      depthRatio: 0,
      priceImpact: 0,
      walkedBook: 0,
      reversion: 0,
      walletBehavior: 0,
      coordination: 0,
      total: 0,
    };

    const tradeValue = ctx.trade.size * ctx.trade.price;

    // 1. Absolute size scoring (0-25)
    breakdown.absoluteSize = this.scoreAbsoluteSize(tradeValue);

    // 2. Relative to market scoring (0-25)
    breakdown.volumeRatio = this.scoreVolumeRatio(tradeValue, ctx.metrics);
    breakdown.medianMultiple = this.scoreMedianMultiple(tradeValue, ctx.metrics);
    breakdown.depthRatio = this.scoreDepthRatio(tradeValue, ctx.metrics);

    // 3. Price impact scoring (0-20)
    if (ctx.priceImpact) {
      breakdown.priceImpact = this.scorePriceImpact(ctx.priceImpact);
      breakdown.walkedBook = this.scoreWalkedBook(ctx.priceImpact);
      breakdown.reversion = this.scoreReversion(ctx.priceImpact);
    }

    // 4. Wallet behavior scoring (0-15)
    breakdown.walletBehavior = this.scoreWalletBehavior(ctx.wallet);

    // 5. Coordination scoring (0-15)
    if (ctx.cluster) {
      breakdown.coordination = this.scoreCoordination(ctx.cluster);
    }

    // Calculate total (capped at 100)
    breakdown.total = Math.min(100, Math.round(
      breakdown.absoluteSize +
      breakdown.volumeRatio +
      breakdown.medianMultiple +
      breakdown.depthRatio +
      breakdown.priceImpact +
      breakdown.walkedBook +
      breakdown.reversion +
      breakdown.walletBehavior +
      breakdown.coordination
    ));

    return breakdown;
  }

  /**
   * Score absolute trade size
   */
  private scoreAbsoluteSize(tradeValue: number): number {
    const config = AlertConfig.scoring.absoluteSize;
    for (const threshold of config.thresholds) {
      if (tradeValue >= threshold.min) {
        return threshold.score;
      }
    }
    return 0;
  }

  /**
   * Score trade as ratio of 24h volume
   */
  private scoreVolumeRatio(tradeValue: number, metrics: MarketMetrics): number {
    if (metrics.volume24h <= 0) return 0;
    
    const ratio = tradeValue / metrics.volume24h;
    const config = AlertConfig.scoring.relativeToMarket.volumeRatio;
    
    for (const threshold of config.thresholds) {
      if (ratio >= threshold.min) {
        return threshold.score;
      }
    }
    return 0;
  }

  /**
   * Score trade as multiple of median trade size
   */
  private scoreMedianMultiple(tradeValue: number, metrics: MarketMetrics): number {
    if (metrics.medianTradeSize <= 0) return 0;
    
    const multiple = tradeValue / metrics.medianTradeSize;
    const config = AlertConfig.scoring.relativeToMarket.medianMultiple;
    
    for (const threshold of config.thresholds) {
      if (multiple >= threshold.min) {
        return threshold.score;
      }
    }
    return 0;
  }

  /**
   * Score trade as ratio of recent depth proxy
   */
  private scoreDepthRatio(tradeValue: number, metrics: MarketMetrics): number {
    if (metrics.recentDepthProxy <= 0) return 0;
    
    const ratio = tradeValue / metrics.recentDepthProxy;
    const config = AlertConfig.scoring.relativeToMarket.depthRatio;
    
    for (const threshold of config.thresholds) {
      if (ratio >= threshold.min) {
        return threshold.score;
      }
    }
    return 0;
  }

  /**
   * Score price impact (delta percentage)
   */
  private scorePriceImpact(impact: PriceImpactContext): number {
    const config = AlertConfig.scoring.priceImpact.deltaPercent;
    const delta = Math.abs(impact.deltaPercent);
    
    for (const threshold of config.thresholds) {
      if (delta >= threshold.min) {
        return threshold.score;
      }
    }
    return 0;
  }

  /**
   * Score if trade walked the book
   */
  private scoreWalkedBook(impact: PriceImpactContext): number {
    const config = AlertConfig.scoring.priceImpact.walkedBook;
    if (impact.levelsWalked >= config.levelThreshold) {
      return config.score;
    }
    return 0;
  }

  /**
   * Score if reversion detected
   */
  private scoreReversion(impact: PriceImpactContext): number {
    if (impact.reversionDetected) {
      return AlertConfig.scoring.priceImpact.reversion.score;
    }
    return 0;
  }

  /**
   * Score wallet behavior
   */
  private scoreWalletBehavior(wallet: WalletContext): number {
    let score = 0;
    const config = AlertConfig.scoring.walletBehavior;

    // New wallet bonus
    if (wallet.isNew) {
      score += config.newWallet.score;
    }

    // Known whale bonus
    if (wallet.isKnownWhale) {
      score += config.knownWhale.score;
    }

    // Stacking behavior
    if (
      wallet.recentTradeCount >= config.stacking.minTrades &&
      wallet.recentVolume >= config.stacking.minVolume
    ) {
      score += config.stacking.score;
    }

    return Math.min(config.weight, score);
  }

  /**
   * Score coordinated cluster behavior
   */
  private scoreCoordination(cluster: ClusterContext): number {
    const config = AlertConfig.scoring.coordination;
    
    if (cluster.wallets.length < config.minWallets) {
      return 0;
    }

    let score = config.baseScore;

    // Same direction bonus
    if (cluster.dominantSide !== 'MIXED') {
      score += config.sameDirectionBonus;
    }

    // Volume bonus
    if (cluster.totalVolume >= config.volumeBonus.minVolume) {
      score += config.volumeBonus.weight;
    }

    return Math.min(config.weight, score);
  }

  /**
   * Determine primary event type from score breakdown
   */
  determineEventType(breakdown: ScoreBreakdown, ctx: ScoringContext): EventType {
    // Priority order for event type determination
    if (ctx.cluster && breakdown.coordination >= 10) {
      return 'COORDINATED_CLUSTER';
    }
    if (ctx.priceImpact?.reversionDetected) {
      return 'REVERSION';
    }
    if (breakdown.walkedBook > 0) {
      return 'BOOK_WALKED';
    }
    if (breakdown.priceImpact >= 7) {
      return 'PRICE_IMPACT';
    }
    if (ctx.wallet.isNew && breakdown.absoluteSize >= 10) {
      return 'NEW_WHALE';
    }
    if (ctx.wallet.recentTradeCount >= 3) {
      return 'STACKING';
    }
    if (ctx.wallet.isKnownWhale) {
      return 'WHALE_TRADE';
    }
    return 'LARGE_TRADE';
  }

  /**
   * Generate human-readable message for the event
   */
  generateMessage(breakdown: ScoreBreakdown, ctx: ScoringContext, eventType: EventType): { message: string; shortMessage: string } {
    const tradeValue = ctx.trade.size * ctx.trade.price;
    const walletShort = `${ctx.wallet.address.slice(0, 6)}...${ctx.wallet.address.slice(-4)}`;
    
    let message = '';
    let shortMessage = '';

    switch (eventType) {
      case 'COORDINATED_CLUSTER':
        const cluster = ctx.cluster!;
        message = `🕸️ Coordinated cluster detected! ${cluster.wallets.length} wallets traded $${cluster.totalVolume.toFixed(0)} ${cluster.dominantSide} on "${ctx.marketQuestion}" within ${cluster.windowMs / 1000}s`;
        shortMessage = `Cluster: ${cluster.wallets.length} wallets, $${cluster.totalVolume.toFixed(0)}`;
        break;

      case 'REVERSION':
        const impact = ctx.priceImpact!;
        message = `↩️ Price reversion detected on "${ctx.marketQuestion}"! ${impact.deltaPercent.toFixed(2)}% move reverted ${impact.reversionPercent?.toFixed(0)}% within ${(impact.reversionTimeMs! / 1000).toFixed(0)}s`;
        shortMessage = `Reversion: ${impact.reversionPercent?.toFixed(0)}% recovered`;
        break;

      case 'BOOK_WALKED':
        message = `📚 Book walked on "${ctx.marketQuestion}"! Trade of $${tradeValue.toFixed(0)} crossed ${ctx.priceImpact!.levelsWalked} price levels, ${ctx.priceImpact!.deltaPercent.toFixed(2)}% price impact`;
        shortMessage = `Book walked: ${ctx.priceImpact!.levelsWalked} levels`;
        break;

      case 'PRICE_IMPACT':
        message = `📈 Significant price impact on "${ctx.marketQuestion}"! $${tradeValue.toFixed(0)} ${ctx.trade.side} moved price ${ctx.priceImpact!.deltaPercent.toFixed(2)}%`;
        shortMessage = `Price impact: ${ctx.priceImpact!.deltaPercent.toFixed(2)}%`;
        break;

      case 'NEW_WHALE':
        message = `🐋 New whale emerged! ${walletShort} made first big trade: $${tradeValue.toFixed(0)} ${ctx.trade.side} on "${ctx.marketQuestion}"`;
        shortMessage = `New whale: $${tradeValue.toFixed(0)}`;
        break;

      case 'STACKING':
        message = `📦 Stacking detected! ${walletShort} made ${ctx.wallet.recentTradeCount} trades totaling $${ctx.wallet.recentVolume.toFixed(0)} on "${ctx.marketQuestion}"`;
        shortMessage = `Stacking: ${ctx.wallet.recentTradeCount} trades, $${ctx.wallet.recentVolume.toFixed(0)}`;
        break;

      case 'WHALE_TRADE':
        message = `🐋 Whale trade: ${walletShort} ${ctx.trade.side} $${tradeValue.toFixed(0)} on "${ctx.marketQuestion}" @ ${ctx.trade.price.toFixed(3)}`;
        shortMessage = `Whale: $${tradeValue.toFixed(0)} ${ctx.trade.side}`;
        break;

      default:
        message = `💰 Large trade: $${tradeValue.toFixed(0)} ${ctx.trade.side} on "${ctx.marketQuestion}" @ ${ctx.trade.price.toFixed(3)} by ${walletShort}`;
        shortMessage = `Trade: $${tradeValue.toFixed(0)} ${ctx.trade.side}`;
    }

    // Add score context
    message += ` [Score: ${breakdown.total}]`;

    return { message, shortMessage };
  }
}
