/**
 * DataFilter - Server-side filtering to remove noise
 *
 * Filters out:
 * - Small trades (below threshold)
 * - Crypto markets (too volatile/noisy)
 * - Inactive markets
 * - Test/spam markets
 */

import { Market, Trade, MarketFilter } from '../types';

export class DataFilter {
  // Default filter settings
  private static readonly DEFAULT_MIN_VOLUME_24H = 1000; // $1,000
  private static readonly DEFAULT_MIN_LIQUIDITY = 500; // $500
  private static readonly DEFAULT_MIN_TRADE_SIZE = 500; // $500
  private static readonly DEFAULT_EXCLUDED_CATEGORIES = ['crypto', 'test'];

  /**
   * Filter markets based on criteria
   */
  static filterMarkets(markets: Market[], filter?: MarketFilter): Market[] {
    const minVolume = filter?.minVolume24h ?? this.DEFAULT_MIN_VOLUME_24H;
    const minLiquidity = filter?.minLiquidity ?? this.DEFAULT_MIN_LIQUIDITY;
    const activeOnly = filter?.activeOnly ?? true;
    const excludeCategories = filter?.excludeCategories ?? this.DEFAULT_EXCLUDED_CATEGORIES;
    const includeCategories = filter?.categories;

    return markets.filter((market) => {
      // Volume filter
      if (minVolume > 0 && market.volume < minVolume) {
        return false;
      }

      // Liquidity filter
      if (minLiquidity > 0 && market.liquidity < minLiquidity) {
        return false;
      }

      // Active filter
      if (activeOnly && !market.active) {
        return false;
      }

      // Closed filter
      if (activeOnly && market.closed) {
        return false;
      }

      // End date filters
      if (filter?.minEndDate || filter?.maxEndDate) {
        try {
          const endDate = new Date(market.end_date).getTime() / 1000;
          if (filter.minEndDate && endDate < filter.minEndDate) {
            return false;
          }
          if (filter.maxEndDate && endDate > filter.maxEndDate) {
            return false;
          }
        } catch {
          // Invalid date, skip filter
        }
      }

      // Category filtering
      const detectedCategories = this.detectCategories(
        market.question + ' ' + market.description
      );

      // Exclude categories (e.g., crypto, test)
      if (excludeCategories && excludeCategories.length > 0) {
        for (const category of excludeCategories) {
          if (detectedCategories.includes(category)) {
            return false;
          }
        }
      }

      // Include only specific categories (if specified)
      if (includeCategories && includeCategories.length > 0) {
        const hasIncludedCategory = includeCategories.some((cat) =>
          detectedCategories.includes(cat)
        );
        if (!hasIncludedCategory) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Filter trades based on criteria
   */
  static filterTrades(trades: Trade[], filter?: MarketFilter): Trade[] {
    const minTradeSize = filter?.minTradeSize ?? this.DEFAULT_MIN_TRADE_SIZE;
    const excludeCategories = filter?.excludeCategories ?? this.DEFAULT_EXCLUDED_CATEGORIES;

    return trades.filter((trade) => {
      // Trade size filter (value = size * price)
      const value = trade.size * trade.price;
      if (minTradeSize > 0 && value < minTradeSize) {
        return false;
      }

      // Category filtering (based on market title if available)
      if (excludeCategories && excludeCategories.length > 0 && trade.title) {
        const detectedCategories = this.detectCategories(trade.title);
        for (const category of excludeCategories) {
          if (detectedCategories.includes(category)) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Simple category detection for filtering
   */
  private static detectCategories(text: string): string[] {
    const lower = text.toLowerCase();
    const categories: string[] = [];

    // Crypto keywords
    if (this.containsAny(lower, [
      'bitcoin',
      'btc',
      'ethereum',
      'eth',
      'crypto',
      'solana',
      'dogecoin',
      'nft',
      'defi',
      'blockchain',
    ])) {
      categories.push('crypto');
    }

    // Test/spam keywords
    if (this.containsAny(lower, ['test', 'example', 'demo', 'xxx', 'sample'])) {
      categories.push('test');
    }

    // Politics
    if (this.containsAny(lower, [
      'trump',
      'biden',
      'election',
      'president',
      'congress',
      'senate',
      'vote',
    ])) {
      categories.push('politics');
    }

    // Sports
    if (this.containsAny(lower, [
      'nfl',
      'nba',
      'mlb',
      'nhl',
      'soccer',
      'football',
      'basketball',
      'super bowl',
    ])) {
      categories.push('sports');
    }

    // Finance
    if (this.containsAny(lower, [
      'stock',
      'fed',
      'economy',
      'inflation',
      'gdp',
      'recession',
      'interest rate',
    ])) {
      categories.push('finance');
    }

    // World events
    if (this.containsAny(lower, [
      'china',
      'russia',
      'ukraine',
      'war',
      'nato',
      'israel',
      'palestine',
    ])) {
      categories.push('world');
    }

    return categories;
  }

  /**
   * Check if text contains any of the keywords
   */
  private static containsAny(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Get suggested filter for "quality markets only"
   */
  static getQualityFilter(): MarketFilter {
    return {
      minVolume24h: 5000, // $5,000+ volume
      minLiquidity: 1000, // $1,000+ liquidity
      minTradeSize: 1000, // $1,000+ trades
      excludeCategories: ['crypto', 'test'],
      activeOnly: true,
    };
  }

  /**
   * Get suggested filter for "whale trades only"
   */
  static getWhaleTradesFilter(): MarketFilter {
    return {
      minTradeSize: 10000, // $10,000+ trades
      excludeCategories: ['crypto', 'test'],
    };
  }

  /**
   * Get suggested filter for "high volume markets"
   */
  static getHighVolumeFilter(): MarketFilter {
    return {
      minVolume24h: 50000, // $50,000+ volume
      minLiquidity: 10000, // $10,000+ liquidity
      excludeCategories: ['crypto', 'test'],
      activeOnly: true,
    };
  }

  /**
   * Calculate filter statistics
   */
  static getFilterStats(
    original: { markets?: Market[]; trades?: Trade[] },
    filtered: { markets?: Market[]; trades?: Trade[] }
  ): {
    marketsRemoved: number;
    marketsKept: number;
    tradesRemoved: number;
    tradesKept: number;
    removalRate: number;
  } {
    const marketsOriginal = original.markets?.length || 0;
    const marketsFiltered = filtered.markets?.length || 0;
    const tradesOriginal = original.trades?.length || 0;
    const tradesFiltered = filtered.trades?.length || 0;

    const totalRemoved = (marketsOriginal - marketsFiltered) + (tradesOriginal - tradesFiltered);
    const totalOriginal = marketsOriginal + tradesOriginal;

    return {
      marketsRemoved: marketsOriginal - marketsFiltered,
      marketsKept: marketsFiltered,
      tradesRemoved: tradesOriginal - tradesFiltered,
      tradesKept: tradesFiltered,
      removalRate: totalOriginal > 0 ? (totalRemoved / totalOriginal) * 100 : 0,
    };
  }
}
