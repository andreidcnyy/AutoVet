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
  const { staleTime, enabled = true, params, ...rest } = options;
  return useQuery({
    queryKey: Array.isArray(queryKey) ? queryKey : [queryKey],
    queryFn: () => api.get(url, params ? { params } : {}),
    staleTime: staleTime ?? 5 * 60 * 1000,
    enabled,
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
