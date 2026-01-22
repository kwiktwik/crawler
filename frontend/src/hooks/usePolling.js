/**
 * Custom hook for polling data at intervals
 */
import { useState, useEffect, useCallback } from 'react';

export function usePolling(fetchFn, interval = 5000, enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await fetchFn();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    if (!enabled) return;

    fetchData();
    const timer = setInterval(fetchData, interval);

    return () => clearInterval(timer);
  }, [fetchData, interval, enabled]);

  return { data, loading, error, refetch: fetchData };
}

export default usePolling;
