/**
 * Custom hook for fetching market metrics
 */

import { useState, useEffect } from 'react';
import { api } from '../api';
import { MarketMetrics } from '../types';

export function useMarketMetrics(marketId: string | null) {
  const [metrics, setMetrics] = useState<MarketMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketId) {
      setMetrics(null);
      return;
    }

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getMarketMetrics(marketId);
        setMetrics(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch metrics');
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [marketId]);

  return { metrics, loading, error };
}
