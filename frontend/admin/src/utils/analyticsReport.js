import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Builds the Analytics report as a real PDF document.
 *
 * The previous export screenshotted the whole page into one tall PNG and sliced
 * it across pages at fixed offsets, so rows and cards were cut in half at every
 * page break, nothing was selectable or searchable, and the text softened
 * wherever the raster did not land on a pixel boundary.
 *
 * This draws the document instead: real text, real tables, a repeating header
 * and footer, and page numbering. Charts stay images — they genuinely are
 * graphics — but they are placed deliberately rather than sliced.
 *
 * Currency is written as "PHP 1,234.00" rather than with the peso sign: jsPDF's
 * built-in fonts are WinAnsi-encoded and have no glyph for U+20B1, which would
 * render as a wrong character in the downloaded file.
 */

const MARGIN = 14;
const BRAND = [16, 122, 74];
const INK = [24, 24, 27];
const MUTED = [113, 113, 122];
const RULE = [228, 228, 231];

const peso = (n) =>
  "PHP " +
  Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const count = (n) => Number(n || 0).toLocaleString("en-PH");

const longDate = (d) =>
  d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

/** Header rule drawn on every page, including ones autoTable adds itself. */
function decoratePage(doc, meta) {
  const w = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND);
  doc.text(meta.clinicName, MARGIN, 12);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Data Analytics Report", w - MARGIN, 12, { align: "right" });

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 15, w - MARGIN, 15);
}

/**
 * Footers, written once the document is complete.
 *
 * Numbering cannot be done while drawing: the total is not known until the last
 * table has been laid out, and getNumberOfPages() during a didDrawPage hook
 * reports the count at that moment — which stamped "Page 1" onto every page.
 */
function paginate(doc, meta) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const total = doc.internal.getNumberOfPages();

  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, h - 12, w - MARGIN, h - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Generated ${meta.generatedOn} by ${meta.generatedBy}`, MARGIN, h - 7);
    doc.text(`Page ${page} of ${total}`, w - MARGIN, h - 7, { align: "right" });
  }
}

function sectionHeading(doc, title, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(title, MARGIN, y);
  return y + 2;
}

export function buildAnalyticsReport({
  clinicName = "Pet Wellness Animal Clinic",
  generatedBy = "Authorized Personnel",
  trends,
  stats,
  stock,
  charts = {},
  now = new Date(),
} = {}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const meta = { clinicName, generatedBy, generatedOn: longDate(now) };

  const tableDefaults = {
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN, top: 22, bottom: 18 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, lineColor: RULE, lineWidth: 0.2 },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    didDrawPage: () => decoratePage(doc, meta),
  };

  // ── Title block ─────────────────────────────────────────────────────────
  decoratePage(doc, meta);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text("Data Analytics Report", MARGIN, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(
    "Revenue, transaction volume and inventory position for the last 12 months.",
    MARGIN,
    37
  );

  let y = 46;

  // ── Key figures ─────────────────────────────────────────────────────────
  const lowStock = Number(stock?.summary?.low_stock || 0);
  const outOfStock = Number(stock?.summary?.out_of_stock || 0);

  autoTable(doc, {
    ...tableDefaults,
    startY: y,
    head: [["Key figure", "Value"]],
    body: [
      ["Total revenue (12 months)", peso(trends?.summary?.total_revenue)],
      ["Average ticket size", peso(trends?.summary?.avg_per_invoice)],
      ["Total invoices (12 months)", count(trends?.summary?.total_invoices)],
      ["Items low or out of stock", count(lowStock + outOfStock)],
    ],
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Revenue chart, when the caller captured one ─────────────────────────
  if (charts.revenue) {
    if (y > 200) { doc.addPage(); decoratePage(doc, meta); y = 24; }
    y = sectionHeading(doc, "Revenue trend", y) + 4;
    const imgW = w - MARGIN * 2;
    const imgH = Math.min(70, imgW * 0.36);
    doc.addImage(charts.revenue, "PNG", MARGIN, y, imgW, imgH, undefined, "FAST");
    y += imgH + 10;
  }

  // ── Monthly breakdown ───────────────────────────────────────────────────
  const series = Array.isArray(trends?.series) ? trends.series : [];
  if (series.length) {
    if (y > 210) { doc.addPage(); decoratePage(doc, meta); y = 24; }
    y = sectionHeading(doc, "Monthly breakdown", y) + 2;
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      head: [["Month", "Invoices", "Revenue"]],
      body: series.map((r) => [
        String(r.month ?? "—"),
        count(r.actual_count),
        peso(r.actual_revenue),
      ]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      foot: [[
        "Total",
        count(series.reduce((s, r) => s + Number(r.actual_count || 0), 0)),
        peso(series.reduce((s, r) => s + Number(r.actual_revenue || 0), 0)),
      ]],
      footStyles: { fillColor: [244, 244, 245], textColor: INK, fontStyle: "bold" },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ── Top performing items ────────────────────────────────────────────────
  const topItems = Array.isArray(stats?.top_items) ? stats.top_items : [];
  if (topItems.length) {
    if (y > 220) { doc.addPage(); decoratePage(doc, meta); y = 24; }
    y = sectionHeading(doc, "Top performing items (last 30 days)", y) + 2;
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      head: [["#", "Item", "Units"]],
      body: topItems.map((it, i) => [String(i + 1), String(it.name ?? "—"), count(it.total_qty)]),
      columnStyles: { 0: { cellWidth: 10, halign: "right" }, 2: { halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ── Inventory health ────────────────────────────────────────────────────
  if (y > 220) { doc.addPage(); decoratePage(doc, meta); y = 24; }
  y = sectionHeading(doc, "Inventory health", y) + 2;
  autoTable(doc, {
    ...tableDefaults,
    startY: y,
    head: [["Status", "Items"]],
    body: [
      ["In stock", count(stock?.summary?.in_stock)],
      ["Low stock", count(lowStock)],
      ["Out of stock", count(outOfStock)],
    ],
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
  });
  y = doc.lastAutoTable.finalY + 8;

  const alerts = Array.isArray(stock?.alert_items) ? stock.alert_items : [];
  if (alerts.length) {
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      head: [["Critical action item", "On hand", "Minimum", "Deficit"]],
      body: alerts.map((it) => [
        String(it.name ?? "—"),
        count(it.stock),
        count(it.min_stock),
        count(it.deficit),
      ]),
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right", fontStyle: "bold" },
      },
    });
  }

  // ── Closing note, on the last page ──────────────────────────────────────
  doc.setPage(doc.internal.getNumberOfPages());
  const h = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    "Confidential — generated by AutoVet for internal clinic use.",
    MARGIN,
    h - 16
  );

  paginate(doc, meta);

  return doc;
}

export function analyticsReportFilename(now = new Date()) {
  const stamp = now.toISOString().split("T")[0];
  return `AutoVet_Analytics_Report_${stamp}.pdf`;
}
