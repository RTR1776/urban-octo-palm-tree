/**
 * Test Harness for Enhanced Alert System
 * Run with: npx tsx src/tests/alert-system.test.ts
 */

import { SeverityScorer, ScoringContext } from '../scoring/severity-scorer';
import { AlertConfig, getTierForScore, getActionForScore } from '../config/alert-config';
import { MarketMetrics, WalletContext, ClusterContext, PriceImpactContext } from '../types/alert-types';
import { Trade } from '../types';

// Mock trade factory
function createTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: `trade-${Date.now()}-${Math.random()}`,
    market_id: 'test-market-123',
    trader_address: '0x1234567890abcdef1234567890abcdef12345678',
    side: 'BUY',
    size: 1000,
    price: 0.5,
    timestamp: Date.now() / 1000,
    outcome: 'Yes',
    ...overrides,
  };
}

// Mock market metrics factory
function createMetrics(overrides: Partial<MarketMetrics> = {}): MarketMetrics {
  return {
    marketId: 'test-market-123',
    volume24h: 100000,
    volumeLastHour: 5000,
    tradeSizes: [100, 200, 150, 180, 220, 190, 210, 175],
    medianTradeSize: 185,
    avgTradeSize: 178,
    recentDepthProxy: 10000,
    depthProxyUpdatedAt: Date.now(),
    prices: [],
    currentPrice: 0.5,
    priceHigh24h: 0.55,
    priceLow24h: 0.45,
    lastUpdated: Date.now(),
    tradeCount24h: 500,
    ...overrides,
  };
}

// Mock wallet context factory
function createWallet(overrides: Partial<WalletContext> = {}): WalletContext {
  return {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    isNew: false,
    isKnownWhale: false,
    recentTradeCount: 1,
    recentVolume: 500,
    ...overrides,
  };
}

// Test scenarios
const scenarios: {
  name: string;
  description: string;
  context: () => ScoringContext;
  expectedScoreRange: [number, number];
  expectedTier: string;
}[] = [
  {
    name: 'Small Normal Trade',
    description: 'A regular $200 trade by an unknown wallet',
    context: () => ({
      trade: createTrade({ size: 400, price: 0.5 }),
      marketQuestion: 'Will X happen?',
      metrics: createMetrics(),
      wallet: createWallet(),
    }),
    expectedScoreRange: [0, 10],
    expectedTier: 'low',
  },
  {
    name: 'Large Trade - Absolute Whale',
    description: 'A $50,000 trade (triggers absolute size threshold)',
    context: () => ({
      trade: createTrade({ size: 100000, price: 0.5 }),
      marketQuestion: 'Will X happen?',
      metrics: createMetrics(),
      wallet: createWallet(),
    }),
    expectedScoreRange: [40, 50],
    expectedTier: 'medium',
  },
  {
    name: 'Mega Whale Trade',
    description: 'A $100,000+ trade by a new wallet',
    context: () => ({
      trade: createTrade({ size: 250000, price: 0.5 }),
      marketQuestion: 'Will X happen?',
      metrics: createMetrics(),
      wallet: createWallet({ isNew: true }),
    }),
    expectedScoreRange: [40, 60],
    expectedTier: 'high',
  },
  {
    name: 'Big For Market - Volume Ratio',
    description: 'Trade is 10% of 24h volume (small market)',
    context: () => ({
      trade: createTrade({ size: 10000, price: 0.5 }),
      marketQuestion: 'Niche market question?',
      metrics: createMetrics({ volume24h: 50000 }),
      wallet: createWallet(),
    }),
    expectedScoreRange: [15, 35],
    expectedTier: 'medium',
  },
  {
    name: 'Known Whale Activity',
    description: 'Trade by a known whale address',
    context: () => ({
      trade: createTrade({ size: 30000, price: 0.5 }),
      marketQuestion: 'Will X happen?',
      metrics: createMetrics(),
      wallet: createWallet({ isKnownWhale: true }),
    }),
    expectedScoreRange: [35, 45],
    expectedTier: 'medium',
  },
  {
    name: 'Stacking Behavior',
    description: 'Wallet made 5 trades totaling $30,000 in past hour',
    context: () => ({
      trade: createTrade({ size: 12000, price: 0.5 }),
      marketQuestion: 'Will X happen?',
      metrics: createMetrics(),
      wallet: createWallet({
        recentTradeCount: 5,
        recentVolume: 30000,
      }),
    }),
    expectedScoreRange: [15, 35],
    expectedTier: 'medium',
  },
  {
    name: 'Price Impact Trade',
    description: 'Trade that moved price by 3%',
    context: () => ({
      trade: createTrade({ size: 50000, price: 0.515 }),
      marketQuestion: 'Will X happen?',
      metrics: createMetrics(),
      wallet: createWallet(),
      priceImpact: {
        priceBefore: 0.5,
        priceAfter: 0.515,
        deltaPercent: 3.0,
        levelsWalked: 3,
        reversionDetected: false,
      },
    }),
    expectedScoreRange: [35, 55],
    expectedTier: 'high',
  },
  {
    name: 'Coordinated Cluster',
    description: '4 wallets traded same side within 60 seconds',
    context: () => ({
      trade: createTrade({ size: 20000, price: 0.5 }),
      marketQuestion: 'Will X happen?',
      metrics: createMetrics(),
      wallet: createWallet(),
      cluster: {
        wallets: ['0xaaa', '0xbbb', '0xccc', '0xddd'],
        totalVolume: 75000,
        tradeCount: 4,
        dominantSide: 'BUY',
        windowMs: 45000,
        markets: ['test-market-123'],
      },
    }),
    expectedScoreRange: [45, 55],
    expectedTier: 'high',
  },
  {
    name: 'Perfect Storm - Critical Alert',
    description: 'New whale, huge trade, price impact, in a cluster',
    context: () => ({
      trade: createTrade({ size: 200000, price: 0.55 }),
      marketQuestion: 'Major election outcome?',
      metrics: createMetrics({ volume24h: 200000, medianTradeSize: 500 }),
      wallet: createWallet({ isNew: true }),
      cluster: {
        wallets: ['0xaaa', '0xbbb', '0xccc', '0xddd', '0xeee'],
        totalVolume: 200000,
        tradeCount: 5,
        dominantSide: 'BUY',
        windowMs: 30000,
        markets: ['test-market-123'],
      },
      priceImpact: {
        priceBefore: 0.5,
        priceAfter: 0.55,
        deltaPercent: 10.0,
        levelsWalked: 5,
        reversionDetected: false,
      },
    }),
    expectedScoreRange: [80, 100],
    expectedTier: 'critical',
  },
];

