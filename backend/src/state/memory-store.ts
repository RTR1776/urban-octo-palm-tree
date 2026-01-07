/**
 * In-Memory State Store (Redis-compatible interface)
 * Can be swapped for Redis in production
 */

import {
  StateStore,
  MarketMetrics,
  CooldownEntry,
  PendingCluster,
  ReversionWatch,
  DigestBucket,
} from '../types/alert-types';

export class MemoryStateStore implements StateStore {
  private marketMetrics: Map<string, MarketMetrics> = new Map();
  private cooldowns: Map<string, CooldownEntry> = new Map();
  private pendingClusters: Map<string, PendingCluster[]> = new Map();
  private reversionWatches: Map<string, ReversionWatch> = new Map();
  private digestBucket: DigestBucket | null = null;
  private knownWhales: Set<string> = new Set();
  private walletFirstSeen: Map<string, number> = new Map();

  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    
    // Clean old cooldowns (older than 1 hour)
    for (const [key, entry] of this.cooldowns.entries()) {
      if (now - entry.windowStart > 60 * 60 * 1000) {
        this.cooldowns.delete(key);
      }
    }

    // Clean old clusters (older than 5 minutes)
    for (const [marketId, clusters] of this.pendingClusters.entries()) {
      const active = clusters.filter(c => now - c.startTime < 5 * 60 * 1000);
      if (active.length === 0) {
        this.pendingClusters.delete(marketId);
      } else {
        this.pendingClusters.set(marketId, active);
      }
    }

    // Clean resolved reversion watches
    for (const [id, watch] of this.reversionWatches.entries()) {
      if (watch.resolved || now - watch.timestamp > 10 * 60 * 1000) {
        this.reversionWatches.delete(id);
      }
    }
  }

  // Market Metrics
  async getMarketMetrics(marketId: string): Promise<MarketMetrics | null> {
    return this.marketMetrics.get(marketId) || null;
  }

  async setMarketMetrics(marketId: string, metrics: MarketMetrics): Promise<void> {
    this.marketMetrics.set(marketId, metrics);
  }

  // Cooldowns
  async getCooldown(key: string): Promise<CooldownEntry | null> {
    return this.cooldowns.get(key) || null;
  }

  async setCooldown(key: string, entry: CooldownEntry): Promise<void> {
    this.cooldowns.set(key, entry);
  }

  async deleteCooldown(key: string): Promise<void> {
    this.cooldowns.delete(key);
  }

  // Clusters
  async getPendingClusters(marketId: string): Promise<PendingCluster[]> {
    return this.pendingClusters.get(marketId) || [];
  }

  async setPendingCluster(cluster: PendingCluster): Promise<void> {
    const key = cluster.marketId;
    const existing = this.pendingClusters.get(key) || [];
    
    // Find existing cluster for same market/side within window
    const idx = existing.findIndex(
      c => c.side === cluster.side && 
           Date.now() - c.startTime < 60 * 1000
    );
    
    if (idx >= 0) {
      existing[idx] = cluster;
    } else {
      existing.push(cluster);
    }
    
    this.pendingClusters.set(key, existing);
  }

  async deletePendingCluster(marketId: string, side: string, startTime: number): Promise<void> {
    const existing = this.pendingClusters.get(marketId) || [];
    const filtered = existing.filter(
      c => !(c.side === side && c.startTime === startTime)
    );
    this.pendingClusters.set(marketId, filtered);
  }

  // Reversion Watches
  async getReversionWatches(): Promise<ReversionWatch[]> {
    return Array.from(this.reversionWatches.values());
  }

  async addReversionWatch(watch: ReversionWatch): Promise<void> {
    this.reversionWatches.set(watch.tradeId, watch);
  }

  async removeReversionWatch(tradeId: string): Promise<void> {
    this.reversionWatches.delete(tradeId);
  }

  // Digest
  async getDigestBucket(): Promise<DigestBucket | null> {
    return this.digestBucket;
  }

  async setDigestBucket(bucket: DigestBucket): Promise<void> {
    this.digestBucket = bucket;
  }

  async clearDigestBucket(): Promise<void> {
    this.digestBucket = null;
  }

  // Known Wallets
  async isKnownWhale(address: string): Promise<boolean> {
    return this.knownWhales.has(address.toLowerCase());
  }

  async addKnownWhale(address: string): Promise<void> {
    this.knownWhales.add(address.toLowerCase());
  }

  async getWalletFirstSeen(address: string): Promise<number | null> {
    return this.walletFirstSeen.get(address.toLowerCase()) || null;
  }

  async setWalletFirstSeen(address: string, timestamp: number): Promise<void> {
    const key = address.toLowerCase();
    if (!this.walletFirstSeen.has(key)) {
      this.walletFirstSeen.set(key, timestamp);
    }
  }

  // Bulk load known whales (from database on startup)
  loadKnownWhales(addresses: string[]): void {
    addresses.forEach(addr => this.knownWhales.add(addr.toLowerCase()));
    console.log(`Loaded ${addresses.length} known whales into state store`);
  }

  // Stats for debugging
  getStats(): object {
    return {
      marketMetrics: this.marketMetrics.size,
      cooldowns: this.cooldowns.size,
      pendingClusters: Array.from(this.pendingClusters.values()).flat().length,
      reversionWatches: this.reversionWatches.size,
      knownWhales: this.knownWhales.size,
      hasDigestBucket: this.digestBucket !== null,
      digestEvents: this.digestBucket?.events.length || 0,
    };
  }
}

// Singleton for easy access
let stateStoreInstance: MemoryStateStore | null = null;

export function getStateStore(): MemoryStateStore {
  if (!stateStoreInstance) {
    stateStoreInstance = new MemoryStateStore();
  }
  return stateStoreInstance;
}
