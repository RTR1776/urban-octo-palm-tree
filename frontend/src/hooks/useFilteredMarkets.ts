/**
 * Custom hook for fetching filtered markets
 */

import { useState, useEffect } from 'react';
import { api } from '../api';
import { Market, MarketFilter } from '../types';

export function useFilteredMarkets(filter?: MarketFilter, limit = 100) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert filter object to a stable string key for dependency array
  const filterKey = JSON.stringify(filter);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getFilteredMarkets(filter, limit);
        setMarkets(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch markets');
        setMarkets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, limit]);

  return { markets, loading, error };
}
