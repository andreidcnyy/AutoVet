import { useMemo, useState, useEffect } from "react";
import clsx from "clsx";
import {
  FiCalendar,
  FiChevronDown,
  FiDownload,
  FiEye,
  FiPlusCircle,
  FiPrinter,
  FiSearch,
  FiSend,
} from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { getPetImageUrl, getActualPetImageUrl } from "../../utils/petImages";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const currency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
const pdfCurrency = (value) => "P " + (value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ───────────────────────────────────────── PDF Generation ── */
async function generateInvoicePDF(invoiceData, patient, clinic) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

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
  doc.setTextColor(30, 41, 59); // Slate-800 (Dark)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(clinic?.clinic_name || "AutoVet Clinic", 34, y + 8);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(clinic?.address || "", 34, y + 13);
  doc.text([clinic?.phone_number, clinic?.primary_email].filter(Boolean).join(" • "), 34, y + 17);

  // Invoice Title (Right Aligned)
  doc.setTextColor(203, 213, 225); // Light slate for the word "INVOICE"
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageW - 14, y + 10, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`#${invoiceData.invoice_number || "VB-2026-000"}`, pageW - 14, y + 18, { align: "right" });
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, pageW - 14, y + 23, { align: "right" });
  doc.text(`Due: Upon Receipt`, pageW - 14, y + 28, { align: "right" });

  y = 55;

  // 3. Billing Sections
  // Bill To Box
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

  // Patient Card (Subtle Gray Box)
  const patientCardX = 110;
  doc.setFillColor(248, 250, 252); // Slate-50 (Very light gray)
  doc.roundedRect(patientCardX - 4, y - 4, 90, 32, 4, 4, "F");
  
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PATIENT", patientCardX, y + 2);

  if (patient) {
    const photoUrl = patient.photo ? getActualPetImageUrl(patient.photo) : getPetImageUrl(patient.species?.name, patient.breed?.name);
    if (photoUrl) {
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
  doc.text(`${patient?.species?.name || ""} • ${patient?.breed?.name || ""}`, patientCardX + 13, y + 15);

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
    body: invoiceData.items.map(item => [
      item.name.toUpperCase() + (item.notes ? "\n" + item.notes : ""),
      item.qty,
      (item.unitPrice || 0).toFixed(2),
      (item.amount || 0).toFixed(2)
    ]),
  });

  y = doc.lastAutoTable.finalY + 15;

  // 5. Totals Section
  const totalsX = pageW - 14;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  
  // Subtotal
  doc.text("Subtotal", totalsX - 40, y, { align: "right" });
  doc.setTextColor(30, 41, 59);
  doc.text(pdfCurrency(invoiceData.subtotal), totalsX, y, { align: "right" });
  
  // Fixed VAT 12%
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("VAT (12%)", totalsX - 40, y, { align: "right" });
  doc.setTextColor(30, 41, 59);
  doc.text(pdfCurrency(invoiceData.subtotal * 0.12), totalsX, y, { align: "right" });

  // Total Due
  y += 12;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Total Due", totalsX - 45, y, { align: "right" });
  doc.setTextColor(37, 99, 235); // Blue-600 Highlight
  doc.text(pdfCurrency(invoiceData.total), totalsX, y, { align: "right" });

  // 6. Notes Footer
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

  // Final Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Powered by AutoVet Systems", pageW / 2, pageH - 10, { align: "center" });

  doc.save(`Invoice_${invoiceData.invoice_number || "VB-2026-000"}.pdf`);
}

