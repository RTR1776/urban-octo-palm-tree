/**
 * Alert System Configuration
 * All thresholds and tuning parameters in one place
 */

export const AlertConfig = {
  // Severity tiers and routing
  tiers: {
    critical: { min: 65, max: 100, action: 'ping' },        // @everyone or role ping
    high: { min: 45, max: 64, action: 'message' },          // Message, no ping
    medium: { min: 25, max: 44, action: 'digest' },         // Batch into digest
    low: { min: 0, max: 24, action: 'store' },              // Store only, no notification
  },

  // Digest bucket settings
  digest: {
    intervalMs: 5 * 60 * 1000,       // 5 minutes
    maxEventsPerDigest: 15,
    minEventsToSend: 3,              // Send digest with 3+ events
  },

  // Cooldown and escalation
  cooldown: {
    windowMs: 15 * 60 * 1000,        // 15 minutes
    escalationThreshold: 20,          // Score must increase by 20+ to break cooldown
    maxAlertsPerWindow: 3,            // Hard cap per (market, wallet) pair
  },

  // Scoring weights (should sum to ~100 for max possible score)
  scoring: {
    // Base trade size scoring (0-25 points)
    absoluteSize: {
      weight: 25,
      thresholds: [
        { min: 50000, score: 25 },    // $50K+
        { min: 25000, score: 20 },    // $25K+
        { min: 10000, score: 15 },    // $10K+
        { min: 5000, score: 10 },     // $5K+
        { min: 2000, score: 7 },      // $2K+
        { min: 500, score: 5 },       // $500+
        { min: 100, score: 3 },       // $100+
      ],
    },

    // Relative to market (0-25 points)
    relativeToMarket: {
      weight: 25,
      // trade_size / 24h volume ratio
      volumeRatio: {
        weight: 10,
        thresholds: [
          { min: 0.10, score: 10 },   // 10%+ of daily volume
          { min: 0.05, score: 7 },
          { min: 0.02, score: 4 },
          { min: 0.01, score: 2 },
        ],
      },
      // trade_size / median trade size
      medianMultiple: {
        weight: 10,
        thresholds: [
          { min: 50, score: 10 },     // 50x median
          { min: 20, score: 7 },
          { min: 10, score: 4 },
          { min: 5, score: 2 },
        ],
      },
      // trade_size / recent depth proxy
      depthRatio: {
        weight: 5,
        thresholds: [
          { min: 0.5, score: 5 },     // 50%+ of recent depth
          { min: 0.25, score: 3 },
          { min: 0.1, score: 1 },
        ],
      },
    },

    // Price impact (0-20 points)
    priceImpact: {
      weight: 20,
      // Immediate price move
      deltaPercent: {
        weight: 10,
        thresholds: [
          { min: 5.0, score: 10 },    // 5%+ price move
          { min: 2.0, score: 7 },
          { min: 1.0, score: 4 },
          { min: 0.5, score: 2 },
        ],
      },
      // Walked the book (filled multiple levels)
      walkedBook: {
        weight: 5,
        levelThreshold: 3,            // 3+ price levels = walked
        score: 5,
      },
      // Price reversion detected
      reversion: {
        weight: 5,
        windowMs: 5 * 60 * 1000,      // 5 minutes
        thresholdPercent: 50,          // 50%+ reversion of the move
        score: 5,
      },
    },

    // Wallet behavior (0-15 points)
    walletBehavior: {
      weight: 15,
      // New wallet with big trade
      newWallet: {
        weight: 8,
        score: 8,
      },
      // Known whale
      knownWhale: {
        weight: 5,
        score: 5,
      },
      // Stacking behavior (multiple trades)
      stacking: {
        weight: 7,
        windowMs: 60 * 60 * 1000,     // 1 hour
        minTrades: 3,
        minVolume: 25000,
        score: 7,
      },
    },

    // Coordination / clustering (0-15 points)
    coordination: {
      weight: 15,
      windowMs: 60 * 1000,            // 60 seconds
      minWallets: 3,                   // 3+ wallets = cluster
      sameDirectionBonus: 5,           // All same side
      volumeBonus: {
        weight: 5,
        minVolume: 50000,              // Combined cluster volume
      },
      baseScore: 10,
    },
  },

  // Market metrics rolling windows
  marketMetrics: {
    volumeWindowMs: 24 * 60 * 60 * 1000,    // 24 hours
    medianWindowTrades: 100,                 // Last 100 trades for median
    depthProxyWindowMs: 5 * 60 * 1000,       // 5 minutes of trades as depth proxy
    priceWindowMs: 10 * 60 * 1000,           // 10 minutes for price tracking
  },

  // Cluster detection
  clustering: {
    windowMs: 60 * 1000,              // 60 second window
    minWallets: 3,                     // Minimum wallets for cluster
    minTotalVolume: 10000,             // Minimum combined volume
    cooldownMs: 5 * 60 * 1000,         // Don't re-alert same cluster pattern for 5 min
  },

  // Reversion detection
  reversion: {
    checkIntervals: [60, 120, 180, 300],  // Check at 1, 2, 3, 5 minutes
    minOriginalMove: 1.0,                  // Original move must be 1%+
    reversionThreshold: 0.5,               // 50% reversion = significant
  },
};

export type AlertTier = 'critical' | 'high' | 'medium' | 'low';
export type AlertAction = 'ping' | 'message' | 'digest' | 'store';

export function getTierForScore(score: number): AlertTier {
  if (score >= AlertConfig.tiers.critical.min) return 'critical';
  if (score >= AlertConfig.tiers.high.min) return 'high';
  if (score >= AlertConfig.tiers.medium.min) return 'medium';
  return 'low';
}

export function getActionForScore(score: number): AlertAction {
  const tier = getTierForScore(score);
  return AlertConfig.tiers[tier].action as AlertAction;
}
