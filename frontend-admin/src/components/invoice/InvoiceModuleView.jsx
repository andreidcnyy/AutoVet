import { useMemo, useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import {
  FiCalendar,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiCreditCard,
  FiDownload,
  FiEye,
  FiPlusCircle,
  FiPrinter,
  FiSearch,
  FiSend,
  FiBell,
  FiX,
  FiAlertTriangle,
  FiCheck,
} from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useFormErrors } from "../../hooks/useFormErrors";
import { getPetImageUrl, getActualPetImageUrl } from "../../utils/petImages";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ManualSendModal from "../notifications/ManualSendModal";
import api from "../../api";

const currency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
const pdfCurrency = (value) => "P " + (value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Converts an image URL to a base64 data URI.
 */
async function getBase64ImageFromUrl(imageUrl) {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject("Failed to convert image to base64");
    reader.readAsDataURL(blob);
  });
}

const formatDate = (date) => {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch (e) {
    return "N/A";
  }
};

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
  doc.setTextColor(30, 41, 59); // zinc-800 (Dark)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(clinic?.clinic_name || "AutoVet Clinic", 34, y + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // zinc-500
  doc.text(clinic?.address || "", 34, y + 13);
  doc.text([clinic?.phone_number, clinic?.primary_email].filter(Boolean).join(" • "), 34, y + 17);

  // Invoice/Receipt Title (Right Aligned)
  const isPaid = invoiceData.status === 'Paid' || (invoiceData.amount_paid >= invoiceData.total && invoiceData.total > 0);
  const docTitle = isPaid ? "RECEIPT" : "INVOICE";

  doc.setTextColor(203, 213, 225); // Light zinc
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(docTitle, pageW - 14, y + 10, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`${isPaid ? 'Receipt' : 'Invoice'} #${invoiceData.invoice_number || "VB-2026-000"}`, pageW - 14, y + 18, { align: "right" });
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${invoiceData.created_at ? new Date(invoiceData.created_at).toLocaleDateString() : new Date().toLocaleDateString()}`, pageW - 14, y + 23, { align: "right" });

  if (isPaid) {
    doc.text(`Payment: ${invoiceData.payment_method || 'Cash'}`, pageW - 14, y + 28, { align: "right" });
  } else {
    doc.text(`Due: Upon Receipt`, pageW - 14, y + 28, { align: "right" });
  }

  y = 55;

  // 3. Invoice Sections
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
  doc.setFillColor(248, 250, 252); // zinc-50 (Very light gray)
  doc.roundedRect(patientCardX - 4, y - 4, 90, 32, 4, 4, "F");

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PATIENT", patientCardX, y + 2);

  if (patient) {
    const photoUrl = patient.photo ? getActualPetImageUrl(patient.photo) : getPetImageUrl(patient.species?.name, patient.breed?.name);
    if (photoUrl && !photoUrl.endsWith(".svg")) {
      try {
        const base64 = await getBase64ImageFromUrl(photoUrl);
        doc.addImage(base64, 'JPEG', patientCardX, y + 5, 10, 10);
      } catch (e) {
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
    body: invoiceData.items.filter(item => !item.is_hidden).map(item => [
      item.name.toUpperCase() + (item.notes ? "\n" + item.notes : ""),
      item.qty,
      (item.unitPrice || item.unit_price || 0).toFixed(2),
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

  doc.save(`${docTitle}_${invoiceData.invoice_number || "VB-2026-000"}.pdf`);
}

function InvoiceModuleView() {
  const toast = useToast();
  const { user } = useAuth();
  const { setLaravelErrors, clearErrors, getError } = useFormErrors();

  const [activeTab, setActiveTab] = useState("new"); // "new" or "history"
  const [invoices, setInvoices] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    perPage: 10
  });

  const [items, setItems] = useState([]);
  const [discountVal, setDiscountVal] = useState(0);
  const [discountType, setDiscountType] = useState("percentage");

  const [owners, setOwners] = useState([]);
  const [pets, setPets] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");

  const [selectedPatientId, setSelectedPatientId] = useState("");

  // New state for appointments and selected appointment
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [patientDetails, setPatientDetails] = useState(null);
  const [clinicSettings, setClinicSettings] = useState(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Draft");
  const [invoiceId, setInvoiceId] = useState(null);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [appointmentSearch, setAppointmentSearch] = useState("");

  const [currentWeight, setCurrentWeight] = useState("");

  const [services, setServices] = useState([]);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  const [inventory, setInventory] = useState([]);
  const [weightRanges, setWeightRanges] = useState([]);

  const INVOICES_CACHE_KEY = 'invoices_history_cache';
  const FORM_DATA_CACHE_KEY = 'invoices_form_data_minimal_cache';
  const CACHE_TTL = 5 * 60 * 1000;

  const fetchInvoices = useCallback(async (page = 1, search = searchQuery, signal = null) => {
    if (!user?.token) return;
    setHistoryLoading(true);

    // Show cached data instantly for default view (page 1, no search)
    if (page === 1 && !search) {
      try {
        const cached = JSON.parse(localStorage.getItem(INVOICES_CACHE_KEY) || 'null');
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
          setInvoices(cached.invoices);
          setPagination(cached.pagination);
          setHistoryLoading(false);
        }
      } catch (_) {}
    }

    try {
      const response = await fetch(`/api/invoices?per_page=10&page=${page}&search=${encodeURIComponent(search)}`, {
        signal,
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user.token}`
        }
      });
      const data = await response.json();

      if (data.data) {
        setInvoices(data.data);
        const newPagination = {
          currentPage: data.current_page,
          lastPage: data.last_page,
          total: data.total,
          perPage: data.per_page
        };
        setPagination(newPagination);
        if (page === 1 && !search) {
          try { localStorage.setItem(INVOICES_CACHE_KEY, JSON.stringify({ invoices: data.data, pagination: newPagination, ts: Date.now() })); } catch (_) {}
        }
      } else {
        setInvoices(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Failed to fetch invoices:", err);
      toast.error("Failed to load invoice history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.token, searchQuery]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchInvoices(pagination.currentPage);
    }
  }, [activeTab, user?.token]);

  // Debounced search effect
  useEffect(() => {
    if (activeTab !== "history") return;

    const controller = new AbortController();
    const handler = setTimeout(() => {
      fetchInvoices(1, searchQuery, controller.signal); // Always reset to page 1 on search
    }, 500);

    return () => {
      clearTimeout(handler);
      controller.abort();
    };
  }, [searchQuery]);

  const filteredAppointments = useMemo(() => {
    if (!appointmentSearch) return appointments;
    const term = appointmentSearch.toLowerCase();
    return appointments.filter(appt => {
      const formatted = formatDate(appt.date).toLowerCase();
      const rawDate = appt.date.toLowerCase();
      const title = (appt.title || "").toLowerCase();
      const serviceName = (appt.service?.name || "").toLowerCase();

      return formatted.includes(term) ||
        rawDate.includes(term) ||
        title.includes(term) ||
        serviceName.includes(term);
    });
  }, [appointments, appointmentSearch]);

  useEffect(() => {
    if (!user?.token) return;

    // Show cached form data instantly
    try {
      const cached = JSON.parse(localStorage.getItem(FORM_DATA_CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        if (Array.isArray(cached.owners)) setOwners(cached.owners);
        if (Array.isArray(cached.pets)) setPets(cached.pets);
        if (Array.isArray(cached.services)) setServices(cached.services);
        if (Array.isArray(cached.inventory)) setInventory(cached.inventory);
        if (Array.isArray(cached.weightRanges)) setWeightRanges(cached.weightRanges);
        if (cached.settings) { setClinicSettings(cached.settings); setNotes(cached.settings?.invoice_notes_template || ""); }
      }
    } catch (_) {}

    const controller = new AbortController();

    Promise.all([
      api.get('/api/owners', { params: { minimal: 1 }, signal: controller.signal }).catch(() => ({ error: "Fetch failed" })),
      api.get('/api/pets', { params: { minimal: 1 }, signal: controller.signal }).catch(() => ({ error: "Fetch failed" })),
      api.get('/api/settings', { signal: controller.signal }).catch(() => ({})),
      api.get('/api/services', { signal: controller.signal }).catch(() => []),
      api.get('/api/inventory', { signal: controller.signal }).catch(() => []),
    ])
      .then(([ownersData, petsData, settingsData, servicesData, inventoryData]) => {
        const owners = Array.isArray(ownersData) ? ownersData : [];
        const pets = Array.isArray(petsData) ? petsData : [];
        const services = Array.isArray(servicesData) ? servicesData : [];
        const inventory = Array.isArray(inventoryData) ? inventoryData : [];

        if (!Array.isArray(ownersData)) console.error("Unexpected owners API response:", ownersData);
        if (!Array.isArray(petsData)) console.error("Unexpected pets API response:", petsData);

        setOwners(owners);
        setPets(pets);
        setClinicSettings(settingsData);
        setNotes(settingsData?.invoice_notes_template || "");
        setServices(services);
        setInventory(inventory);

        try {
          localStorage.setItem(FORM_DATA_CACHE_KEY, JSON.stringify({ owners, pets, services, inventory, settings: settingsData, ts: Date.now() }));
        } catch (_) {}
      })
      .catch((err) => {
        if (err.name === 'AbortError' || err.name === 'CanceledError') return;
        console.error("Critical fail in Invoice initialization:", err);
        toast.error("Failed to load initial invoice data.");
      });

    api.get("/api/weight-ranges", { signal: controller.signal })
      .then(data => {
        const ranges = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        if (!ranges.length) console.error("Unexpected weight-ranges response:", data);
        setWeightRanges(ranges);
        try {
          const cached = JSON.parse(localStorage.getItem(FORM_DATA_CACHE_KEY) || 'null');
          if (cached) localStorage.setItem(FORM_DATA_CACHE_KEY, JSON.stringify({ ...cached, weightRanges: ranges, ts: Date.now() }));
        } catch (_) {}
      })
      .catch(err => {
        if (err.name === 'AbortError' || err.name === 'CanceledError') return;
        console.error("Weight ranges fetch error:", err);
        setWeightRanges([]);
      });

    return () => controller.abort();
  }, [user?.token]);

  const handlePatientSelect = (e) => {
    const pId = e.target.value;
    setSelectedPatientId(pId);
    setSelectedAppointmentId(""); // reset appointment selection
    if (!pId) {
      setPatientDetails(null);
      setAppointments([]);
      return;
    }
    const patientData = (Array.isArray(pets) ? pets : []).find(p => p.id.toString() === pId.toString());

    // Simply use the raw patient data, the UI will access nested properties
    setPatientDetails(patientData);
    setCurrentWeight(patientData?.weight || "");

    // Fetch appointments for this patient (stale-while-revalidate)
    const apptCacheKey = `invoice_appts_pet_${pId}`;
    try {
      const cached = JSON.parse(localStorage.getItem(apptCacheKey) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_TTL && Array.isArray(cached.data)) {
        setAppointments(cached.data);
      }
    } catch (_) {}

    const sortAppts = (appts) => {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      return [...appts].sort((a, b) => {
        const dA = new Date(a.date); dA.setHours(0, 0, 0, 0);
        const dB = new Date(b.date); dB.setHours(0, 0, 0, 0);
        const pA = dA < now, pB = dB < now;
        if (pA && !pB) return 1; if (!pA && pB) return -1;
        if (!pA && !pB) return dA - dB;
        return dB - dA;
      });
    };

    fetch(`/api/appointments?pet_id=${pId}`, {
      headers: { "Accept": "application/json", "Authorization": `Bearer ${user?.token}` }
    })
      .then(res => res.json())
      .then(data => {
        const sorted = sortAppts(Array.isArray(data) ? data : []);
        setAppointments(sorted);
        try { localStorage.setItem(apptCacheKey, JSON.stringify({ data: sorted, ts: Date.now() })); } catch (_) {}
      })
      .catch(err => {
        console.error("Failed to load appointments", err);
        setAppointments([]);
      });

    // Auto replace placeholders in the notes if clinic template is present
    if (clinicSettings && clinicSettings.invoice_notes_template) {
      let template = clinicSettings.invoice_notes_template;
      template = template.replace(/{clinic_name}/g, clinicSettings.clinic_name || "");
      template = template.replace(/{pet_name}/g, patientData.name || "");
      template = template.replace(/{owner_name}/g, patientData.owner?.name || "");
      setNotes(template);
    }
  };

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (item.is_hidden ? 0 : item.amount), 0), [items]);

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
  const [isApptDropdownOpen, setIsApptDropdownOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  const groupedItems = useMemo(() => {
    const term = serviceInput.toLowerCase();

    const filteredServices = (Array.isArray(services) ? services : []).filter(s =>
      s.name.toLowerCase().includes(term) ||
      (s.category && s.category.toLowerCase().includes(term))
    ).map(s => ({ ...s, type: 'service' }));

    const filteredInventory = (Array.isArray(inventory) ? inventory : []).filter(i =>
      i.item_name.toLowerCase().includes(term) ||
      i.sku?.toLowerCase().includes(term) ||
      i.code?.toLowerCase().includes(term) ||
      i.category?.toLowerCase().includes(term)
    ).map(i => ({
      ...i,
      name: i.item_name,
      sku: i.sku || i.code || "N/A",
      price: i.selling_price || 0,
      stock: i.stock_level || 0,
      type: 'inventory'
    }));

    const all = [...filteredServices, ...filteredInventory];

    return all.reduce((acc, item) => {
      const cat = item.type === 'service' ? (item.category || "Services") : (item.category || "Inventory Products");
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

    if (service.pricing_type === "weight_based" && currentWeight !== "") {
      const petWeight = Number(currentWeight);
      const petSpeciesId = patientDetails?.species_id;

      const range = weightRanges.find(r =>
        (Number(r.species_id) === Number(petSpeciesId)) &&
        Number(r.min_weight) <= petWeight &&
        (r.max_weight === null || Number(r.max_weight) >= petWeight)
      );

      if (range && range.size_category_id) {
        // NEW mapping: weight_based rules now use basis_type 'size' and the size_category_id from the range
        const rule = service.pricing_rules?.find(r => r.basis_type === 'size' && r.reference_id === range.size_category_id);
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
    const matchedInv = inventory.find(i => i.item_name.toLowerCase() === val.toLowerCase());
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
    let inventoryId = itemType === 'inventory' ? (selectedService?.id || selectedService?.inventory_id) : null;
    let itemSku = selectedService?.sku || selectedService?.code || "";

    // Stock Validation for inventory items
    if (itemType === 'inventory' && selectedService) {
      const availableStock = selectedService.stock_level || selectedService.stock || 0;
      if (qty > availableStock) {
        toast.warning(`${qty} units of '${itemName}' requested, but only ${availableStock} in stock. Proceeding anyway...`, {
          duration: 5000,
          icon: '⚠️'
        });
      }
    }

    if (itemType === 'service' && selectedService?.pricing_type === "size_based" && patientDetails?.size_category_id) {
      itemName = `${serviceInput} (${patientDetails.size_category?.name || 'Selected Size'})`;
    } else if (itemType === 'service' && selectedService?.pricing_type === "weight_based" && currentWeight !== "") {
      itemName = `${serviceInput} (${currentWeight}kg)`;
    }

    const newItem = {
      id: `li-${Date.now()}`,
      name: itemName,
      sku: itemSku,
      item_type: itemType,
      service_id: serviceId,
      inventory_id: inventoryId,
      notes: itemType === 'inventory' ? `Product [${itemSku || 'N/A'}]` : "Service",
      qty: qty,
      unitPrice: price,
      amount: price * qty,
      indicator: itemType === 'inventory' ? "bg-amber-400" : "bg-emerald-400",
    };
    setItems((prev) => [...prev, newItem]);

    // Clean up
    setServiceInput("");
    setQtyInput(1);
    setPriceInput(0);
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
    setSelectedOwnerId("");
    setSelectedPatientId("");
    setSelectedAppointmentId("");
    setPatientDetails(null);
    setStatus("Draft");
    setAmountPaid(0);
    setPaymentMethod("");
    setInvoiceId(null);
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
      appointment_id: selectedAppointmentId || null,
      pet_weight: currentWeight || null,
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
        amount: item.amount,
        is_hidden: !!item.is_hidden
      }))
    };
    if (!selectedAppointmentId) {
      toast.error("Please select an appointment for this invoice.");
      return;
    }

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

      clearErrors();

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 422) {
          setLaravelErrors(errorData);
          toast.error("Validation error. Please check specified fields.");
        } else {
          const detail = errorData.error || errorData.message || "Failed to save invoice";
          throw new Error(detail);
        }
        return;
      }

      const result = await response.json();
      toast.success(`Invoice ${finalStatus === "Draft" ? "saved as draft" : "finalized"} successfully.`);

      if (finalStatus !== "Draft") {
        setStatus(actualStatus);
        setInvoiceId(result.id);

        // Visibility sequence for AI workflow defense
        setTimeout(() => toast.info("Analyzing AI Inventory Impact...", 3000), 1000);

        // Broadcast event for dashboard listeners
        window.dispatchEvent(new CustomEvent('inventory-forecast-refresh'));
      } else {
        resetForm();
      }
    } catch (err) {
      toast.error(err.message || "Failed to save invoice");
      console.error(err);
    }
  };

  const handleRecordPaymentUpdate = async () => {
    if (!invoiceId) return;
    if (!paymentMethod) {
      toast.error("Please select a payment method.");
      return;
    }
    if (amountPaid <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    setIsRecordingPayment(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          status: "Finalized", // Controller will auto-promote to Paid/Partially Paid
          amount_paid: amountPaid,
          payment_method: paymentMethod,
          subtotal: subtotal,
          discount_type: discountType,
          discount_value: discountVal,
          tax_rate: 12.00,
          total: totalDue
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to record payment");
      }

      const updated = await response.json();
      setStatus(updated.status);
      setAmountPaid(updated.amount_paid);
      toast.success("Payment recorded successfully!");

      // Refresh history list if needed
      fetchInvoices(pagination.currentPage);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const Pagination = () => {
    if (pagination.lastPage <= 1) return null;
    return (
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-6 py-4 mb-6 dark:border-dark-border dark:bg-dark-card shadow-sm">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          Showing <span className="text-zinc-900 dark:text-zinc-50">{Math.min((pagination.currentPage - 1) * pagination.perPage + 1, pagination.total)}-{Math.min(pagination.currentPage * pagination.perPage, pagination.total)}</span> of <span className="text-zinc-900 dark:text-zinc-50">{pagination.total}</span> invoices
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchInvoices(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-surface shadow-sm"
          >
            <FiChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-1.5">
            {[...Array(pagination.lastPage)].map((_, i) => {
              const pageNum = i + 1;
              // Simple logic to show current page and a few around it
              if (
                pagination.lastPage > 7 &&
                pageNum !== 1 &&
                pageNum !== pagination.lastPage &&
                (pageNum < pagination.currentPage - 1 || pageNum > pagination.currentPage + 1)
              ) {
                if (pageNum === pagination.currentPage - 2 || pageNum === pagination.currentPage + 2) {
                  return <span key={pageNum} className="px-1 text-zinc-400">...</span>;
                }
                return null;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => fetchInvoices(pageNum)}
                  className={clsx(
                    "flex h-10 w-10 items-center justify-center rounded-xl text-xs font-black transition-all",
                    pagination.currentPage === pageNum
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-110"
                      : "border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 dark:border-dark-border dark:bg-dark-card"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => fetchInvoices(pagination.currentPage + 1)}
            disabled={pagination.currentPage === pagination.lastPage}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-surface shadow-sm"
          >
            <FiChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-card rounded-2xl overflow-hidden shadow-sm border border-zinc-200 dark:border-dark-border">
      {/* Tab Switcher */}
      <div className="flex items-center gap-4 border-b border-zinc-200 dark:border-dark-border px-6 py-4 bg-zinc-50/50 dark:bg-dark-surface/30">
        <button
          onClick={() => setActiveTab("new")}
          className={clsx(
            "px-4 py-2 rounded-xl text-sm font-bold transition-all",
            activeTab === "new"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-lg shadow-zinc-900/10 dark:shadow-none"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          )}
        >
          New Invoice
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={clsx(
            "px-4 py-2 rounded-xl text-sm font-bold transition-all",
            activeTab === "history"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-lg shadow-zinc-900/10 dark:shadow-none"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          )}
        >
          Invoice History
        </button>
      </div>

      {activeTab === "new" ? (
        <div className={clsx(
          "grid grid-cols-1 lg:h-[calc(100vh-16rem)]",
          isPreviewMode ? "lg:grid-cols-1" : "lg:grid-cols-[410px_1fr]"
        )}>
          {!isPreviewMode && (
            <aside className="flex h-full flex-col overflow-hidden border-b border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card lg:border-b-0 lg:border-r lg:border-zinc-200 dark:border-dark-border">
              <div className="shrink-0 border-b border-zinc-200 dark:border-dark-border p-5">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Invoice &gt; New Invoice</p>
                <div className="mt-2 flex items-center gap-3">
                  <h2 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">New Invoice</h2>
                  <span className={clsx(
                    "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                    (status === "Finalized" || status === "Paid")
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700"
                      : "bg-amber-100 dark:bg-amber-900/30 text-amber-700"
                  )}>
                    {status}
                  </span>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">
                <section>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Patient Details</h3>
                  <div className="space-y-3">
                    <div className="relative">
                      <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                      <select
                        value={selectedOwnerId}
                        onChange={(e) => {
                          const oId = e.target.value;
                          setSelectedOwnerId(oId);
                          setSelectedPatientId(""); // reset pet
                          setPatientDetails(null);
                          setAppointments([]);

                          if (oId) {
                            const ownerPets = (Array.isArray(pets) ? pets : []).filter(p => p.owner_id?.toString() === oId.toString());
                            if (ownerPets.length === 1) {
                              // Auto select the only pet
                              const onlyPet = ownerPets[0];
                              handlePatientSelect({ target: { value: onlyPet.id.toString() } });
                            }
                          }
                        }}
                        className="h-11 w-full appearance-none rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-10 pr-8 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none"
                        disabled={status === "Finalized"}
                      >
                        <option value="">Select an owner...</option>
                        {owners.map(o => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                    </div>

                    <div className="relative">
                      <select
                        value={selectedPatientId}
                        onChange={handlePatientSelect}
                        disabled={!selectedOwnerId || status === "Finalized"}
                        className={clsx(
                          "h-11 w-full appearance-none rounded-xl border pl-4 pr-8 text-sm focus:outline-none disabled:opacity-50 dark:bg-dark-surface dark:text-zinc-300",
                          getError("pet_id") ? "border-rose-500 bg-rose-50/10" : "border-zinc-200 dark:border-dark-border bg-zinc-50"
                        )}
                      >
                        <option value="">Select a pet...</option>
                        {(Array.isArray(pets) ? pets : []).filter(p => p.owner_id?.toString() === selectedOwnerId?.toString()).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {p.species?.name || "Unknown"}
                          </option>
                        ))}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                      {getError("pet_id") && <p className="mt-1 text-xs font-medium text-rose-500">{getError("pet_id")}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Select Appointment</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsApptDropdownOpen(!isApptDropdownOpen)}
                          disabled={!selectedPatientId || status === "Finalized"}
                          className={clsx(
                            "flex h-11 w-full items-center justify-between rounded-xl border px-4 text-sm transition-all focus:outline-none disabled:opacity-50 dark:bg-dark-surface dark:text-zinc-300",
                            isApptDropdownOpen ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-zinc-200 dark:border-dark-border bg-zinc-50"
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FiCalendar className="h-4 w-4 shrink-0 text-zinc-400" />
                            <span className={clsx("truncate", !selectedAppointmentId && "text-zinc-400")}>
                              {selectedAppointmentId
                                ? appointments.find(a => a.id.toString() === selectedAppointmentId)?.date
                                  ? `${formatDate(appointments.find(a => a.id.toString() === selectedAppointmentId).date)} - ${appointments.find(a => a.id.toString() === selectedAppointmentId).title || appointments.find(a => a.id.toString() === selectedAppointmentId).service?.name}`
                                  : "Selected Appointment"
                                : "Choose an appointment..."
                              }
                            </span>
                          </div>
                          <FiChevronDown className={clsx("h-4 w-4 text-zinc-400 transition-transform", isApptDropdownOpen && "rotate-180")} />
                        </button>

                        {isApptDropdownOpen && (
                          <div className="absolute left-0 top-full z-[60] mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 dark:border-dark-border dark:bg-dark-card">
                            <div className="p-2 border-b border-zinc-100 dark:border-dark-border">
                              <div className="relative">
                                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                <input
                                  type="text"
                                  placeholder="Search date or title..."
                                  value={appointmentSearch}
                                  onChange={(e) => setAppointmentSearch(e.target.value)}
                                  autoFocus
                                  className="h-9 w-full rounded-lg border border-zinc-100 bg-zinc-50 pl-9 pr-8 text-xs text-zinc-700 focus:outline-none focus:border-emerald-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-300"
                                />
                                {appointmentSearch && (
                                  <button
                                    onClick={() => setAppointmentSearch("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                  >
                                    <FiX className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="max-h-48 overflow-y-auto divide-y divide-zinc-50 dark:divide-dark-surface">
                              {filteredAppointments.length > 0 ? filteredAppointments.slice(0, 50).map(appt => (
                                <button
                                  key={appt.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedAppointmentId(appt.id.toString());
                                    setIsApptDropdownOpen(false);
                                    setAppointmentSearch("");
                                  }}
                                  className={clsx(
                                    "w-full px-4 py-2.5 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-dark-surface",
                                    selectedAppointmentId === appt.id.toString() ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold" : "text-zinc-600 dark:text-zinc-400"
                                  )}
                                >
                                  <div className="flex justify-between items-center">
                                    <span>{formatDate(appt.date)}</span>
                                    <span className="opacity-60">{appt.time?.substring(0, 5)}</span>
                                  </div>
                                  <div className="truncate opacity-80">{appt.title || appt.service?.name}</div>
                                </button>
                              )) : (
                                <div className="px-4 py-8 text-center text-[10px] text-zinc-400 uppercase font-bold tracking-widest">
                                  No appointments found
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {getError("appointment_id") && <p className="mt-1 text-xs font-medium text-rose-500">{getError("appointment_id")}</p>}
                    </div>

                    {patientDetails && (
                      <div className="rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface p-3 text-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <strong className="text-zinc-700 dark:text-zinc-300">Weight Override (kg)</strong>
                          <input
                            type="number"
                            step="any"
                            value={currentWeight}
                            placeholder="0.0"
                            onChange={(e) => {
                              setCurrentWeight(e.target.value);
                              // Force price recalculation for items in the list?
                              // For simplicity, we just update the state and newly added items will use it.
                            }}
                            className="w-20 rounded-lg border border-zinc-200 px-2 py-1 text-center font-bold text-emerald-600 focus:outline-none dark:bg-dark-card dark:border-dark-border"
                          />
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400"><strong className="text-zinc-700 dark:text-zinc-300">Owner:</strong> {patientDetails.owner?.name}</p>
                        <p className="text-zinc-500 dark:text-zinc-400"><strong className="text-zinc-700 dark:text-zinc-300">Contact:</strong> {patientDetails.owner?.phone || "N/A"}</p>
                        <p className="text-zinc-500 dark:text-zinc-400"><strong className="text-zinc-700 dark:text-zinc-300">Email:</strong> {patientDetails.owner?.email || "N/A"}</p>
                        <p className="text-zinc-500 dark:text-zinc-400"><strong className="text-zinc-700 dark:text-zinc-300">Address:</strong> {
                          [patientDetails.owner?.address, patientDetails.owner?.city, patientDetails.owner?.province, patientDetails.owner?.zip_code].filter(Boolean).join(", ") || "N/A"
                        }</p>
                        <p className="mt-2 text-zinc-500 dark:text-zinc-400"><strong className="text-zinc-700 dark:text-zinc-300">Species/Breed:</strong> {patientDetails.species?.name} {patientDetails.breed?.name ? `• ${patientDetails.breed?.name}` : ""}</p>
                        {patientDetails.date_of_birth && (
                          <p className="text-zinc-500 dark:text-zinc-400"><strong className="text-zinc-700 dark:text-zinc-300">Age:</strong> {(() => {
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
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Services &amp; Meds</h3>


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
                        className="h-11 w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-3 pr-10 text-sm text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 dark:text-zinc-500 disabled:opacity-50"
                      />
                      {serviceInput && (
                        <button
                          onClick={() => {
                            setServiceInput("");
                            setSelectedService(null);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-surface transition-colors"
                        >
                          <FiX className="h-4 w-4" />
                        </button>
                      )}
                      {isDropdownOpen && (
                        <div className="absolute left-0 top-full mt-1 max-h-[400px] w-[500px] md:w-[650px] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card p-3 shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                          {Object.keys(groupedItems).length > 0 ? (
                            Object.entries(groupedItems).map(([category, svcs]) => (
                              <div key={category} className="mb-4 last:mb-0">
                                <div className="flex items-center gap-2 mb-2 px-2">
                                  <div className="h-4 w-1 bg-emerald-500 rounded-full" />
                                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                                    {category}
                                  </span>
                                </div>
                                <ul className="space-y-1">
                                  {svcs.map((item) => (
                                    <li key={`${item.type}-${item.id}`}>
                                      <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => selectItemFromDropdown(item)}
                                        className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all hover:bg-zinc-50 dark:hover:bg-dark-surface border border-transparent hover:border-zinc-100 dark:hover:border-dark-border"
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className={clsx(
                                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs uppercase transition-colors",
                                            item.type === 'inventory' ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                          )}>
                                            {item.type === 'inventory' ? 'ITEM' : 'SRVC'}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="truncate font-bold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                              {item.sku && (
                                                <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 dark:bg-dark-surface dark:text-zinc-500 px-1.5 py-0.5 rounded leading-none">
                                                  {item.sku}
                                                </span>
                                              )}
                                              {item.type === 'inventory' && (
                                                <span className={clsx(
                                                  "text-[10px] font-bold px-1.5 py-0.5 rounded leading-none",
                                                  item.stock > 10 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
                                                )}>
                                                  Stock: {item.stock}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">{currency(item.price)}</p>
                                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-tight">Price</p>
                                        </div>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))
                          ) : (
                            <div className="py-12 flex flex-col items-center justify-center text-center">
                              <div className="h-12 w-12 rounded-full bg-zinc-50 dark:bg-dark-surface flex items-center justify-center mb-3">
                                <FiSearch className="text-zinc-300 w-6 h-6" />
                              </div>
                              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                                {services.length === 0 && inventory.length === 0 ? "No data available." : "No matching items."}
                              </p>
                            </div>
                          )}
                          {serviceInput && !services.find(s => s.name.toLowerCase() === serviceInput.toLowerCase()) && !inventory.find(i => i.item_name.toLowerCase() === serviceInput.toLowerCase()) && (
                            <div className="mt-3 border-t border-zinc-100 dark:border-dark-border pt-4">
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { manuallyAddItem(); setIsDropdownOpen(false); }}
                                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-bold hover:opacity-90 transition-all"
                              >
                                <FiPlusCircle className="w-4 h-4" />
                                Add "{serviceInput}" as Service
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
                      className="h-11 w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-2 text-center text-sm text-zinc-700 dark:text-zinc-300 disabled:opacity-50"
                    />
                    <div className="relative w-full">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400">₱</span>
                      <input
                        type="number"
                        min="0"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        disabled={status === "Finalized" || (selectedService && selectedService.pricing_mode !== "manual")}
                        className="h-11 w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-6 pr-2 text-sm text-zinc-700 dark:text-zinc-300 disabled:opacity-50"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { manuallyAddItem(); setIsDropdownOpen(false); }}
                      disabled={!serviceInput || status === "Finalized"}
                      className="h-11 w-full rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Add
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {items.length > 0 ? items.map((item) => (
                      <article key={item.id} className="group relative rounded-2xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card p-4 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={clsx(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider border",
                                item.item_type === 'inventory' ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                              )}>
                                {item.item_type === 'inventory' ? 'Inventory Item' : 'Clinical Service'}
                              </span>
                              {item.sku && (
                                <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest bg-zinc-50 dark:bg-dark-surface px-1.5 py-0.5 rounded border border-zinc-100 dark:border-dark-border">
                                  {item.sku}
                                </span>
                              )}
                            </div>
                            <p className="text-base font-bold text-zinc-900 dark:text-zinc-50 truncate leading-tight">
                              {item.name}
                            </p>
                            <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                              <span className="flex items-center gap-1">Qty: <b className="text-zinc-900 dark:text-zinc-200">{item.qty}</b></span>
                              <span className="h-1 w-1 rounded-full bg-zinc-300" />
                              <span>{currency(item.unitPrice)}/ea</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-black text-zinc-900 dark:text-zinc-50">{currency(item.amount)}</p>
                            {status === "Draft" && (
                              <button
                                onClick={() => removeItem(item.id)}
                                className="mt-2 p-1.5 rounded-lg text-zinc-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <FiX className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {item.warning ? (
                          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-700 animate-pulse">
                            <FiAlertTriangle className="h-3 w-3 shrink-0" />
                            {item.warning}
                          </div>
                        ) : null}
                      </article>
                    )) : (
                      <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
                        <LuPawPrint className="h-10 w-10 text-zinc-300 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">No items added yet</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="shrink-0 space-y-4 border-t border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface p-5 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]">
                <section className="space-y-3">
                  {/* Tax and Discount removed as per user request */}

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-300">Note to Client</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={status === "Finalized"}
                      placeholder="Visible on the invoice..."
                      className="w-full rounded-lg border border-zinc-200 dark:border-dark-border bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 dark:text-zinc-500 disabled:opacity-50 focus:outline-none"
                    />
                  </div>
                </section>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={resetForm}
                    className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-dark-card px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => submitInvoice("Draft")}
                    disabled={status !== "Draft"}
                    className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-sm font-semibold text-emerald-700 disabled:opacity-50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                  >
                    Save Draft
                  </button>
                </div>
              </div>
            </aside>
          )}

          <section className="flex h-full flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card px-5 py-3 shrink-0">
              <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                <button
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                  className={clsx(
                    "inline-flex items-center gap-2 font-semibold transition-colors px-3 py-1.5 rounded-lg",
                    isPreviewMode ? "bg-emerald-600 text-white" : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-dark-surface"
                  )}
                >
                  <FiEye className="h-4 w-4" />
                  {isPreviewMode ? "Exit Preview" : "Preview Mode"}
                </button>
                <span>Invoice Status: <b className="text-zinc-700 dark:text-zinc-300">{status}</b></span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="rounded-lg p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-surface dark:bg-zinc-950"
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
                  className="rounded-lg p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-surface dark:bg-zinc-950"
                >
                  <FiDownload className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    const invoiceData = {
                      invoice_number: "INV-" + Date.now(),
                      status: status,
                      subtotal,
                      tax_rate: 12.00,
                      discount_value: discountVal,
                      discount_type: discountType,
                      total: totalDue,
                      notes_to_client: notes,
                      items: items,
                      amount_paid: amountPaid,
                      payment_method: paymentMethod
                    };

                    if (status === "Paid" || status === "Finalized" || status === "Partially Paid") {
                      generateInvoicePDF(invoiceData, patientDetails, clinicSettings);
                    } else {
                      submitInvoice("Finalized");
                    }
                  }}
                  disabled={status === "Cancelled"}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-600/10 active:scale-95 transition-all"
                >
                  <FiSend className="h-4 w-4" />
                  {status === "Paid" ? "Download Receipt" :
                    (status === "Finalized" || status === "Partially Paid") ? "Download Invoice" :
                      "Finalize & Generate Invoice"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 text-left">
              <article className="mx-auto max-w-4xl rounded-sm bg-white dark:bg-dark-card p-6 sm:p-8 md:p-12 shadow-md printable-invoice">
                <header className="flex flex-row items-start justify-between gap-4 sm:gap-6">
                  <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                    <p className="inline-flex items-center gap-2.5 text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                      {clinicSettings?.clinic_logo ? (
                        <img src={clinicSettings.clinic_logo} alt="Logo" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
                          <LuPawPrint className="h-4 w-4" />
                        </span>
                      )}
                      <span className="truncate">{clinicSettings?.clinic_name || "AutoVet Clinic"}</span>
                    </p>
                    <div className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400 truncate whitespace-normal">
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
                    <p className="text-3xl font-light tracking-wide text-zinc-300 dark:text-zinc-600">INVOICE</p>
                    <p className="mt-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">#VB-{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}-0000</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Date: {new Date().toLocaleDateString()}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Due: Upon Receipt</p>
                  </div>
                </header>

                <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Bill To</p>
                    {patientDetails ? (
                      <>
                        <p className="mt-2 text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50">{patientDetails?.owner?.name || "Guest Client"}</p>
                        <div className="mt-2 space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                          <p>{patientDetails?.owner?.address || "No address provided"}</p>
                          <p>{patientDetails?.owner?.email}</p>
                          <p>{patientDetails?.owner?.phone}</p>
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500 italic">No patient selected</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Patient</p>
                    {patientDetails ? (
                      <div className="mt-2 flex items-center gap-3">
                        <img
                          src={patientDetails.photo ? getActualPetImageUrl(patientDetails.photo) : getPetImageUrl(patientDetails.species?.name, patientDetails.breed?.name)}
                          alt={patientDetails.name}
                          className="h-10 w-10 rounded-full object-cover bg-zinc-100 dark:bg-zinc-800"
                        />
                        <div>
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{patientDetails.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
                      <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 italic">Select to view pet details</p>
                    )}
                  </div>
                </section>

                <section className="mt-8 border-y border-zinc-200 dark:border-dark-border py-3">
                  <div className="grid grid-cols-[1fr_60px_100px_100px] text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    <p>Description</p>
                    <p className="text-right">Qty</p>
                    <p className="text-right">Unit Price</p>
                    <p className="text-right">Amount</p>
                  </div>

                  <div className="mt-3 space-y-3">
                    {items.filter(item => !item.is_hidden).map((item) => (
                      <div key={`doc-${item.id}`} className="grid grid-cols-[1fr_60px_100px_100px] items-start gap-4 border-b border-zinc-100 dark:border-dark-border pb-4 last:border-0 last:pb-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate">{item.name}</p>
                            <span className={clsx(
                              "text-[8px] uppercase px-1.5 py-0.5 rounded-sm font-black border tracking-wider",
                              item.item_type === 'inventory' ? "border-amber-200 text-amber-600 bg-amber-50" : "border-emerald-200 text-emerald-600 bg-emerald-50"
                            )}>
                              {item.item_type === 'inventory' ? 'PROD' : 'SERV'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.sku && <span className="text-[10px] text-zinc-400 font-mono">[{item.sku}]</span>}
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{item.notes}</p>
                          </div>
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => updateItem(item.id, "qty", e.target.value)}
                          disabled={status !== "Draft"}
                          className="w-full bg-transparent text-right text-sm font-bold text-zinc-700 focus:outline-none focus:border-b focus:border-emerald-500 disabled:opacity-50 dark:text-zinc-300"
                        />
                        <div className="text-right">
                          <p className="text-sm text-zinc-700 dark:text-zinc-300">{currency(item.unitPrice)}</p>
                          <p className="text-[10px] text-zinc-400 uppercase font-bold">Rate</p>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-1">
                          <p className="text-right text-sm font-black text-zinc-900 dark:text-zinc-50">{currency(item.amount)}</p>
                          {status === "Draft" && (
                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-1.5 rounded-lg text-zinc-300 hover:text-rose-500 hover:bg-rose-50 transition-all shadow-sm"
                              title="Remove item"
                            >
                              <FiX className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-zinc-100 rounded-2xl">
                        <FiCreditCard className="w-10 h-10 text-zinc-200 mb-2" />
                        <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No line items added</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="mt-6 ml-auto w-full max-w-sm space-y-2">
                  <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
                    <span>Subtotal</span>
                    <span>{currency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
                    <span>VAT (12%)</span>
                    <span>{currency(taxAmount)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-zinc-200 dark:border-dark-border pt-3">
                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Total Due</span>
                    <span className="text-2xl font-bold text-emerald-600">{currency(totalDue)}</span>
                  </div>

                  <div className="mt-6 border-t border-zinc-200 dark:border-dark-border pt-4">
                    {/* Record Payment Section - Only for Finalized/Partially Paid */}
                    {(status === "Finalized" || status === "Partially Paid") && (
                      <div className="mt-6 border-t border-zinc-200 dark:border-dark-border pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 flex items-center gap-2">
                          <FiCreditCard className="w-3 h-3" /> Record Payment
                        </p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="h-9 w-full rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-3 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                          >
                            <option value="">Select Method...</option>
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                          </select>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 text-sm">₱</span>
                            <input
                              type="number"
                              min="0"
                              value={amountPaid}
                              onChange={(e) => setAmountPaid(Number(e.target.value))}
                              placeholder="Amount Paid"
                              className="h-9 w-full rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-7 pr-3 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                            />
                          </div>
                        </div>
                        <button
                          onClick={handleRecordPaymentUpdate}
                          disabled={isRecordingPayment}
                          className="w-full h-10 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                        >
                          {isRecordingPayment ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                          ) : <FiCheck className="w-4 h-4" />}
                          {isRecordingPayment ? "Processing..." : "Confirm & Record Payment"}
                        </button>
                      </div>
                    )}

                    {/* Receipt Details Section - Only for Paid */}
                    {status === "Paid" && (
                      <div className="mt-6 border-t border-emerald-100 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-900/30 rounded-2xl p-4 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Payment Receipt</p>
                          <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Fully Paid</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Method</span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{paymentMethod || "N/A"}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Amount Paid</span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{currency(amountPaid)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Date</span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{new Date().toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <footer className="mt-12 border-t border-zinc-200 dark:border-dark-border pt-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Notes to Client</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                    {notes || "No additional notes provided."}
                  </p>
                  <p className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-500">Powered by Pet Wellness Systems</p>
                </footer>
              </article>
            </div>
          </section>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-zinc-950">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Invoice History</h2>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">Review all invoices generated by the system.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-72">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search invoice, patient, owner..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        fetchInvoices(1);
                      }
                    }}
                    className="w-full pl-10 pr-10 py-2 rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        fetchInvoices(1, "");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => fetchInvoices(pagination.currentPage)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-dark-surface transition-all"
                >
                  {historyLoading ? "Refreshing..." : "Refresh List"}
                </button>
              </div>
            </div>

            <Pagination />

            {historyLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-emerald-600" />
                  <p className="text-sm font-bold text-zinc-500">Loading history...</p>
                </div>
              </div>
            ) : invoices.length > 0 ? (
              <div className="grid gap-4">
                {invoices.map((inv) => (
                  <article
                    key={inv.id}
                    className="group relative flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-dark-surface flex items-center justify-center border border-zinc-100 dark:border-dark-border shrink-0">
                        <FiCreditCard className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{inv.invoice_number}</span>
                          <span className={clsx(
                            "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                            inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                              inv.status === 'Finalized' || inv.status === 'Partially Paid' ? 'bg-amber-100 text-amber-700' :
                                inv.status === 'Cancelled' ? 'bg-rose-100 text-rose-700' :
                                  'bg-zinc-100 text-zinc-600'
                          )}>
                            {inv.status === 'Finalized' ? 'Unpaid Invoice' : inv.status === 'Paid' ? 'Payment Receipt' : inv.status}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 truncate">
                          Patient: {inv.pet?.name || "N/A"}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-zinc-500 font-medium">
                          <span className="flex items-center gap-1.5"><FiCalendar className="w-3.5 h-3.5" /> {formatDate(inv.created_at)}</span>
                          <span className="flex items-center gap-1.5"><LuPawPrint className="w-3.5 h-3.5" /> {inv.pet?.owner?.name || "N/A"}</span>
                          <span className="flex items-center gap-1.5"><FiPlusCircle className="w-3.5 h-3.5" /> {inv.items?.length || 0} Items</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-zinc-100 dark:border-dark-border pt-4 md:pt-0">
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Total Amount</p>
                        <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">{currency(inv.total)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => generateInvoicePDF(inv, inv.pet, clinicSettings)}
                          className="p-2.5 rounded-xl bg-zinc-50 dark:bg-dark-surface text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all"
                          title={inv.status === 'Paid' ? "Download Receipt" : "Download Invoice"}
                        >
                          <FiDownload className="w-5 h-5" />
                        </button>
                        {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                          <button
                            onClick={() => {
                              setItems(inv.items.map(i => ({
                                ...i,
                                id: i.id,
                                unitPrice: i.unit_price,
                                indicator: "bg-emerald-400"
                              })));
                              setSelectedPatientId(inv.pet_id.toString());
                              setPatientDetails(inv.pet);
                              setNotes(inv.notes_to_client || "");
                              setStatus(inv.status);
                              setAmountPaid(inv.amount_paid || 0);
                              setPaymentMethod(inv.payment_method || "Cash");
                              setInvoiceId(inv.id);
                              setActiveTab("new");
                              setIsPreviewMode(true);
                              toast.info(`Ready to record payment for ${inv.invoice_number}`);
                            }}
                            className="p-2.5 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all border border-amber-100"
                            title="Record Payment"
                          >
                            <FiCreditCard className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            // Populate form for viewing/editing if possible
                            // For now, let's just show a toast or preview
                            setItems(inv.items.map(i => ({
                              ...i,
                              id: i.id,
                              unitPrice: i.unit_price,
                              indicator: "bg-emerald-400"
                            })));
                            setSelectedPatientId(inv.pet_id.toString());
                            setSelectedOwnerId(inv.pet?.owner_id?.toString() || "");
                            setPatientDetails(inv.pet);
                            setNotes(inv.notes_to_client || "");
                            setStatus(inv.status);
                            setAmountPaid(inv.amount_paid);
                            setPaymentMethod(inv.payment_method || "");
                            setInvoiceId(inv.id);
                            setActiveTab("new");
                            setIsPreviewMode(true);
                          }}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold hover:opacity-90 transition-all"
                        >
                          <FiEye className="w-4 h-4" /> View Details
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                <div className="mt-6">
                  <Pagination />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-dark-border bg-white/50 dark:bg-dark-card/50 p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-dark-surface flex items-center justify-center mb-4">
                  <FiCreditCard className="w-10 h-10 text-zinc-300" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">No Invoices Found</h3>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs mx-auto">You haven&apos;t generated any invoices yet. Start by creating a new one in the &quot;New Invoice&quot; tab.</p>
                <button
                  onClick={() => setActiveTab("new")}
                  className="mt-6 px-6 py-3 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  Create Your First Invoice
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ManualSendModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        owner={patientDetails?.owner}
        relatedObject={{
          id: selectedAppointmentId, // We might need the actual invoice ID if saved
          invoice_number: "INV-" + new Date().getFullYear(), // placeholder if not yet saved
          total: totalDue
        }}
        relatedType="App\Models\Invoice"
      />
    </div>
  );
}

export default InvoiceModuleView;
