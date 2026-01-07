/**
 * Cooldown Manager
 * Prevents alert spam with intelligent suppression and escalation
 */

import { AlertConfig } from '../config/alert-config';
import { StateStore, CooldownEntry, ScoredEvent } from '../types/alert-types';

export interface CooldownResult {
  shouldAlert: boolean;
  reason?: 'cooldown' | 'max_alerts' | 'no_escalation';
  escalated?: boolean;
  previousScore?: number;
  alertsInWindow?: number;
}

export class CooldownManager {
  private store: StateStore;

  constructor(store: StateStore) {
    this.store = store;
  }

  /**
   * Check if an alert should be sent based on cooldown rules
   */
  async checkCooldown(
    marketId: string,
    walletAddress: string | undefined,
    currentScore: number
  ): Promise<CooldownResult> {
    const key = this.getCooldownKey(marketId, walletAddress);
    const now = Date.now();

    const existing = await this.store.getCooldown(key);

    // No existing cooldown
    if (!existing) {
      await this.store.setCooldown(key, {
        key,
        lastAlertTime: now,
        lastScore: currentScore,
        alertCount: 1,
        windowStart: now,
      });

      return { shouldAlert: true };
    }

    // Check if window has expired
    if (now - existing.windowStart > AlertConfig.cooldown.windowMs) {
      // Reset cooldown
      await this.store.setCooldown(key, {
        key,
        lastAlertTime: now,
        lastScore: currentScore,
        alertCount: 1,
        windowStart: now,
      });

      return { shouldAlert: true };
    }

    // Check max alerts in window
    if (existing.alertCount >= AlertConfig.cooldown.maxAlertsPerWindow) {
      return {
        shouldAlert: false,
        reason: 'max_alerts',
        alertsInWindow: existing.alertCount,
      };
    }

    // Check if score increased enough to escalate
    const scoreDelta = currentScore - existing.lastScore;
    
    if (scoreDelta >= AlertConfig.cooldown.escalationThreshold) {
      // Escalation! Allow alert
      await this.store.setCooldown(key, {
        ...existing,
        lastAlertTime: now,
        lastScore: currentScore,
        alertCount: existing.alertCount + 1,
      });

      return {
        shouldAlert: true,
        escalated: true,
        previousScore: existing.lastScore,
      };
    }

    // Still in cooldown, score didn't escalate enough
    return {
      shouldAlert: false,
      reason: 'no_escalation',
      previousScore: existing.lastScore,
      alertsInWindow: existing.alertCount,
    };
  }

  /**
   * Record that an alert was sent (call after successful send)
   */
  async recordAlert(
    marketId: string,
    walletAddress: string | undefined,
    score: number
  ): Promise<void> {
    const key = this.getCooldownKey(marketId, walletAddress);
    const now = Date.now();

    const existing = await this.store.getCooldown(key);

    if (existing && now - existing.windowStart <= AlertConfig.cooldown.windowMs) {
      await this.store.setCooldown(key, {
        ...existing,
        lastAlertTime: now,
        lastScore: Math.max(existing.lastScore, score),
        alertCount: existing.alertCount + 1,
      });
    } else {
      await this.store.setCooldown(key, {
        key,
        lastAlertTime: now,
        lastScore: score,
        alertCount: 1,
        windowStart: now,
      });
    }
  }

  /**
   * Get cooldown key for market + wallet combination
   */
  private getCooldownKey(marketId: string, walletAddress?: string): string {
    if (walletAddress) {
      return `${marketId}:${walletAddress.toLowerCase()}`;
    }
    return `${marketId}:market`;
  }

  /**
   * Clear cooldown for a specific key (manual reset)
   */
  async clearCooldown(marketId: string, walletAddress?: string): Promise<void> {
    const key = this.getCooldownKey(marketId, walletAddress);
    await this.store.deleteCooldown(key);
  }

  /**
   * Get remaining cooldown time in ms
   */
  async getRemainingCooldown(marketId: string, walletAddress?: string): Promise<number> {
    const key = this.getCooldownKey(marketId, walletAddress);
    const existing = await this.store.getCooldown(key);

    if (!existing) return 0;

    const elapsed = Date.now() - existing.windowStart;
    const remaining = AlertConfig.cooldown.windowMs - elapsed;

    return Math.max(0, remaining);
  }
}
