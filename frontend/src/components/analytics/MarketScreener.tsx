/**
 * Market Screener Component
 *
 * Allows filtering markets by volume, liquidity, and categories
 */

import { useState } from 'react';
import { MarketFilter } from '../../types';

interface MarketScreenerProps {
  onFilterChange: (filter: MarketFilter) => void;
  availableCategories?: string[];
}

export function MarketScreener({ onFilterChange, availableCategories = [] }: MarketScreenerProps) {
  const [minVolume, setMinVolume] = useState<string>('1000');
  const [minLiquidity, setMinLiquidity] = useState<string>('500');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [excludeCrypto, setExcludeCrypto] = useState(true);

  const handleApplyFilters = () => {
    const filter: MarketFilter = {
      minVolume: minVolume ? parseFloat(minVolume) : undefined,
      minLiquidity: minLiquidity ? parseFloat(minLiquidity) : undefined,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      excludeCategories: excludeCrypto ? ['crypto', 'test'] : undefined,
    };
    onFilterChange(filter);
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleReset = () => {
    setMinVolume('1000');
    setMinLiquidity('500');
    setSelectedCategories([]);
    setExcludeCrypto(true);
    onFilterChange({
      minVolume: 1000,
      minLiquidity: 500,
      excludeCategories: ['crypto', 'test'],
    });
  };

  const commonCategories = ['politics', 'sports', 'finance', 'business', 'world', 'pop-culture'];
  const categoriesToShow = availableCategories.length > 0 ? availableCategories : commonCategories;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Market Screener</h3>

      <div className="space-y-4">
        {/* Volume Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Minimum Volume (24h)
          </label>
          <input
            type="number"
            value={minVolume}
            onChange={(e) => setMinVolume(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 1000"
          />
        </div>

        {/* Liquidity Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Minimum Liquidity
          </label>
          <input
            type="number"
            value={minLiquidity}
            onChange={(e) => setMinLiquidity(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 500"
          />
        </div>

        {/* Exclude Crypto Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="excludeCrypto"
            checked={excludeCrypto}
            onChange={(e) => setExcludeCrypto(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="excludeCrypto" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            Exclude crypto & test markets
          </label>
        </div>

        {/* Categories */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Categories (select to filter)
          </label>
          <div className="flex flex-wrap gap-2">
            {categoriesToShow.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryToggle(category)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedCategories.includes(category)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleApplyFilters}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Apply Filters
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
