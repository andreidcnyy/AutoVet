/**
 * The order a product's batches are used in: FEFO, first expired first out.
 * Mirrors Inventory::scopeConsumptionOrder() on the backend, so the screen
 * shows exactly what an invoice will deduct from first:
 *   1. in-date batches, soonest expiry first,
 *   2. then batches with no expiry date, oldest received first,
 *   3. expired batches last (they are never used).
 */
function dayKey(date) {
  if (!date) return null;
  return String(date).slice(0, 10); // "YYYY-MM-DD", compared as text
}

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function byConsumptionOrder(a, b) {
  const today = todayKey();
  const ea = dayKey(a.expiration_date);
  const eb = dayKey(b.expiration_date);
  const rank = (e) => (e && e < today ? 2 : e ? 0 : 1); // in date, no date, expired

  const r = rank(ea) - rank(eb);
  if (r !== 0) return r;
  if (ea && eb && ea !== eb) return ea < eb ? -1 : 1;
  return a.id - b.id;
}
