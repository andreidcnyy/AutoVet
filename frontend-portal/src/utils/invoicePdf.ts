import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getPetImageUrl, getActualPetImageUrl } from "./petImages";

const pdfCurrency = (value: any) => "P " + (parseFloat(value) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function generateInvoicePDF(invoiceData: any, clinic: any) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const patient = invoiceData.pet;

  // 1. Light Theme Background (White)
  doc.setFillColor(255, 255, 255); 
  doc.rect(0, 0, pageW, pageH, "F");

  let y = 15;

  // 2. Header Section
  if (clinic?.clinic_logo) {
    try {
      doc.addImage(clinic.clinic_logo, 'PNG', 14, y, 16, 16, undefined, 'FAST');
    } catch (e) {
      console.error("PDF Logo error:", e);
    }
  }

  // Clinic Info (Left Aligned)
  doc.setTextColor(30, 41, 59); // zinc-800 (Dark)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(clinic?.clinic_name || "AutoVet Clinic", 34, y + 8);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // zinc-500
  doc.text(clinic?.address || "", 34, y + 13);
  doc.text([clinic?.phone_number, clinic?.primary_email].filter(Boolean).join(" • "), 34, y + 17);

  // Invoice Title (Right Aligned)
  doc.setTextColor(203, 213, 225); // Light zinc for the word "INVOICE"
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageW - 14, y + 10, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`#${invoiceData.invoice_number || "INV-000"}`, pageW - 14, y + 18, { align: "right" });
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${new Date(invoiceData.created_at).toLocaleDateString()}`, pageW - 14, y + 23, { align: "right" });
  doc.text(`Due: Upon Receipt`, pageW - 14, y + 28, { align: "right" });

  y = 55;

  // 3. Invoice Sections
  // Bill To Box
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", 14, y);
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.text(patient?.owner?.name || "Client", 14, y + 7);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(patient?.owner?.address || "No address provided", 14, y + 13);
  doc.text(patient?.owner?.email || "", 14, y + 18);
  doc.text(patient?.owner?.phone || "", 14, y + 23);

  // Patient Card (Subtle Gray Box)
  const patientCardX = 110;
  doc.setFillColor(248, 250, 252); // zinc-50 (Very light gray)
  doc.roundedRect(patientCardX - 4, y - 4, 90, 32, 4, 4, "F");
  
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PATIENT", patientCardX, y + 2);

  if (patient) {
    const photoUrl = patient.photo ? getActualPetImageUrl(patient.photo) : getPetImageUrl(patient.species, patient.breed);
    if (photoUrl && !photoUrl.endsWith(".svg")) { // jsPDF can't easily handle SVGs directly
      try {
          doc.addImage(photoUrl, 'JPEG', patientCardX, y + 5, 10, 10);
      } catch(e){
        console.error("PDF Patient Image error:", e);
      }
    }
  }

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.text(patient?.name || "N/A", patientCardX + 13, y + 10);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const speciesName = typeof patient?.species === 'string' ? patient?.species : patient?.species?.name || "";
  const breedName = typeof patient?.breed === 'string' ? patient?.breed : patient?.breed?.name || "";
  doc.text(`${speciesName} • ${breedName}`, patientCardX + 13, y + 15);

  y += 45;

  // 4. Line Items Table (Clean Light Design)
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: {
      fillColor: [255, 255, 255],
      textColor: [30, 41, 59],
      cellPadding: 4,
      fontSize: 9,
    },
    headStyles: {
      fillColor: [37, 99, 235], // Blue header for branding
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { halign: 'left' }, 
      1: { halign: 'right', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 35 },
    },
    head: [["DESCRIPTION", "QTY", "UNIT PRICE", "AMOUNT"]],
    body: (invoiceData.items || []).filter((item: any) => !item.is_hidden).map((item: any) => [
      item.name.toUpperCase() + (item.notes ? "\n" + item.notes : ""),
      item.qty,
      (parseFloat(item.unit_price) || 0).toFixed(2),
      (parseFloat(item.amount) || 0).toFixed(2)
    ]),
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  y = finalY;

  // 5. Totals Section
  const totalsX = pageW - 14;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  
  const subtotal = parseFloat(invoiceData.subtotal);
  const total = parseFloat(invoiceData.total);
  const tax = total - (subtotal - (parseFloat(invoiceData.discount_value) || 0)); // Simple calc or just use data

  // Subtotal
  doc.text("Subtotal", totalsX - 40, y, { align: "right" });
  doc.setTextColor(30, 41, 59);
  doc.text(pdfCurrency(subtotal), totalsX, y, { align: "right" });
  
  // Tax
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`VAT (${invoiceData.tax_rate}%)`, totalsX - 40, y, { align: "right" });
  doc.setTextColor(30, 41, 59);
  doc.text(pdfCurrency(parseFloat(invoiceData.total) - (parseFloat(invoiceData.subtotal) - (parseFloat(invoiceData.discount_value) || 0))), totalsX, y, { align: "right" });

  // Total Due
  y += 12;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Total Due", totalsX - 45, y, { align: "right" });
  doc.setTextColor(37, 99, 235); // Blue-600 Highlight
  doc.text(pdfCurrency(invoiceData.total), totalsX, y, { align: "right" });

  // 6. Notes Footer
  if (invoiceData.notes_to_client) {
    y += 20;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("NOTES TO CLIENT", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const splitNotes = doc.splitTextToSize(invoiceData.notes_to_client, 140);
    doc.text(splitNotes, 14, y + 6);
  }

  // Final Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Powered by AutoVet Systems", pageW / 2, pageH - 10, { align: "center" });

  doc.save(`Invoice_${invoiceData.invoice_number || "INV"}.pdf`);
}
