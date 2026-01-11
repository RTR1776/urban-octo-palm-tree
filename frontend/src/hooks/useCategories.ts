/**
 * Custom hook for fetching market categories
 */

import { useState, useEffect } from 'react';
import { api } from '../api';
import { CategoryStats } from '../types';

export function useCategories() {
  const [categories, setCategories] = useState<CategoryStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getAllCategories();
        setCategories(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch categories');
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, loading, error };
}
