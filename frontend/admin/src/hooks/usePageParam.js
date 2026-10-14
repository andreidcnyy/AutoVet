import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * The current page number of a list, kept in the URL (?page=3) instead of
 * component state.
 *
 * In state, paging through 1 → 2 → 3 never created history entries, so the
 * browser's Back button skipped every page and left the screen altogether
 * (usually landing on the dashboard), and a refresh always went back to
 * page 1. In the URL, each page change is a history entry: Back returns to
 * the previous page, and a refresh or a shared link opens the same page.
 *
 * `key` lets several lists on one screen keep separate pages
 * (e.g. "page" and "petsPage").
 *
 * setPage(n, { replace: true }) changes the page without adding a history
 * entry — use it for resets (a new search going back to page 1), which
 * should not need an extra Back press to undo.
 */
export function usePageParam(key = "page") {
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = parseInt(searchParams.get(key) || "1", 10);
  const page = Number.isFinite(raw) && raw > 0 ? raw : 1;

  const setPage = useCallback(
    (next, { replace = false } = {}) => {
      // Read the live URL rather than this render's copy, so two quick
      // updates in a row do not overwrite each other.
      const params = new URLSearchParams(window.location.search);
      const current = parseInt(params.get(key) || "1", 10) || 1;
      const value = typeof next === "function" ? next(current) : next;
      const n = parseInt(value, 10);
      const target = Number.isFinite(n) && n > 1 ? n : 1;

      // Already there: no navigation, so no duplicate history entry (a
      // search box resets to page 1 on every keystroke).
      if (target === current) return;

      if (target === 1) params.delete(key);
      else params.set(key, String(target));
      setSearchParams(params, { replace });
    },
    [key, setSearchParams]
  );

  return [page, setPage];
}
