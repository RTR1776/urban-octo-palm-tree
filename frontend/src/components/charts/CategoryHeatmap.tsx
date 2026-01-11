/**
 * Category Heatmap
 *
 * Displays market activity by category as a heatmap treemap
 */

import { CategoryStats } from '../../types';

interface CategoryHeatmapProps {
  categories: CategoryStats[];
  loading?: boolean;
  height?: number;
}

export function CategoryHeatmap({ categories, loading, height = 400 }: CategoryHeatmapProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-gray-500 dark:text-gray-400">Loading category data...</p>
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-gray-500 dark:text-gray-400">No category data available</p>
      </div>
    );
  }

  // Calculate total volume for sizing (use marketCount if volume not available)
  const totalVolume = categories.reduce((sum, cat) => sum + (cat.totalVolume24h || 0), 0);
  const useMarketCount = totalVolume === 0;
  const totalMarkets = categories.reduce((sum, cat) => sum + cat.marketCount, 0);

  // Get color based on relative volume or market count
  const getColor = (cat: CategoryStats): string => {
    const value = useMarketCount ? cat.marketCount : (cat.totalVolume24h || 0);
    const total = useMarketCount ? totalMarkets : totalVolume;
    const pct = total > 0 ? value / total : 0;

    if (pct >= 0.2) return 'bg-blue-600';
    if (pct >= 0.15) return 'bg-blue-500';
    if (pct >= 0.1) return 'bg-blue-400';
    if (pct >= 0.05) return 'bg-blue-300';
    return 'bg-blue-200';
  };

  // Sort by volume or market count
  const sortedCategories = [...categories].sort((a, b) => {
    if (useMarketCount) {
      return b.marketCount - a.marketCount;
    }
    return (b.totalVolume24h || 0) - (a.totalVolume24h || 0);
  });

  return (
    <div>
      {/* Legend */}
      <div className="mb-4 flex items-center gap-4 text-sm">
        <span className="text-gray-700 dark:text-gray-300 font-medium">Volume Share:</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-600 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">High (20%+)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-400 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Medium (5-20%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-200 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Low (&lt;5%)</span>
        </div>
      </div>

      {/* Treemap-style grid */}
      <div className="grid grid-cols-4 gap-2" style={{ height }}>
        {sortedCategories.map((cat) => {
          const value = useMarketCount ? cat.marketCount : (cat.totalVolume24h || 0);
          const total = useMarketCount ? totalMarkets : totalVolume;
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
          const cellSpan = value > total * 0.2 ? 'col-span-2' : 'col-span-1';
          const rowSpan = value > total * 0.15 ? 'row-span-2' : 'row-span-1';

          return (
            <div
              key={cat.category}
              className={`${cellSpan} ${rowSpan} ${getColor(cat)} rounded-lg p-4 border-2 border-white dark:border-gray-900 cursor-pointer hover:opacity-90 transition-opacity flex flex-col justify-between`}
              title={`${cat.category}: ${useMarketCount ? `${cat.marketCount} markets` : `$${(cat.totalVolume24h || 0).toLocaleString()}`} (${pct}% of total)`}
            >
              <div>
                <h3 className="text-white font-bold text-lg capitalize mb-1">
                  {cat.category}
                </h3>
                <p className="text-white/90 text-sm">
                  {cat.marketCount} markets
                </p>
              </div>
              <div className="mt-2">
                {useMarketCount ? (
                  <p className="text-white font-semibold text-xl">
                    {cat.marketCount}
                  </p>
                ) : (
                  <p className="text-white font-semibold text-xl">
                    ${((cat.totalVolume24h || 0) / 1000).toFixed(0)}K
                  </p>
                )}
                <p className="text-white/80 text-xs">
                  {pct}% of {useMarketCount ? 'markets' : 'volume'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Category breakdown table */}
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Category
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Markets
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Total Volume
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Avg Volume
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Share
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedCategories.map((cat) => {
              const value = useMarketCount ? cat.marketCount : (cat.totalVolume24h || 0);
              const total = useMarketCount ? totalMarkets : totalVolume;
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';

              return (
                <tr key={cat.category} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {cat.category}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-right">
                    {cat.marketCount}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-right">
                    {cat.totalVolume24h != null
                      ? `$${cat.totalVolume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : '-'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-right">
                    {cat.avgVolume24h != null
                      ? `$${cat.avgVolume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : '-'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-right">
                    {pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
