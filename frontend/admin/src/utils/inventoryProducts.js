/**
 * One definition of "a product" and "low stock", shared by the Inventory page
 * and the Analytics page so their Low Stock Alerts counts cannot disagree.
 * Both read the same /api/inventory rows, whose forecast status the server has
 * already recalculated against today's stock.
 */

// Batches of one product share a code. Rows predating the code backfill have
// no code to group on, so they stand alone rather than collapsing into one
// shared "" bucket.
export const productKey = (row) => {
  const code = row.code ? String(row.code).trim() : "";
  return code !== "" ? `code:${code}` : `id:${row.id}`;
};

const SEVERITY = { "Low Stock": 3, "Reorder Soon": 2, Safe: 1 };

// A forecast is stored per batch. At product level report the most severe one,
// so a product is never shown as Safe while one of its batches is projected to
// run out.
export const worstForecastStatus = (batches) =>
  batches.reduce((worst, b) => {
    const status = b.latest_forecast?.forecast_status;
    if (!status) return worst;
    return (SEVERITY[status] ?? 0) > (SEVERITY[worst] ?? 0) ? status : worst;
  }, null);

export const isLowStockProduct = ({ worstStatus, totalStock }) =>
  worstStatus === "Low Stock" || totalStock <= 0;

/** Groups inventory rows into products, batches in FIFO (ascending id) order. */
export const groupProducts = (rows) => {
  const groups = new Map();
  for (const row of rows) {
    const key = productKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return Array.from(groups.entries()).map(([key, rows]) => {
    const batches = [...rows].sort((a, b) => a.id - b.id);
    return {
      key,
      batches,
      primary: batches[0],
      totalStock: batches.reduce((sum, b) => sum + Number(b.stock_level || 0), 0),
      worstStatus: worstForecastStatus(batches),
    };
  });
};

/**
 * Stock summary in the shape the Analytics page and its PDF report expect:
 * { summary: { total, in_stock, low_stock, out_of_stock }, alert_items }.
 */
export const summarizeStock = (rows) => {
  const products = groupProducts(Array.isArray(rows) ? rows : []);
  let inStock = 0, lowStock = 0, outOfStock = 0;
  const alertItems = [];

  for (const p of products) {
    if (!isLowStockProduct(p)) { inStock++; continue; }
    const min = Number(p.primary.min_stock_level || 0);
    const out = p.totalStock <= 0;
    if (out) outOfStock++; else lowStock++;
    alertItems.push({
      id: p.primary.id,
      name: p.primary.item_name,
      category: p.primary.inventory_category?.name ?? "Uncategorized",
      stock: p.totalStock,
      min_stock: min,
      deficit: out ? min + 1 : Math.max(0, min - p.totalStock + 1),
      status: out ? "out_of_stock" : "low_stock",
      supplier: p.primary.supplier,
    });
  }

  alertItems.sort((a, b) => b.deficit - a.deficit);
  return {
    summary: { total: products.length, in_stock: inStock, low_stock: lowStock, out_of_stock: outOfStock },
    alert_items: alertItems,
  };
};
