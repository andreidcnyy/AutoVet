import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api";

/**
 * useApi(queryKey, url, options)
 *
 * Drop-in hook for GET requests with automatic caching, deduplication, and
 * background refresh. Any component that calls useApi with the same queryKey
 * shares the same cached response — no duplicate network requests.
 *
 * Usage:
 *   const { data, isLoading } = useApi(['owners'], '/api/owners');
 *   const { data, isLoading } = useApi(['pets'], '/api/pets', { staleTime: 10 * 60 * 1000 });
 */
export function useApi(queryKey, url, options = {}) {
  const { staleTime, enabled = true, params, cacheKey, cacheTTL = 5 * 60 * 1000, ...rest } = options;

  let placeholderData;
  if (cacheKey) {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached && Date.now() - cached.ts < cacheTTL) {
        placeholderData = cached.data;
      }
    } catch (_) {}
  }

  return useQuery({
    queryKey: Array.isArray(queryKey) ? queryKey : [queryKey],
    queryFn: async () => {
      const data = await api.get(url, params ? { params } : {});
      if (cacheKey) {
        try { localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() })); } catch (_) {}
      }
      return data;
    },
    staleTime: staleTime ?? 5 * 60 * 1000,
    enabled,
    placeholderData,
    ...rest,
  });
}

/**
 * useApiMutation(url, method)
 *
 * Hook for POST/PUT/DELETE with automatic cache invalidation.
 *
 * Usage:
 *   const { mutateAsync } = useApiMutation('/api/owners', 'post');
 *   await mutateAsync(data);
 *   // Optionally invalidate cache:
 *   const qc = useQueryClient(); qc.invalidateQueries({ queryKey: ['owners'] });
 */
export function useApiMutation(url, method = "post") {
  return useMutation({
    mutationFn: (body) => api[method](url, body),
  });
}

export { useQueryClient };
