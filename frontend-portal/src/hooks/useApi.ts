import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api";

export function useApi<T = unknown>(
  queryKey: string | string[],
  url: string,
  options: {
    staleTime?: number;
    enabled?: boolean;
    params?: Record<string, unknown>;
    [key: string]: unknown;
  } = {}
) {
  const { staleTime, enabled = true, params, ...rest } = options;
  return useQuery<T>({
    queryKey: Array.isArray(queryKey) ? queryKey : [queryKey],
    queryFn: () => api.get(url, params ? { params } : {}) as Promise<T>,
    staleTime: staleTime ?? 5 * 60 * 1000,
    enabled,
    ...rest,
  });
}

export function useApiMutation<T = unknown, V = unknown>(
  url: string,
  method: "post" | "put" | "delete" = "post"
) {
  return useMutation<T, Error, V>({
    mutationFn: (body: V) => (api[method] as (u: string, b: V) => Promise<T>)(url, body),
  });
}

export { useQueryClient };
