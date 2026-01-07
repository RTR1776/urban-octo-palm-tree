/**
 * Alert Router
 * Routes scored events to appropriate channels based on tier
 */

import { AlertConfig, getTierForScore, getActionForScore, AlertTier, AlertAction } from '../config/alert-config';
import { ScoredEvent, DigestBucket, StateStore } from '../types/alert-types';
import { NotificationService } from '../notification-service';
import { CooldownManager } from './cooldown-manager';
import { DatabaseService } from '../database';

export class AlertRouter {
  private store: StateStore;
  private notifications: NotificationService;
  private cooldowns: CooldownManager;
  private db: DatabaseService;
  private digestTimer: NodeJS.Timeout | null = null;

  constructor(
    store: StateStore,
    notifications: NotificationService,
    cooldowns: CooldownManager,
    db: DatabaseService
  ) {
    this.store = store;
    this.notifications = notifications;
    this.cooldowns = cooldowns;
    this.db = db;

    // Start digest timer
    this.startDigestTimer();
  }

  /**
   * Route a scored event to the appropriate channel
   */
  async route(event: ScoredEvent): Promise<void> {
    const tier = event.tier;
    const action = getActionForScore(event.score);

    // Always store the event
    this.storeEvent(event);

    // Check cooldown
    const cooldownResult = await this.cooldowns.checkCooldown(
      event.market.id,
      event.wallet?.address,
      event.score
    );

    if (!cooldownResult.shouldAlert && action !== 'store') {
      console.log(`[COOLDOWN] Suppressed ${event.type} (score: ${event.score}, reason: ${cooldownResult.reason})`);
      return;
    }

    // Route based on action
    switch (action) {
      case 'ping':
        await this.sendCriticalAlert(event, cooldownResult.escalated);
        break;

      case 'message':
        await this.sendHighAlert(event, cooldownResult.escalated);
        break;

      case 'digest':
        await this.addToDigest(event);
        break;

      case 'store':
        // Already stored above
        console.log(`[STORE] ${event.type} score ${event.score}: ${event.shortMessage}`);
        break;
    }

    // Record alert for cooldown tracking
    if (action !== 'store' && cooldownResult.shouldAlert) {
      await this.cooldowns.recordAlert(
        event.market.id,
        event.wallet?.address,
        event.score
      );
    }
  }

  /**
   * Send critical alert with @everyone ping
   */
  private async sendCriticalAlert(event: ScoredEvent, escalated?: boolean): Promise<void> {
    const prefix = escalated ? '⬆️ ESCALATED ' : '';
    const pingContent = `@everyone ${prefix}🚨 **CRITICAL ALERT** (Score: ${event.score})`;

    await this.notifications.sendTieredAlert({
      content: pingContent,
      embeds: [this.buildEmbed(event, 0xFF0000)], // Red
    });

    console.log(`[CRITICAL] ${event.type} score ${event.score}: ${event.shortMessage}`);
  }

  /**
   * Send high priority alert without ping
   */
  private async sendHighAlert(event: ScoredEvent, escalated?: boolean): Promise<void> {
    const prefix = escalated ? '⬆️ ' : '';
    
    await this.notifications.sendTieredAlert({
      content: `${prefix}🐋 **${event.type}** (Score: ${event.score})`,
      embeds: [this.buildEmbed(event, 0xFFA500)], // Orange
    });

    console.log(`[HIGH] ${event.type} score ${event.score}: ${event.shortMessage}`);
  }

  /**
   * Add event to digest bucket
   */
  private async addToDigest(event: ScoredEvent): Promise<void> {
    let bucket = await this.store.getDigestBucket();
    const now = Date.now();

    if (!bucket) {
      bucket = {
        events: [],
        startTime: now,
        scheduledSendTime: now + AlertConfig.digest.intervalMs,
      };
    }

    // Add event if under limit
    if (bucket.events.length < AlertConfig.digest.maxEventsPerDigest) {
      bucket.events.push(event);
      await this.store.setDigestBucket(bucket);
    }

    console.log(`[DIGEST] Added ${event.type} score ${event.score} (${bucket.events.length} in bucket)`);
  }

  /**
   * Start digest timer
   */
  private startDigestTimer(): void {
    // Check every minute if digest should be sent
    this.digestTimer = setInterval(async () => {
      await this.checkAndSendDigest();
    }, 60 * 1000);
  }

  /**
   * Check if digest should be sent
   */
  private async checkAndSendDigest(): Promise<void> {
    const bucket = await this.store.getDigestBucket();
    if (!bucket) return;

    const now = Date.now();
    const shouldSend = 
      now >= bucket.scheduledSendTime ||
      bucket.events.length >= AlertConfig.digest.maxEventsPerDigest;

    if (!shouldSend) return;

    // Check minimum events
    if (bucket.events.length < AlertConfig.digest.minEventsToSend) {
      // Reset timer but keep events
      bucket.scheduledSendTime = now + AlertConfig.digest.intervalMs;
      await this.store.setDigestBucket(bucket);
      return;
    }

    await this.sendDigest(bucket);
    await this.store.clearDigestBucket();
  }

