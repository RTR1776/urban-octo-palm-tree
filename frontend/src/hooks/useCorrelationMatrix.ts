/**
 * Custom hook to fetch correlation matrix data
 */

import { useState, useEffect } from 'react';
import { api } from '../api';

interface CorrelationData {
  markets: Array<{
    id: string;
    question: string;
  }>;
  matrix: number[][];
}

export function useCorrelationMatrix(limit: number = 10) {
  const [data, setData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await api.getCorrelationMatrix(limit);

        // Convert nested object matrix to 2D array
        const { markets, matrix: matrixObj } = result;
        const matrix2D: number[][] = [];

        for (let i = 0; i < markets.length; i++) {
          const row: number[] = [];
          for (let j = 0; j < markets.length; j++) {
            const value = matrixObj[markets[i].id]?.[markets[j].id] ?? 0;
            row.push(value);
          }
          matrix2D.push(row);
        }

        setData({
          markets,
          matrix: matrix2D,
        });
      } catch (err) {
        console.error('Error fetching correlation matrix:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch correlation data');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [limit]);

  return { data, loading, error };
}
