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
    const sideEmoji = event.trade?.side === 'BUY' ? '🟢' : '🔴';
    const sideText = event.trade ? `${sideEmoji} ${event.trade.side}` : '';
    const valueText = event.trade ? `$${event.trade.valueUsd.toFixed(0)}` : '';
    const breakdown = this.formatScoreBreakdownCompact(event.scoreBreakdown);
    
    const content = [
      `@everyone ${prefix}🚨 **CRITICAL ALERT** - ${this.getEventEmoji(event.type)} **${event.type}**`,
      `**Score: ${event.score}** ${sideText} ${valueText}`,
      `📊 ${breakdown}`,
      `> ${event.shortMessage}`,
    ].join('\n');

    await this.notifications.sendTieredAlert({
      content,
      embeds: [this.buildEmbed(event, 0xFF0000)], // Red
    });

    console.log(`[CRITICAL] ${event.type} score ${event.score}: ${event.shortMessage}`);
  }

  /**
   * Send high priority alert without ping
   */
  private async sendHighAlert(event: ScoredEvent, escalated?: boolean): Promise<void> {
    const prefix = escalated ? '⬆️ ' : '';
    const sideEmoji = event.trade?.side === 'BUY' ? '🟢' : '🔴';
    const sideText = event.trade ? `${sideEmoji} ${event.trade.side}` : '';
    const valueText = event.trade ? `$${event.trade.valueUsd.toFixed(0)}` : '';
    const breakdown = this.formatScoreBreakdownCompact(event.scoreBreakdown);
    
    const content = [
      `${prefix}${this.getEventEmoji(event.type)} **${event.type}** (Score: ${event.score})`,
      `${sideText} ${valueText}`,
      `📊 ${breakdown}`,
      `> ${event.shortMessage}`,
    ].join('\n');

    await this.notifications.sendTieredAlert({
      content,
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

    // Sort by score descending
    const sortedEvents = [...events].sort((a, b) => b.score - a.score);

    // Build header
    let summary = `📊 **Activity Digest** (${events.length} events in ${minutes} min)\n`;
    summary += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Show individual events (up to 10)
    const eventsToShow = sortedEvents.slice(0, 10);
    
    for (const e of eventsToShow) {
      const sideEmoji = e.trade?.side === 'BUY' ? '🟢' : e.trade?.side === 'SELL' ? '🔴' : '⚪';
      const sideText = e.trade?.side || 'N/A';
      const valueText = e.trade ? `$${e.trade.valueUsd.toFixed(0)}` : '';
      const priceText = e.trade ? `@ ${e.trade.price.toFixed(3)}` : '';
      
      // Event header
      summary += `${this.getEventEmoji(e.type)} **${e.type}** [${e.score}] ${sideEmoji} ${sideText} ${valueText} ${priceText}\n`;
      
      // Score breakdown (compact)
      const breakdown = this.formatScoreBreakdownCompact(e.scoreBreakdown);
      if (breakdown !== 'No factors') {
        summary += `   └ ${breakdown}\n`;
      }
      
      // Market context (shortened)
      const marketName = e.market.question.length > 50 
        ? e.market.question.slice(0, 50) + '...' 
        : e.market.question;
      summary += `   └ *${marketName}*\n\n`;
    }

    // If there are more events, show summary
    if (events.length > 10) {
      summary += `\n... and ${events.length - 10} more events\n`;
    }

    // Volume summary by type
    const byType = new Map<string, { count: number; volume: number }>();
    for (const event of events) {
      const existing = byType.get(event.type) || { count: 0, volume: 0 };
      existing.count++;
      existing.volume += event.trade?.valueUsd || 0;
      byType.set(event.type, existing);
    }

    summary += `\n**Summary by Type:**\n`;
    for (const [type, data] of byType.entries()) {
      summary += `• ${type}: ${data.count}x ($${data.volume.toFixed(0)} vol)\n`;
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
   * Format score breakdown for display (detailed)
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
   * Format score breakdown compactly with explanations
   */
  private formatScoreBreakdownCompact(breakdown: ScoredEvent['scoreBreakdown']): string {
    const parts: string[] = [];
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    
    // Only show significant contributors (>= 5 points)
    if (breakdown.absoluteSize >= 5) {
      parts.push(`💵 Size +${breakdown.absoluteSize}`);
    }
    if (breakdown.volumeRatio >= 5) {
      parts.push(`📊 Vol% +${breakdown.volumeRatio}`);
    }
    if (breakdown.medianMultiple >= 5) {
      parts.push(`📏 ${breakdown.medianMultiple}x median`);
    }
    if (breakdown.depthRatio >= 5) {
      parts.push(`📉 Depth +${breakdown.depthRatio}`);
    }
    if (breakdown.priceImpact >= 5) {
      parts.push(`📈 Impact +${breakdown.priceImpact}`);
    }
    if (breakdown.walkedBook >= 5) {
      parts.push(`📚 Walked +${breakdown.walkedBook}`);
    }
    if (breakdown.reversion >= 5) {
      parts.push(`↩️ Reversion +${breakdown.reversion}`);
    }
    if (breakdown.walletBehavior >= 5) {
      parts.push(`👛 Wallet +${breakdown.walletBehavior}`);
    }
    if (breakdown.coordination >= 5) {
      parts.push(`🕸️ Cluster +${breakdown.coordination}`);
    }

    return parts.length > 0 ? parts.join(' • ') : 'No factors';
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