// Run tests
function runTests(): boolean {
  console.log('='.repeat(70));
  console.log('ENHANCED ALERT SYSTEM - TEST HARNESS');
  console.log('='.repeat(70));
  console.log();

  const scorer = new SeverityScorer();
  let passed = 0;
  let failed = 0;

  for (const scenario of scenarios) {
    const ctx = scenario.context();
    const breakdown = scorer.score(ctx);
    const tier = getTierForScore(breakdown.total);
    const action = getActionForScore(breakdown.total);

    const scoreInRange =
      breakdown.total >= scenario.expectedScoreRange[0] &&
      breakdown.total <= scenario.expectedScoreRange[1];
    const tierMatches = tier === scenario.expectedTier;
    const success = scoreInRange && tierMatches;

    if (success) {
      passed++;
      console.log(`✅ ${scenario.name}`);
    } else {
      failed++;
      console.log(`❌ ${scenario.name}`);
    }

    console.log(`   ${scenario.description}`);
    console.log(`   Score: ${breakdown.total} (expected ${scenario.expectedScoreRange[0]}-${scenario.expectedScoreRange[1]})`);
    console.log(`   Tier: ${tier} (expected ${scenario.expectedTier})`);
    console.log(`   Action: ${action}`);
    console.log(`   Breakdown: Size=${breakdown.absoluteSize} Vol=${breakdown.volumeRatio} Med=${breakdown.medianMultiple} Impact=${breakdown.priceImpact} Wallet=${breakdown.walletBehavior} Cluster=${breakdown.coordination}`);
    console.log();
  }

  console.log('='.repeat(70));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));

  console.log('\nTier Routing:');
  console.log('  80-100: CRITICAL -> @ping');
  console.log('  50-79:  HIGH -> message');
  console.log('  20-49:  MEDIUM -> digest');
  console.log('  0-19:   LOW -> store only');

  return failed === 0;
}

// Run
const success = runTests();
process.exit(success ? 0 : 1);
