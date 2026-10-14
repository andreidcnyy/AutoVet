/**
 * Loads every page of a paginated list endpoint.
 *
 * The API caps page size (100 rows), so a screen that needs the whole list
 * walks the pages instead of asking for one oversized page. `fetchPage(page)`
 * must resolve to a Laravel paginator body: { data, last_page, total }.
 * The first page is fetched alone to learn how many there are; the rest are
 * fetched in parallel.
 */
export async function fetchAllPages(fetchPage) {
  const first = await fetchPage(1);
  const lastPage = Number(first?.last_page) || 1;

  const rest = lastPage > 1
    ? await Promise.all(Array.from({ length: lastPage - 1 }, (_, i) => fetchPage(i + 2)))
    : [];

  const data = [first, ...rest].flatMap((page) => page?.data || []);
  return { data, total: Number(first?.total) || data.length };
}
