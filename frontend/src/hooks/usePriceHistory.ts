/**
 * Custom hook for fetching price history (OHLCV candlestick data)
 */

import { useState, useEffect } from 'react';
import { api } from '../api';
import { PriceHistory } from '../types';

export function usePriceHistory(
  marketId: string | null,
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
  limit = 100
) {
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketId) {
      setPriceHistory([]);
      return;
    }

    const fetchPriceHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getPriceHistory(marketId, interval, limit);
        setPriceHistory(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch price history');
        setPriceHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPriceHistory();
  }, [marketId, interval, limit]);

  return { priceHistory, loading, error };
}
