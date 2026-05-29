import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getPetImageUrl, getActualPetImageUrl } from "./petImages";

const pdfCurrency = (value: any) =>
  "P " + (parseFloat(value) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function getBase64ImageFromUrl(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject("Failed to convert image to base64");
    reader.readAsDataURL(blob);
  });
}

export async function generateInvoicePDF(invoiceData: any, clinic: any) {
  if (!invoiceData) return;

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const patient = invoiceData.pet;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  let y = 15;

  // Logo
  if (clinic?.clinic_logo) {
    try {
      const logoBase64 = clinic.clinic_logo.startsWith("data:")
        ? clinic.clinic_logo
        : await getBase64ImageFromUrl(clinic.clinic_logo).catch(() => null);
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", 14, y, 16, 16, undefined, "FAST");
      }
    } catch (e) {
      console.error("PDF Logo error:", e);
    }
  }

  // Clinic info
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(clinic?.clinic_name || "AutoVet Clinic", 34, y + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(clinic?.address || "", 34, y + 13);
  doc.text([clinic?.phone_number, clinic?.primary_email].filter(Boolean).join(" • "), 34, y + 17);

  // INVOICE / RECEIPT title
  const isPaid =
    invoiceData.status === "Paid" ||
    (Number(invoiceData.amount_paid) >= Number(invoiceData.total) && Number(invoiceData.total) > 0);
  const docTitle = isPaid ? "RECEIPT" : "INVOICE";

  doc.setTextColor(203, 213, 225);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(docTitle, pageW - 14, y + 10, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `${isPaid ? "Receipt" : "Invoice"} #${invoiceData.invoice_number || "VB-2026-000"}`,
    pageW - 14,
    y + 18,
    { align: "right" }
  );
  // Prefer the stored service (booked appointment) date over the row creation date.
  const rawDate = invoiceData.service_date || invoiceData.appointment?.date || invoiceData.created_at;
  const docDate = rawDate
    ? new Date(typeof rawDate === 'string' && rawDate.includes('-') && !rawDate.includes('T') ? rawDate.replace(/-/g, '/') : rawDate)
    : new Date();
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${docDate.toLocaleDateString()}`, pageW - 14, y + 23, { align: "right" });
  if (isPaid) {
    doc.text(`Payment: ${invoiceData.payment_method || "Cash"}`, pageW - 14, y + 28, { align: "right" });
  } else {
    doc.text("Due: Upon Receipt", pageW - 14, y + 28, { align: "right" });
  }

  y = 55;

  // Bill To
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", 14, y);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.text(patient?.owner?.name || "Guest Client", 14, y + 7);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(patient?.owner?.address || "No address", 14, y + 13);
  doc.text(patient?.owner?.email || "", 14, y + 18);
  doc.text(patient?.owner?.phone || "", 14, y + 23);

  // Patient card
  const patientCardX = 110;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(patientCardX - 4, y - 4, 90, 36, 4, 4, "F");

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PATIENT", patientCardX, y + 2);

  if (patient) {
    const speciesName = typeof patient.species === "string" ? patient.species : patient.species?.name || "";
    const breedName = typeof patient.breed === "string" ? patient.breed : patient.breed?.name || "";
    const photoUrl = patient.photo
      ? getActualPetImageUrl(patient.photo)
      : getPetImageUrl(speciesName, breedName);

    if (photoUrl && !photoUrl.endsWith(".svg")) {
      try {
        const base64 = await getBase64ImageFromUrl(photoUrl).catch(() => null);
        if (base64) {
          doc.addImage(base64, "JPEG", patientCardX, y + 5, 12, 12);
        }
      } catch (e) {
        console.error("PDF Patient Image error:", e);
      }
    }

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text(patient.name || "N/A", patientCardX + 16, y + 10);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${speciesName} • ${breedName || "Mixed"}`, patientCardX + 16, y + 15);
    doc.text(`Weight: ${invoiceData.weight_override || patient.weight || "N/A"} kg`, patientCardX + 16, y + 20);
  }

  y += 45;

  // Line items table
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fillColor: [255, 255, 255], textColor: [30, 41, 59], cellPadding: 4, fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "right", cellWidth: 20 },
      2: { halign: "right", cellWidth: 30 },
      3: { halign: "right", cellWidth: 35 },
    },
    head: [["DESCRIPTION", "QTY", "UNIT PRICE", "AMOUNT"]],
    body: (invoiceData.items || [])
      .filter((item: any) => !item.is_hidden)
      .map((item: any) => [
        (item.name || "Item").toUpperCase() + (item.notes ? "\n" + item.notes : ""),
        item.qty || 1,
        Number(item.unit_price || 0).toFixed(2),
        Number(item.amount || 0).toFixed(2),
      ]),
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // Totals
  const totalsX = pageW - 14;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);

  doc.text("Subtotal", totalsX - 40, y, { align: "right" });
  doc.setTextColor(30, 41, 59);
  doc.text(pdfCurrency(invoiceData.subtotal), totalsX, y, { align: "right" });

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("VAT (12%)", totalsX - 40, y, { align: "right" });
  doc.setTextColor(30, 41, 59);
  doc.text(pdfCurrency(parseFloat(invoiceData.subtotal) * 0.12), totalsX, y, { align: "right" });

  y += 12;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Total Due", totalsX - 45, y, { align: "right" });
  doc.setTextColor(37, 99, 235);
  doc.text(pdfCurrency(invoiceData.total), totalsX, y, { align: "right" });

  // Notes
  if (invoiceData.notes_to_client || invoiceData.notes) {
    y += 20;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("NOTES TO CLIENT", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const splitNotes = doc.splitTextToSize(invoiceData.notes_to_client || invoiceData.notes, 140);
    doc.text(splitNotes, 14, y + 6);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Powered by AutoVet Systems", pageW / 2, pageH - 10, { align: "center" });

  doc.save(`${docTitle}_${invoiceData.invoice_number || "VB-2026-000"}.pdf`);
}