  /**
   * Send digest summary
   */
  private async sendDigest(bucket: DigestBucket): Promise<void> {
    const events = bucket.events;
    const duration = Date.now() - bucket.startTime;
    const minutes = Math.round(duration / 60000);

    // Group by type
    const byType = new Map<string, ScoredEvent[]>();
    for (const event of events) {
      if (!byType.has(event.type)) {
        byType.set(event.type, []);
      }
      byType.get(event.type)!.push(event);
    }

    // Build summary
    let summary = `📊 **Activity Digest** (${events.length} events in ${minutes} min)\n\n`;

    for (const [type, typeEvents] of byType.entries()) {
      const totalVolume = typeEvents.reduce(
        (sum, e) => sum + (e.trade?.valueUsd || 0), 
        0
      );
      const avgScore = Math.round(
        typeEvents.reduce((sum, e) => sum + e.score, 0) / typeEvents.length
      );
      
      summary += `**${type}**: ${typeEvents.length} events, $${totalVolume.toFixed(0)} volume, avg score ${avgScore}\n`;
    }

    // Top 3 events
    const topEvents = events
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (topEvents.length > 0) {
      summary += `\n**Top Events:**\n`;
      topEvents.forEach((e, i) => {
        summary += `${i + 1}. [${e.score}] ${e.shortMessage}\n`;
      });
    }

    await this.notifications.sendTieredAlert({
      content: summary,
    });

    console.log(`[DIGEST] Sent ${events.length} events`);
  }

  /**
   * Build Discord embed for event
   */
  private buildEmbed(event: ScoredEvent, color: number): object {
    const fields: any[] = [];

    // Score breakdown
    fields.push({
      name: '📊 Score Breakdown',
      value: this.formatScoreBreakdown(event.scoreBreakdown),
      inline: false,
    });

    // Trade info
    if (event.trade) {
      fields.push({
        name: '💰 Trade',
        value: `$${event.trade.valueUsd.toFixed(2)} ${event.trade.side} @ ${event.trade.price.toFixed(3)}`,
        inline: true,
      });
    }

    // Wallet info
    if (event.wallet) {
      const walletShort = `${event.wallet.address.slice(0, 8)}...`;
      const badges = [];
      if (event.wallet.isNew) badges.push('🆕');
      if (event.wallet.isKnownWhale) badges.push('🐋');
      
      fields.push({
        name: '👛 Wallet',
        value: `${walletShort} ${badges.join(' ')}`,
        inline: true,
      });
    }

    // Cluster info
    if (event.cluster) {
      fields.push({
        name: '🕸️ Cluster',
        value: `${event.cluster.wallets.length} wallets, ${event.cluster.tradeCount} trades`,
        inline: true,
      });
    }

    // Price impact
    if (event.priceImpact && event.priceImpact.deltaPercent !== 0) {
      let impactStr = `${event.priceImpact.deltaPercent >= 0 ? '+' : ''}${event.priceImpact.deltaPercent.toFixed(2)}%`;
      if (event.priceImpact.reversionDetected) {
        impactStr += ` (↩️ ${event.priceImpact.reversionPercent?.toFixed(0)}% reverted)`;
      }
      fields.push({
        name: '📈 Price Impact',
        value: impactStr,
        inline: true,
      });
    }

    return {
      title: `${this.getEventEmoji(event.type)} ${event.type}`,
      description: event.message,
      color,
      fields,
      footer: {
        text: `Market: ${event.market.question.slice(0, 50)}...`,
      },
      timestamp: new Date(event.timestamp).toISOString(),
    };
  }

  /**
   * Format score breakdown for display
   */
  private formatScoreBreakdown(breakdown: ScoredEvent['scoreBreakdown']): string {
    const parts: string[] = [];
    
    if (breakdown.absoluteSize > 0) parts.push(`Size: ${breakdown.absoluteSize}`);
    if (breakdown.volumeRatio > 0) parts.push(`Vol%: ${breakdown.volumeRatio}`);
    if (breakdown.medianMultiple > 0) parts.push(`Median: ${breakdown.medianMultiple}`);
    if (breakdown.priceImpact > 0) parts.push(`Impact: ${breakdown.priceImpact}`);
    if (breakdown.walletBehavior > 0) parts.push(`Wallet: ${breakdown.walletBehavior}`);
    if (breakdown.coordination > 0) parts.push(`Cluster: ${breakdown.coordination}`);

    return parts.join(' | ') || 'No breakdown';
  }

  /**
   * Get emoji for event type
   */
  private getEventEmoji(type: string): string {
    const emojis: Record<string, string> = {
      'LARGE_TRADE': '💰',
      'WHALE_TRADE': '🐋',
      'NEW_WHALE': '🆕🐋',
      'STACKING': '📦',
      'COORDINATED_CLUSTER': '🕸️',
      'PRICE_IMPACT': '📈',
      'BOOK_WALKED': '📚',
      'REVERSION': '↩️',
      'CUMULATIVE_WHALE': '🐋📊',
    };
    return emojis[type] || '📌';
  }

  /**
   * Store event in database
   */
  private storeEvent(event: ScoredEvent): void {
    // Convert to alert format for storage
    this.db.createAlert({
      type: event.type,
      severity: event.tier === 'critical' ? 'HIGH' : 
               event.tier === 'high' ? 'HIGH' : 
               event.tier === 'medium' ? 'MEDIUM' : 'LOW',
      message: event.message,
      market_id: event.market.id,
      trader_address: event.wallet?.address,
      amount: event.trade?.valueUsd,
      timestamp: event.timestamp,
      read: false,
    });
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.digestTimer) {
      clearInterval(this.digestTimer);
    }
  }
}