function BillingInvoiceView() {
  const toast = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [discountVal, setDiscountVal] = useState(0);
  const [discountType, setDiscountType] = useState("percentage");

  const [owners, setOwners] = useState([]);
  const [pets, setPets] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");

  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientDetails, setPatientDetails] = useState(null);
  const [clinicSettings, setClinicSettings] = useState(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Draft");
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const [services, setServices] = useState([]);

  const [inventory, setInventory] = useState([]);
  const [weightRanges, setWeightRanges] = useState([]);

  useEffect(() => {
    if (!user?.token) return;

    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${user.token}`
    };

    // Fetch owners, pets, and settings on mount
    Promise.all([
      fetch("/api/owners", { headers }).then(res => res.json()).catch(() => ({ error: "Fetch failed" })),
      fetch("/api/pets", { headers }).then(res => res.json()).catch(() => ({ error: "Fetch failed" })),
      fetch("/api/settings", { headers }).then(res => res.json()).catch(() => ({})),
      fetch("/api/services", { headers }).then(res => res.json()).catch(() => []),
      fetch("/api/inventory", { headers }).then(res => res.json()).catch(() => [])
    ])
      .then(([ownersData, petsData, settingsData, servicesData, inventoryData]) => {
        // Robustness: Only set array state if data is an array, else log payload
        if (!Array.isArray(ownersData)) {
          console.error("Unexpected owners API response:", ownersData);
          setOwners([]);
        } else {
          setOwners(ownersData);
        }

        if (!Array.isArray(petsData)) {
          console.error("Unexpected pets API response:", petsData);
          setPets([]);
        } else {
          setPets(petsData);
        }

        setClinicSettings(settingsData);
        setNotes(settingsData?.invoice_notes_template || "");
        setServices(Array.isArray(servicesData) ? servicesData : []);
        setInventory(Array.isArray(inventoryData) ? inventoryData : []);
      })
      .catch((err) => {
        console.error("Critical fail in Billing initialization:", err);
        toast.error("Failed to load initial billing data.");
      });

    fetch("/api/weight-ranges", { headers })
      .then(res => res.json())
      .then(data => {
        const ranges = data.data || data;
        if (!Array.isArray(ranges)) {
          console.error("Unexpected weight-ranges response:", data);
          setWeightRanges([]);
        } else {
          setWeightRanges(ranges);
        }
      })
      .catch(err => {
        console.error("Weight ranges fetch error:", err);
        setWeightRanges([]);
      });
  }, [user?.token]);

  const handlePatientSelect = (e) => {
    const pId = e.target.value;
    setSelectedPatientId(pId);
    if (!pId) {
      setPatientDetails(null);
      return;
    }
    const patientData = (Array.isArray(pets) ? pets : []).find(p => p.id.toString() === pId.toString());
    const ownerData = patientData?.owner;

    // Simply use the raw patient data, the UI will access nested properties
    setPatientDetails(patientData);

    // Auto replace placeholders in the notes if clinic template is present
    if (clinicSettings && clinicSettings.invoice_notes_template) {
      let template = clinicSettings.invoice_notes_template;
      template = template.replace(/{clinic_name}/g, clinicSettings.clinic_name || "");
      template = template.replace(/{pet_name}/g, patientData.name || "");
      template = template.replace(/{owner_name}/g, patientData.owner?.name || "");
      setNotes(template);
    }
  };

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);

  // Real-time discount calculations safely capping out at subtotal
  const discountAmount = useMemo(() => {
    let amt = 0;
    if (discountType === "percentage") {
      amt = subtotal * ((discountVal || 0) / 100);
    } else {
      amt = discountVal || 0;
    }
    return amt > subtotal ? subtotal : amt;
  }, [subtotal, discountVal, discountType]);

  const taxable = useMemo(() => subtotal - discountAmount, [subtotal, discountAmount]);
  const taxAmount = useMemo(() => taxable * 0.12, [taxable]);
  const totalDue = useMemo(() => taxable + taxAmount, [taxable, taxAmount]);

  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("");

  const [serviceInput, setServiceInput] = useState("");
  const [qtyInput, setQtyInput] = useState(1);
  const [priceInput, setPriceInput] = useState(50);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  const groupedItems = useMemo(() => {
    const term = serviceInput.toLowerCase();
    
    const filteredServices = (Array.isArray(services) ? services : []).filter(s => 
      s.name.toLowerCase().includes(term) || 
      (s.category && s.category.toLowerCase().includes(term))
    ).map(s => ({ ...s, type: 'service' }));

    const filteredInventory = (Array.isArray(inventory) ? inventory : []).filter(i => 
      i.is_billable && (
        i.item_name.toLowerCase().includes(term) || 
        i.sku?.toLowerCase().includes(term) ||
        i.category?.toLowerCase().includes(term)
      )
    ).map(i => ({ ...i, name: i.item_name, price: i.selling_price, type: 'inventory' }));

    const all = [...filteredServices, ...filteredInventory];

    return all.reduce((acc, item) => {
      const cat = item.type === 'service' ? (item.category || "Services") : (item.category || "Products");
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [services, inventory, serviceInput]);

  const calculateDynamicPrice = (service) => {
    if (service.pricing_type === "size_based" && patientDetails?.size_category_id) {
      const rule = service.pricing_rules?.find(r => r.basis_type === 'size' && r.reference_id === patientDetails.size_category_id);
      if (rule) return Number(rule.price);
    }
    
    if (service.pricing_type === "weight_based" && patientDetails?.weight !== null) {
      const petWeight = Number(patientDetails.weight);
      const range = weightRanges.find(r => 
        Number(r.min_weight) <= petWeight && 
        (r.max_weight === null || Number(r.max_weight) >= petWeight)
      );
      if (range) {
        const rule = service.pricing_rules?.find(r => r.basis_type === 'weight' && r.reference_id === range.id);
        if (rule) return Number(rule.price);
      }
    }

    return Number(service.base_price || service.price) || 0;
  };

  const selectItemFromDropdown = (item) => {
    setServiceInput(item.name);
    if (item.type === 'service') {
      setPriceInput(calculateDynamicPrice(item));
    } else {
      setPriceInput(item.selling_price || item.price || 0);
    }
    setSelectedService(item);
    setIsDropdownOpen(false);
  };

  const handleServiceChange = (e) => {
    const val = e.target.value;
    setServiceInput(val);
    setIsDropdownOpen(true);
    
    // Check services first
    const matchedService = services.find(s => s.name.toLowerCase() === val.toLowerCase());
    if (matchedService) {
      setPriceInput(calculateDynamicPrice(matchedService));
      setSelectedService({ ...matchedService, type: 'service' });
      return;
    }

    // Check inventory
    const matchedInv = inventory.find(i => i.item_name.toLowerCase() === val.toLowerCase() && i.is_billable);
    if (matchedInv) {
      setPriceInput(matchedInv.selling_price || 0);
      setSelectedService({ ...matchedInv, name: matchedInv.item_name, type: 'inventory' });
      return;
    }

    setSelectedService(null);
  };


  const manuallyAddItem = () => {
    if (!serviceInput) return;
    const price = Number(priceInput) || 0;
    const qty = Number(qtyInput) || 1;
    
    let itemName = serviceInput;
    let itemType = selectedService?.type || 'service';
    let serviceId = itemType === 'service' ? selectedService?.id : null;
    let inventoryId = itemType === 'inventory' ? selectedService?.id : null;

    if (itemType === 'service' && selectedService?.pricing_type === "size_based" && patientDetails?.size_category_id) {
       itemName = `${serviceInput} (${patientDetails.size_category?.name || 'Selected Size'})`;
    } else if (itemType === 'service' && selectedService?.pricing_type === "weight_based" && patientDetails?.weight !== null) {
       itemName = `${serviceInput} (${patientDetails.weight}kg)`;
    }
      
    const newItem = {
      id: `li-${Date.now()}`,
      name: itemName,
      item_type: itemType,
      service_id: serviceId,
      inventory_id: inventoryId,
      notes: itemType === 'inventory' ? "Inventory Product" : "Service",
      qty: qty,
      unitPrice: price,
      amount: price * qty,
      indicator: itemType === 'inventory' ? "bg-emerald-400" : "bg-blue-400",
    };
    setItems((prev) => [...prev, newItem]);
    setServiceInput("");
    setQtyInput(1);
    setPriceInput(50);
    setSelectedService(null);
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "qty" || field === "unitPrice") {
            updated.amount = Number(updated.qty || 0) * Number(updated.unitPrice || 0);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const resetForm = () => {
    setItems([]);
    setDiscountVal(0);
    setNotes(clinicSettings ? clinicSettings.invoice_notes_template || "" : "");
    setSelectedPatientId("");
    setPatientDetails(null);
    setStatus("Draft");
    setAmountPaid(0);
    setPaymentMethod("");
  };

  const submitInvoice = async (finalStatus) => {
    if (items.length === 0) {
      toast.error("Cannot save an invoice without items.");
      return;
    }
    if (!selectedPatientId) {
      toast.error("Please select a patient.");
      return;
    }

    // Determine status logic based on amount paid vs total
    let actualStatus = finalStatus;
    if (finalStatus === "Finalized" && amountPaid > 0) {
      if (amountPaid >= totalDue) {
        actualStatus = "Paid";
      } else {
        actualStatus = "Partially Paid";
      }
    }

    const payload = {
      pet_id: selectedPatientId,
      status: actualStatus,
      subtotal: subtotal,
      discount_type: discountType,
      discount_value: discountVal,
      tax_rate: 12.00,
      total: totalDue,
      amount_paid: amountPaid,
      payment_method: paymentMethod,
      notes_to_client: notes,
      items: items.map(item => ({
        item_type: item.item_type || 'service',
        service_id: item.service_id,
        inventory_id: item.inventory_id,
        name: item.name,
        notes: item.notes,
        qty: item.qty,
        unit_price: item.unitPrice,
        amount: item.amount
      }))
    };

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save invoice");
      }

      toast.success(`Invoice ${finalStatus === "Draft" ? "saved as draft" : "finalized"} successfully.`);

      if (finalStatus !== "Draft") {
        setStatus(actualStatus);
      } else {
        resetForm();
      }
    } catch (err) {
      toast.error(err.message || "Failed to save invoice");
      console.error(err);
    }
  };

  return (
    <div className="card-shell overflow-hidden p-0">
      <div className={clsx(
        "grid grid-cols-1 lg:h-[calc(100vh-11rem)]",
        isPreviewMode ? "lg:grid-cols-1" : "lg:grid-cols-[410px_1fr]"
      )}>
        {!isPreviewMode && (
          <aside className="flex h-full flex-col overflow-hidden border-b border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card lg:border-b-0 lg:border-r lg:border-slate-200 dark:border-dark-border">
            <div className="shrink-0 border-b border-slate-200 dark:border-dark-border p-5">
              <p className="text-sm text-slate-500 dark:text-zinc-400">Billing &gt; New Invoice</p>
              <div className="mt-2 flex items-center gap-3">
                <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">New Invoice</h2>
                <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  {status}
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">
              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">Patient Details</h3>
                <div className="space-y-3">
                  <div className="relative">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                    <select
                      value={selectedOwnerId}
                      onChange={(e) => {
                        setSelectedOwnerId(e.target.value);
                        setSelectedPatientId(""); // reset pet
                        setPatientDetails(null);
                      }}
                      className="h-11 w-full appearance-none rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface pl-10 pr-8 text-sm text-slate-700 dark:text-zinc-300 focus:outline-none"
                      disabled={status === "Finalized"}
                    >
                      <option value="">Select an owner...</option>
                      {owners.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                  </div>

                  <div className="relative">
                    <select
                      value={selectedPatientId}
                      onChange={handlePatientSelect}
                      disabled={!selectedOwnerId || status === "Finalized"}
                      className="h-11 w-full appearance-none rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface pl-4 pr-8 text-sm text-slate-700 dark:text-zinc-300 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">Select a pet...</option>
                      {(Array.isArray(pets) ? pets : []).filter(p => p.owner_id?.toString() === selectedOwnerId?.toString()).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.species?.name || "Unknown"}
                        </option>
                      ))}
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                  </div>

                  {patientDetails && (
                    <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-3 text-sm">
                      <p className="text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Owner:</strong> {patientDetails.owner?.name}</p>
                      <p className="text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Contact:</strong> {patientDetails.owner?.phone || "N/A"}</p>
                      <p className="text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Email:</strong> {patientDetails.owner?.email || "N/A"}</p>
                      <p className="text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Address:</strong> {
                        [patientDetails.owner?.address, patientDetails.owner?.city, patientDetails.owner?.province, patientDetails.owner?.zip_code].filter(Boolean).join(", ") || "N/A"
                      }</p>
                      <p className="mt-2 text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Species/Breed:</strong> {patientDetails.species?.name} {patientDetails.breed?.name ? `• ${patientDetails.breed?.name}` : ""}</p>
                      {patientDetails.date_of_birth && (
                        <p className="text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Age:</strong> {(() => {
                          const dob = new Date(patientDetails.date_of_birth);
                          const diff = Date.now() - dob.getTime();
                          const ageDate = new Date(diff);
                          return Math.abs(ageDate.getUTCFullYear() - 1970);
                        })()} yrs</p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">Services &amp; Meds</h3>


                <div className="grid grid-cols-[1fr_54px_80px_auto] gap-2 items-center">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search or add service..."
                      value={serviceInput}
                      onChange={handleServiceChange}
                      onFocus={() => setIsDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          manuallyAddItem();
                          setIsDropdownOpen(false);
                        }
                      }}
                      disabled={status === "Finalized"}
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 text-sm text-slate-700 dark:text-zinc-300 placeholder:text-slate-400 dark:text-zinc-500 disabled:opacity-50"
                    />
                    {isDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card p-2 shadow-lg z-50">
                        {Object.keys(groupedItems).length > 0 ? (
                          Object.entries(groupedItems).map(([category, svcs]) => (
                            <div key={category} className="mb-2 last:mb-0">
                              <div className="bg-slate-50 dark:bg-dark-surface px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 rounded-md">
                                {category}
                              </div>
                              <ul className="mt-1 space-y-1">
                                {svcs.map((item) => (
                                  <li key={`${item.type}-${item.id}`}>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => selectItemFromDropdown(item)}
                                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-dark-surface"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className={clsx(
                                          "h-1.5 w-1.5 rounded-full",
                                          item.type === 'inventory' ? "bg-emerald-500" : "bg-blue-500"
                                        )} />
                                        <span>{item.name}</span>
                                      </div>
                                      <span className="text-slate-400 dark:text-zinc-500">{currency(item.price)}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center text-sm text-slate-500 dark:text-zinc-400">
                            {services.length === 0 && inventory.length === 0 ? "No services or products found." : "No matching items."}
                          </div>
                        )}
                        {serviceInput && !services.find(s => s.name.toLowerCase() === serviceInput.toLowerCase()) && (
                           <div className="mt-2 border-t border-slate-100 dark:border-dark-border pt-2 text-center">
                              <p className="text-xs text-slate-500 mb-1 dark:text-zinc-500">Create new item</p>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { manuallyAddItem(); setIsDropdownOpen(false); }}
                                className="w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                              >
                                + Add &quot;{serviceInput}&quot;
                              </button>
                           </div>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    disabled={status === "Finalized"}
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-2 text-center text-sm text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                  />
                  <div className="relative w-full">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">₱</span>
                    <input
                      type="number"
                      min="0"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      disabled={status === "Finalized" || (selectedService && selectedService.pricing_mode !== "manual")}
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface pl-6 pr-2 text-sm text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { manuallyAddItem(); setIsDropdownOpen(false); }}
                    disabled={!serviceInput || status === "Finalized"}
                    className="h-11 w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-slate-900 dark:hover:bg-zinc-200"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {items.length > 0 ? items.map((item) => (
                    <article key={item.id} className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-zinc-50">
                            <span className={`inline-block h-2 w-2 rounded-full ${item.indicator}`} />
                            {item.name}
                            <span className={clsx(
                              "ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded-md font-bold",
                              item.item_type === 'inventory' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {item.item_type === 'inventory' ? 'Product' : 'Service'}
                            </span>
                          </p>
                          <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">{item.notes}</p>
                        </div>
                        <p className="text-2xl font-semibold text-slate-900 dark:text-zinc-50">{currency(item.amount)}</p>
                      </div>

                      {item.warning ? (
                        <span className="mt-2 inline-block rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          {item.warning}
                        </span>
                      ) : null}
                    </article>
                  )) : (
                    <p className="pt-4 text-center text-sm text-slate-400">No items added yet.</p>
                  )}
                </div>
              </section>
            </div>

            <div className="shrink-0 space-y-4 border-t border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-5 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]">
              <section className="space-y-3">
                {/* Tax and Discount removed as per user request */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Note to Client</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={status === "Finalized"}
                    placeholder="Visible on the invoice..."
                    className="w-full rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-700 dark:text-zinc-300 placeholder:text-slate-400 dark:text-zinc-500 disabled:opacity-50 focus:outline-none"
                  />
                </div>
              </section>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={resetForm}
                  className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-dark-card px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => submitInvoice("Draft")}
                  disabled={status !== "Draft"}
                  className="rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-50 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  Save Draft
                </button>
              </div>
            </div>
          </aside>
        )}

        <section className="flex h-full flex-col overflow-hidden bg-slate-100 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card px-5 py-3 shrink-0">
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-zinc-400">
              <button 
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className={clsx(
                  "inline-flex items-center gap-2 font-semibold transition-colors px-3 py-1.5 rounded-lg",
                  isPreviewMode ? "bg-blue-600 text-white" : "text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-dark-surface"
                )}
              >
                <FiEye className="h-4 w-4" />
                {isPreviewMode ? "Exit Preview" : "Preview Mode"}
              </button>
              <span>Invoice Status: <b className="text-slate-700 dark:text-slate-300">{status}</b></span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="rounded-lg p-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-dark-surface dark:bg-zinc-950"
              >
                <FiPrinter className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (items.length === 0) {
                    toast.error("Add items before downloading PDF.");
                    return;
                  }
                  const invoiceData = {
                    invoice_number: "DRAFT-" + Date.now(),
                    subtotal,
                    tax_rate: 12.00,
                    discount_value: discountVal,
                    discount_type: discountType,
                    total: totalDue,
                    notes_to_client: notes,
                    items: items
                  };
                  generateInvoicePDF(invoiceData, patientDetails, clinicSettings);
                }}
                className="rounded-lg p-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-dark-surface dark:bg-zinc-950"
              >
                <FiDownload className="h-4 w-4" />
              </button>
              <button
                onClick={() => submitInvoice("Finalized")}
                disabled={status !== "Draft"}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <FiSend className="h-4 w-4" />
                Finalize &amp; Send
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 text-left">
            <article className="mx-auto max-w-4xl rounded-sm bg-white dark:bg-dark-card p-6 sm:p-8 md:p-12 shadow-md printable-invoice">
              <header className="flex flex-row items-start justify-between gap-4 sm:gap-6">
                <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                  <p className="inline-flex items-center gap-2.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
                    {clinicSettings?.clinic_logo ? (
                      <img src={clinicSettings.clinic_logo} alt="Logo" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0">
                        <LuPawPrint className="h-4 w-4" />
                      </span>
                    )}
                    <span className="truncate">{clinicSettings?.clinic_name || "AutoVet Clinic"}</span>
                  </p>
                  <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-zinc-400 truncate whitespace-normal">
                    {clinicSettings?.address && (
                      <p className="mb-0.5">{clinicSettings.address}</p>
                    )}
                    {(clinicSettings?.primary_email || clinicSettings?.phone_number) && (
                      <p className="mb-0.5">
                        {[clinicSettings.phone_number, clinicSettings.primary_email].filter(Boolean).join(" • ")}
                      </p>
                    )}
                    {clinicSettings?.clinic_tax_id && <p>Tax ID: {clinicSettings.clinic_tax_id}</p>}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-3xl font-light tracking-wide text-slate-300 dark:text-zinc-600">INVOICE</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-700 dark:text-zinc-300">#VB-{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}-0000</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Date: {new Date().toLocaleDateString()}</p>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">Due: Upon Receipt</p>
                </div>
              </header>

              <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Bill To</p>
                  {patientDetails ? (
                    <>
                      <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-50">{patientDetails?.owner?.name || "Guest Client"}</p>
                      <div className="mt-2 space-y-1 text-sm text-slate-500 dark:text-zinc-400">
                        <p>{patientDetails?.owner?.address || "No address provided"}</p>
                        <p>{patientDetails?.owner?.email}</p>
                        <p>{patientDetails?.owner?.phone}</p>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400 dark:text-zinc-500 italic">No patient selected</p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Patient</p>
                  {patientDetails ? (
                    <div className="mt-2 flex items-center gap-3">
                      <img
                        src={patientDetails.photo ? getActualPetImageUrl(patientDetails.photo) : getPetImageUrl(patientDetails.species?.name, patientDetails.breed?.name)}
                        alt={patientDetails.name}
                        className="h-10 w-10 rounded-full object-cover bg-slate-100 dark:bg-zinc-800"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-zinc-50">{patientDetails.name}</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {patientDetails?.species?.name || "Unknown"} • {patientDetails?.breed?.name || "Unknown"}
                          {patientDetails.date_of_birth && ` • ${(() => {
                            const dob = new Date(patientDetails.date_of_birth);
                            const diff = Date.now() - dob.getTime();
                            const ageDate = new Date(diff);
                            return Math.abs(ageDate.getUTCFullYear() - 1970);
                          })()} yrs`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400 dark:text-zinc-500 italic">Select to view pet details</p>
                  )}
                </div>
              </section>

              <section className="mt-8 border-y border-slate-200 dark:border-dark-border py-3">
                <div className="grid grid-cols-[1fr_60px_100px_100px] text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  <p>Description</p>
                  <p className="text-right">Qty</p>
                  <p className="text-right">Unit Price</p>
                  <p className="text-right">Amount</p>
                </div>

                <div className="mt-3 space-y-3">
                  {items.map((item) => (
                    <div key={`doc-${item.id}`} className="grid grid-cols-[1fr_60px_100px_100px] items-start gap-2 border-b border-slate-100 dark:border-dark-border pb-3 last:border-0 last:pb-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-zinc-50">{item.name}</p>
                          <span className={clsx(
                            "text-[8px] uppercase px-1 rounded-sm font-bold border",
                            item.item_type === 'inventory' ? "border-emerald-200 text-emerald-600 bg-emerald-50" : "border-blue-200 text-blue-600 bg-blue-50"
                          )}>
                            {item.item_type === 'inventory' ? 'PROD' : 'SERV'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">{item.notes}</p>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateItem(item.id, "qty", e.target.value)}
                        disabled={status !== "Draft"}
                        className="w-full bg-transparent text-right text-sm text-slate-700 focus:outline-none focus:border-b focus:border-blue-500 disabled:opacity-50 dark:text-zinc-300"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                        disabled={status !== "Draft"}
                        className="w-full bg-transparent text-right text-sm text-slate-700 focus:outline-none focus:border-b focus:border-blue-500 disabled:opacity-50 dark:text-zinc-300"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <p className="text-right text-sm font-semibold text-slate-900 dark:text-zinc-50">{currency(item.amount)}</p>
                        {status === "Draft" && (
                          <button onClick={() => removeItem(item.id)} className="text-rose-400 hover:text-rose-600 dark:text-rose-500 dark:hover:text-rose-300">
                            <span className="text-[10px] font-bold leading-none">✕</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                     <p className="py-4 text-center text-sm text-slate-400 dark:text-zinc-500 italic">No line items added yet.</p>
                  )}
                </div>
              </section>

              <section className="mt-6 ml-auto w-full max-w-sm space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-zinc-300">
                  <span>Subtotal</span>
                  <span>{currency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-zinc-300">
                  <span>VAT (12%)</span>
                  <span>{currency(taxAmount)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 dark:border-dark-border pt-3">
                  <span className="text-lg font-bold text-slate-900 dark:text-zinc-50">Total Due</span>
                  <span className="text-2xl font-bold text-blue-600">{currency(totalDue)}</span>
                </div>

                <div className="mt-6 border-t border-slate-200 dark:border-dark-border pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">Record Payment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      disabled={status !== "Draft"}
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 text-sm text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                    >
                      <option value="">Select Method...</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 text-sm">₱</span>
                      <input
                        type="number"
                        min="0"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(Number(e.target.value))}
                        disabled={status !== "Draft"}
                        placeholder="Amount Paid"
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface pl-7 pr-3 text-sm text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <footer className="mt-12 border-t border-slate-200 dark:border-dark-border pt-6">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Notes to Client</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-300 whitespace-pre-wrap">
                  {notes || "No additional notes provided."}
                </p>
                <p className="mt-8 text-center text-xs text-slate-400 dark:text-zinc-500">Powered by AutoVet Systems</p>
              </footer>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}

export default BillingInvoiceView;
