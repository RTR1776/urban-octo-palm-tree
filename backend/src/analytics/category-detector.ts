/**
 * CategoryDetector - Auto-categorize markets based on keywords
 *
 * Analyzes market questions and descriptions to assign categories
 * like politics, sports, crypto, finance, etc.
 */

import { DatabaseService } from '../database';
import { Market } from '../types';

interface CategoryKeywords {
  [category: string]: string[];
}

export class CategoryDetector {
  private keywords: CategoryKeywords = {
    politics: [
      'trump',
      'biden',
      'election',
      'president',
      'congress',
      'senate',
      'political',
      'vote',
      'democratic',
      'republican',
      'governor',
      'mayor',
      'parliament',
      'prime minister',
      'white house',
      'campaign',
      'ballot',
      'dem',
      'gop',
    ],
    sports: [
      'nfl',
      'nba',
      'mlb',
      'nhl',
      'soccer',
      'football',
      'basketball',
      'baseball',
      'super bowl',
      'championship',
      'game',
      'team',
      'player',
      'coach',
      'season',
      'playoff',
      'world cup',
      'olympics',
      'mvp',
      'champion',
    ],
    crypto: [
      'bitcoin',
      'btc',
      'ethereum',
      'eth',
      'crypto',
      'blockchain',
      'defi',
      'nft',
      'solana',
      'ada',
      'cardano',
      'dogecoin',
      'shiba',
      'binance',
      'coinbase',
      'satoshi',
      'mining',
      'wallet',
      'token',
    ],
    finance: [
      'stock',
      'market',
      'fed',
      'economy',
      'inflation',
      'gdp',
      'recession',
      'dollar',
      'interest rate',
      'dow',
      's&p',
      'nasdaq',
      'bond',
      'yield',
      'unemployment',
      'jobs',
      'earnings',
      'revenue',
    ],
    'pop-culture': [
      'movie',
      'film',
      'actor',
      'celebrity',
      'award',
      'oscar',
      'grammy',
      'emmy',
      'music',
      'album',
      'song',
      'artist',
      'box office',
      'concert',
      'netflix',
      'disney',
      'marvel',
      'star wars',
      'kardashian',
    ],
    science: [
      'climate',
      'space',
      'nasa',
      'research',
      'study',
      'vaccine',
      'covid',
      'medicine',
      'technology',
      'ai',
      'artificial intelligence',
      'mars',
      'moon',
      'elon musk',
      'spacex',
      'tesla',
      'science',
      'discovery',
    ],
    business: [
      'company',
      'ceo',
      'merger',
      'ipo',
      'earnings',
      'amazon',
      'apple',
      'google',
      'tesla',
      'meta',
      'microsoft',
      'acquisition',
      'layoff',
      'startup',
      'unicorn',
      'valuation',
      'shares',
    ],
    world: [
      'china',
      'russia',
      'ukraine',
      'europe',
      'asia',
      'war',
      'conflict',
      'nato',
      'un',
      'sanctions',
      'treaty',
      'invasion',
      'israel',
      'palestine',
      'middle east',
      'taiwan',
      'korea',
    ],
    weather: [
      'hurricane',
      'tornado',
      'storm',
      'flood',
      'drought',
      'temperature',
      'weather',
      'forecast',
      'rain',
      'snow',
      'winter',
      'summer',
      'heat wave',
      'cold',
    ],
    law: [
      'supreme court',
      'court',
      'judge',
      'trial',
      'lawsuit',
      'indictment',
      'conviction',
      'sentence',
      'attorney',
      'lawyer',
      'legal',
      'verdict',
      'jury',
      'appeal',
    ],
  };

  constructor(private db: DatabaseService) {}

  /**
   * Detect categories for a market
   */
  detectCategories(
    market: Market
  ): Array<{ category: string; confidence: number }> {
    const text = `${market.question} ${market.description}`.toLowerCase();
    const categories: Array<{ category: string; confidence: number }> = [];

    for (const [category, keywords] of Object.entries(this.keywords)) {
      let matchCount = 0;
      let totalMatches = 0;

      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          matchCount++;
          // Count multiple occurrences
          const regex = new RegExp(keyword, 'gi');
          const matches = text.match(regex);
          if (matches) {
            totalMatches += matches.length;
          }
        }
      }

      if (matchCount > 0) {
        // Confidence based on:
        // - How many keywords matched
        // - How many times they appeared
        // - Keyword density
        const keywordCoverage = matchCount / keywords.length;
        const matchStrength = Math.min(totalMatches / 3, 1); // Max out at 3 matches
        const confidence = (keywordCoverage * 0.6 + matchStrength * 0.4);

        categories.push({
          category,
          confidence: Math.min(confidence, 1.0),
        });
      }
    }

    // Sort by confidence descending
    return categories.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Categorize a market and store in database
   */
  async categorizeMarket(market: Market): Promise<void> {
    const categories = this.detectCategories(market);

    if (categories.length > 0) {
      this.db.storeMarketCategories(market.id, categories);
      console.log(
        `[CategoryDetector] Categorized market ${market.id}: ${categories.map((c) => c.category).join(', ')}`
      );
    }
  }

  /**
   * Categorize multiple markets
   */
  async categorizeMarkets(markets: Market[]): Promise<number> {
    let count = 0;

    for (const market of markets) {
      try {
        await this.categorizeMarket(market);
        count++;
      } catch (error) {
        console.error(
          `[CategoryDetector] Error categorizing market ${market.id}:`,
          error
        );
      }
    }

    console.log(`[CategoryDetector] Categorized ${count} markets`);
    return count;
  }

  /**
   * Get category statistics
   */
  getCategoryStats(markets: Market[]): Map<string, number> {
    const stats = new Map<string, number>();

    for (const market of markets) {
      const categories = this.detectCategories(market);
      for (const { category } of categories) {
        stats.set(category, (stats.get(category) || 0) + 1);
      }
    }

    return stats;
  }

  /**
   * Add custom keywords to a category
   */
  addKeywords(category: string, keywords: string[]): void {
    if (!this.keywords[category]) {
      this.keywords[category] = [];
    }
    this.keywords[category].push(...keywords);
  }

  /**
   * Get all available categories
   */
  getAvailableCategories(): string[] {
    return Object.keys(this.keywords);
  }
}
