/**
 * Analytics Dashboard Page
 *
 * Main analytics hub with market screening, metrics, and charts
 */

import { useState } from 'react';
import { useFilteredMarkets, useCategories } from '../../hooks';
import { MarketScreener } from '../../components/analytics/MarketScreener';
import { MetricsCard } from '../../components/analytics/MetricsCard';
import { MarketFilter, Market } from '../../types';

export function AnalyticsDashboard() {
  const [filter, setFilter] = useState<MarketFilter>({
    minVolume: 1000,
    minLiquidity: 500,
    excludeCategories: ['crypto', 'test'],
  });

  const { markets, loading, error } = useFilteredMarkets(filter, 100);
  const { categories } = useCategories();

  // Calculate aggregate stats
  const totalVolume = markets.reduce((sum, m) => sum + m.volume, 0);
  const avgLiquidity = markets.length > 0 ? markets.reduce((sum, m) => sum + m.liquidity, 0) / markets.length : 0;
  const activeMarkets = markets.filter((m) => m.active && !m.closed).length;

  const handleFilterChange = (newFilter: MarketFilter) => {
    setFilter(newFilter);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Market Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Advanced market screening and analysis tools
          </p>
        </div>

        {/* Aggregate Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricsCard
            label="Total Volume (24h)"
            value={`$${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            description={`Across ${markets.length} markets`}
          />
          <MetricsCard
            label="Active Markets"
            value={activeMarkets}
            description={`Out of ${markets.length} total`}
          />
          <MetricsCard
            label="Avg Liquidity"
            value={`$${avgLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            description="Per market"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Screener Sidebar */}
          <div className="lg:col-span-1">
            <MarketScreener
              onFilterChange={handleFilterChange}
              availableCategories={categories.map((c) => c.category)}
            />

            {/* Category Summary */}
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Categories
              </h3>
              <div className="space-y-2">
                {categories.slice(0, 8).map((cat) => (
                  <div key={cat.category} className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 capitalize">{cat.category}</span>
                    <span className="text-gray-500 dark:text-gray-400">{cat.marketCount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Markets List */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Filtered Markets ({markets.length})
                </h2>
              </div>

              <div className="p-6">
                {loading && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading markets...</p>
                  </div>
                )}

                {error && (
                  <div className="text-center py-8">
                    <p className="text-red-500">Error: {error}</p>
                  </div>
                )}

                {!loading && !error && markets.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No markets match your filters</p>
                  </div>
                )}

                {!loading && !error && markets.length > 0 && (
                  <div className="space-y-4">
                    {markets.map((market) => (
                      <MarketCard key={market.id} market={market} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Market Card Component
function MarketCard({ market }: { market: Market }) {
  const probability = market.tokens?.[0]?.price || 0;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-900 dark:text-white flex-1 pr-4">
          {market.question}
        </h3>
        <div className="text-right">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {(probability * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">probability</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-xs">Volume</p>
          <p className="font-medium text-gray-900 dark:text-white">
            ${market.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-xs">Liquidity</p>
          <p className="font-medium text-gray-900 dark:text-white">
            ${market.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-xs">Status</p>
          <p className="font-medium">
            {market.active && !market.closed ? (
              <span className="text-green-600 dark:text-green-400">Active</span>
            ) : (
              <span className="text-gray-500">Closed</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
