import { useEffect, useState } from 'react';
import { Market } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Common Polymarket categories/tags
const CATEGORIES = [
  { id: 'politics', name: 'Politics', emoji: '🗳️' },
  { id: 'sports', name: 'Sports', emoji: '⚽' },
  { id: 'crypto', name: 'Crypto', emoji: '₿' },
  { id: 'finance', name: 'Finance', emoji: '💰' },
  { id: 'pop-culture', name: 'Pop Culture', emoji: '🎬' },
  { id: 'science', name: 'Science', emoji: '🔬' },
  { id: 'business', name: 'Business', emoji: '📊' },
  { id: 'world', name: 'World', emoji: '🌍' },
];

const formatVolume = (volume: number) => {
  if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
  return `$${volume.toFixed(0)}`;
};

export function CategoryFilter() {
  const [selectedCategory, setSelectedCategory] = useState<string>('politics');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategoryMarkets();
  }, [selectedCategory]);

  const loadCategoryMarkets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/markets/by-tag/${selectedCategory}?limit=20`);
      
      if (!response.ok) {
        setError(`API returned ${response.status}`);
        setMarkets([]);
        return;
      }
      
      const data = await response.json();
      const marketArray = Array.isArray(data) ? data : [];
      setMarkets(marketArray);
      
      if (marketArray.length === 0) {
        setError(`No ${selectedCategory} markets found`);
      }
    } catch (error) {
      console.error('Error loading category markets:', error);
      setError('Connection failed');
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  };

  const currentCategory = CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 px-6 py-4">
        <h3 className="text-xl font-bold text-white">🏷️ Browse by Category</h3>
        <p className="text-sm text-purple-300 mt-1">Filter markets by topic</p>
      </div>
      
      {/* Category Pills */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-3 py-1.5 rounded-full font-medium text-sm transition-all ${
                selectedCategory === category.id
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className="mr-1">{category.emoji}</span>
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Markets List */}
      <div className="p-4">
        {loading ? (
          <div className="text-center text-gray-400 py-6">
            <div className="animate-pulse">Loading {currentCategory?.name} markets...</div>
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <div className="text-yellow-400 mb-2">⚠️ {error}</div>
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center text-gray-400 py-6">
            No markets found
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-gray-500 mb-3">
              {currentCategory?.emoji} Showing {markets.length} {currentCategory?.name} markets
            </div>
            {markets.slice(0, 10).map((market, index) => (
              <div
                key={market.id}
                className="flex items-start gap-3 p-3 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors border border-gray-700/50"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-gray-500">#{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-200 line-clamp-2 leading-tight">
                    {market.question}
                  </h4>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-gray-400">
                      Vol: <span className="text-green-400 font-semibold">{formatVolume(market.volume || 0)}</span>
                    </span>
                    {market.liquidity && market.liquidity > 0 && (
                      <span className="text-gray-400">
                        Liq: <span className="text-blue-400 font-semibold">{formatVolume(market.liquidity)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
