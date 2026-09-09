import autoTable from "jspdf-autotable";

/**
 * The letterhead, table styling and footer shared by every document the clinic
 * hands out, so a summary or a report is recognisably the same stationery as an
 * invoice rather than a differently-branded one-off.
 */

const INK = [30, 41, 59];      // zinc-800 — body text
const MUTED = [100, 116, 139]; // zinc-500 — labels
const BRAND = [37, 99, 235];   // blue-600 — table headers, emphasis
const GHOST = [203, 213, 225]; // zinc-300 — the oversized document title

export async function getBase64ImageFromUrl(imageUrl) {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to convert image to base64"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Clinic logo, name and contact details on the left; the document title and its
 * meta lines on the right. Returns the y offset the body should start at.
 */
export async function drawClinicLetterhead(doc, clinic, docTitle, metaLines = []) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const y = 15;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  if (clinic?.clinic_logo) {
    try {
      const logoBase64 = clinic.clinic_logo.startsWith("data:")
        ? clinic.clinic_logo
        : await getBase64ImageFromUrl(clinic.clinic_logo).catch(() => null);
      if (logoBase64) doc.addImage(logoBase64, "PNG", 14, y, 16, 16, undefined, "FAST");
    } catch (e) {
      console.error("PDF logo error:", e);
    }
  }

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(clinic?.clinic_name || "AutoVet Clinic", 34, y + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(clinic?.address || "", 34, y + 13);
  doc.text([clinic?.phone_number, clinic?.primary_email].filter(Boolean).join(" • "), 34, y + 17);

  doc.setTextColor(...GHOST);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(docTitle, pageW - 14, y + 10, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  metaLines.slice(0, 3).forEach((line, i) => {
    doc.setTextColor(...(i === 0 ? INK : MUTED));
    doc.text(line, pageW - 14, y + 18 + i * 5, { align: "right" });
  });

  return 55;
}

/** The closing line every clinic document carries. */
export function drawClinicFooter(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pages = doc.internal.getNumberOfPages();

  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Powered by AutoVet Systems", pageW / 2, pageH - 10, { align: "center" });
    if (pages > 1) {
      doc.text(`Page ${page} of ${pages}`, pageW - 14, pageH - 10, { align: "right" });
    }
  }
}

/**
 * A section heading in the label style the invoice uses above "BILL TO".
 * Returns the y the table below it should start at.
 */
export function drawSectionLabel(doc, label, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), 14, y);
  return y + 4;
}

/**
 * The invoice line-items table: white body, blue header, right-aligned numeric
 * columns whose headings are aligned to match. jspdf-autotable applies
 * columnStyles to body cells only, so the header alignment has to be mirrored
 * on explicitly or the headings sit left of the figures beneath them.
 */
export function brandedTable(doc, { startY, head, body, columnStyles = {}, rightAlignFrom = null }) {
  autoTable(doc, {
    startY,
    theme: "striped",
    styles: { fillColor: [255, 255, 255], textColor: INK, cellPadding: 3.5, fontSize: 9 },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    columnStyles,
    didParseCell: (data) => {
      if (data.section !== "head") return;
      const colStyle = columnStyles[data.column.index];
      if (colStyle?.halign) data.cell.styles.halign = colStyle.halign;
      else if (rightAlignFrom !== null && data.column.index >= rightAlignFrom) {
        data.cell.styles.halign = "right";
      }
    },
    head: [head],
    body,
    margin: { left: 14, right: 14 },
  });
  return doc.lastAutoTable.finalY + 12;
}
