/**
 * Market Explorer Page
 *
 * Deep-dive view for a single market with charts, metrics, and detailed analysis
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useMarketMetrics, usePriceHistory } from '../../hooks';
import { PriceHistoryChart } from '../../components/charts/PriceHistoryChart';
import { MetricsCard } from '../../components/analytics/MetricsCard';
import { api } from '../../api';
import { Market } from '../../types';

export function MarketExplorer() {
  const { marketId } = useParams<{ marketId: string }>();
  const [market, setMarket] = useState<Market | null>(null);
  const [interval, setInterval] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('1h');
  const [chartType, setChartType] = useState<'line' | 'area' | 'candle'>('area');

  const { metrics, loading: metricsLoading } = useMarketMetrics(marketId || null);
  const { priceHistory, loading: priceLoading } = usePriceHistory(marketId || null, interval, 100);

  useEffect(() => {
    if (marketId) {
      api.getMarket(marketId).then(setMarket).catch(console.error);
    }
  }, [marketId]);

  if (!marketId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500">No market selected</p>
      </div>
    );
  }

  const probability = market?.tokens?.[0]?.price || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Market Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {market?.question || 'Loading...'}
              </h1>
              {market?.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">{market.description}</p>
              )}
            </div>
            <div className="text-right ml-4">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {(probability * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">Current Probability</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Volume (24h)</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                ${market?.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Liquidity</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                ${market?.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-lg font-semibold">
                {market?.active && !market?.closed ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-gray-500">Closed</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">End Date</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {market?.end_date ? new Date(market.end_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Analytics Metrics */}
        {metrics && !metricsLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <MetricsCard
              label="Volatility (24h)"
              value={(metrics.volatility_24h * 100).toFixed(2) + '%'}
              description="Price fluctuation risk"
            />
            <MetricsCard
              label="Momentum (24h)"
              value={(metrics.momentum_24h >= 0 ? '+' : '') + metrics.momentum_24h.toFixed(2) + '%'}
              trend={metrics.momentum_24h > 0 ? 'up' : metrics.momentum_24h < 0 ? 'down' : 'neutral'}
              description="Price change rate"
            />
            <MetricsCard
              label="Sharpe Ratio"
              value={metrics.sharpe_ratio.toFixed(2)}
              description="Risk-adjusted returns"
            />
            <MetricsCard
              label="Volume Trend"
              value={(metrics.volume_trend >= 0 ? '+' : '') + metrics.volume_trend.toFixed(1) + '%'}
              trend={metrics.volume_trend > 0 ? 'up' : metrics.volume_trend < 0 ? 'down' : 'neutral'}
              description="Volume change"
            />
          </div>
        )}

        {/* Price Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Price History</h2>

            <div className="flex gap-4">
              {/* Chart Type Selector */}
              <div className="flex gap-2">
                {(['line', 'area', 'candle'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setChartType(type)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      chartType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>

              {/* Interval Selector */}
              <div className="flex gap-2">
                {(['1h', '4h', '1d'] as const).map((int) => (
                  <button
                    key={int}
                    onClick={() => setInterval(int)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      interval === int
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {int.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {priceLoading ? (
            <div className="flex items-center justify-center h-96">
              <p className="text-gray-500">Loading chart...</p>
            </div>
          ) : (
            <PriceHistoryChart
              data={priceHistory}
              height={400}
              showVolume={true}
              chartType={chartType}
            />
          )}
        </div>

        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Outcomes */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Outcomes</h3>
            <div className="space-y-2">
              {market?.outcomes.map((outcome, idx) => {
                const token = market.tokens[idx];
                return (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-gray-300">{outcome}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {token ? (token.price * 100).toFixed(1) + '%' : 'N/A'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trader Activity */}
          {metrics && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Trader Activity
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Unique Traders (24h)</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {metrics.trader_count_24h}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Price Trend</p>
                  <p className={`text-lg font-medium ${
                    metrics.price_trend > 0 ? 'text-green-600' : metrics.price_trend < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {metrics.price_trend >= 0 ? '+' : ''}{metrics.price_trend.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
