import tnHeaderBanner from "@assets/image_1782552446892.png";
import tnFooterBanner from "@assets/image_1782553154223.png";
import starGlobalTechHeader from "@assets/AC76EED3-C9E5-4086-805F-F4CA7179A00C_4_5005_c_1783513200582.jpeg";
import starGlobalTechFooter from "@assets/image_1783078365006.png";

export interface ProformaInvoiceItem {
  brand: string;
  model: string;
  description: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  vatPct: number;
}

export interface ProformaInvoiceData {
  id: number;
  companyName: string;
  contactName: string;
  dealStartDate?: string | null;
  productItem: string;
  brand?: string | null;
  model?: string | null;
  quantity?: number | null;
  agreedAmount: number;
  receivedAmount?: number | null;
  outstandingAmount?: number | null;
  currency?: string | null;
  vatApplicable?: boolean;
  notes?: string | null;
  salespersonName: string;
  logoUrl?: string;
  orderType?: string | null;
  pdc?: string | null;
  deliveryTime?: string | null;
  region?: string | null;
  companyNameImageUrl?: string;
  companySelection?: string | null;
  // Multi-item fields from AddOrder
  items?: ProformaInvoiceItem[] | null;
  transportationFee?: number | null;
  paymentTerms?: string | null;
  warranty?: string | null;
  deliveryTerms?: string | null;
  delayReason?: string | null;
  bankDetails?: string | null;
  additionalInfo?: boolean[] | null;
  sgtInvoiceSeq?: number | null;
}

interface RegionConfig {
  currency: string;
  vatRate: number;
  totalLabel: string;
  companyName: string;
  companySubTitle: string;
  letterheadContact: string;
  bank: Array<{ key: string; value: string }>;
  paymentText: string;
  noteText: string;
  footerLine1: string;
  footerLine2: string;
  // optional French/localisation overrides
  docTitle?: string;           // e.g. "DEVIS" instead of "Proforma Invoice"
  colBrand?: string;           // column header for brand
  colModel?: string;           // column header for model / ref
  colDesc?: string;            // column header for description
  colQty?: string;             // column header for qty
  colUnitPrice?: string;       // column header for unit price
  colTotal?: string;           // column header for total
  paymentLabel?: string;       // label before payment text
  creditTermLabel?: string;    // label before credit term
  bankLabel?: string;          // label for bank section
  noteLabel?: string;          // label for note section
  validityText?: string;       // extra line printed below totals (e.g. "Validité du devis : 10 jours")
  vatLabel?: string;           // label for VAT row
  acceptedLabel?: string;      // right-side footer label
  sigCompanyLabel?: string;    // left sig company name
  customerLabel?: string;      // label before customer name
  addressLabel?: string;       // label before address
  attentionLabel?: string;     // "A l'attention de" label
  // totals row label overrides
  subTotalLabel?: string;      // default "Sub Total"
  discountLabel?: string;      // default "Discount"
  deliveryLabel?: string;      // default "Delivery / Transportation"
  grandTotalLabel?: string;    // default "Grand Total"
  receivedLabel?: string;      // default "Received Amount"
  outstandingLabel?: string;   // default "Outstanding Amount"
  currencySymbol?: string;     // display symbol override, e.g. "€" instead of "EUR"
  // wave header variant (Tunisia / North Africa style)
  headerVariant?: "wave";
  waveCompanyName?: string;    // text shown in the white wave area (e.g. "STAR NORTH AFRICA")
  // styling overrides
  companyNameColor?: string;   // CSS color for the company name in the letterhead
  addressUnderline?: boolean;  // underline the contact/address line
}

const REGION_CONFIGS: Record<string, RegionConfig> = {
  UAE: {
    currency: "AED",
    vatRate: 5,
    totalLabel: "Ex-Works Dubai",
    companyName: "Star Sewing Machines Trading L.L.C.",
    companySubTitle: "Industrial Sewing Machines &amp; Garment Equipment",
    letterheadContact:
      "Dubai, United Arab Emirates &nbsp;|&nbsp; TRN: 100515959300003<br>Tel: +971 4 2679444 &nbsp;|&nbsp; Email: star@starsew.com",
    bank: [
      { key: "Account Name",    value: "Star Sewing Machines Trading LLC" },
      { key: "Account Number",  value: "1011006864301" },
      { key: "IBAN (23 Chars)", value: "AE20026000101 1006864301" },
      { key: "Currency",        value: "AED" },
      { key: "Bank Name",       value: "Emirates NBD Bank PJSC" },
      { key: "Swift",           value: "EBILAEAD" },
    ],
    paymentText: "100% Advance",
    noteText:
      "Customer must provide local expenses (e.g. COVID19 Testing if needed, Gate Pass Charges, Delivery &amp; Off Loading Charges etc.)",
    footerLine1:
      "HEAD OFFICE : Al Qusais Ind. Area, Dubai &ndash; U.A.E. &nbsp; P.O. Box : 5354, &nbsp; Tel : 04-2679444 , &nbsp; Fax : 04-2679445",
    footerLine2: "Email : star@starsew.com &nbsp;&nbsp; Website : www.starsew.com",
  },
  KE: {
    currency: "KSHS",
    vatRate: 16,
    totalLabel: "Total",
    companyName: "Star Sewing Machine (K) Ltd",
    companySubTitle: "Industrial Sewing Machines &amp; Garment Equipment",
    letterheadContact:
      "P.O. Box : 11404-00400, River Road Nairobi &ndash; Kenya<br>Tel : +254-20-2186560 &nbsp;|&nbsp; Email : starsewingkenya@gmail.com",
    bank: [
      { key: "Bank Name",       value: "KCB Bank" },
      { key: "Account Number",  value: "1147479941" },
      { key: "Branch",          value: "River Road Branch" },
      { key: "Currency",        value: "KSHS" },
    ],
    paymentText: "CASH or 100% Bank Transfer",
    noteText:
      "Free installation and training will be provided. Customer must provide transport and accommodation for our engineers for installations outside Nairobi.",
    footerLine1:
      "P.O. Box : 11404-00400, River Road Nairobi &ndash; Kenya &nbsp; Tel : +254-20-2186560",
    footerLine2: "Email : starsewingkenya@gmail.com &nbsp;&nbsp; Website : www.starsew.com",
  },
  KSA: {
    currency: "SAR",
    vatRate: 15,
    totalLabel: "Total Ex-Works",
    companyName: "Yousef Amer M. S. Bagheran Est",
    companySubTitle: "For Wholesale and Retail in Sewing &amp; Embroidery Machines",
    letterheadContact:
      "Ash Sharafiyah Dist. Jeddah 23217 &ndash; 6192, Saudi Arabia<br>C.R : 4030287042",
    bank: [
      { key: "Account Name",    value: "Yousef Amer Baqurayn Alhadhrami Trading Est" },
      { key: "Account Number",  value: "1861423539940" },
      { key: "IBAN (24 Chars)", value: "SA6520000001861423539940" },
      { key: "Currency",        value: "SAR" },
      { key: "Bank Name",       value: "Riyad Bank" },
    ],
    paymentText: "100% Advance",
    noteText:
      "Customer must provide local expenses including Gate Pass Charges, Delivery &amp; Off Loading Charges etc.",
    footerLine1:
      "Askan Building - No : 3 Group 6 Ground Floor, 3228 King Abdullah Road, Ash Sharafiyah Dist. Jeddah 23217 &ndash; 6192",
    footerLine2: "C.R : 4030287042",
  },
  TN: {
    currency: "EUR",
    vatRate: 19,
    totalLabel: "Total HT EX-works",
    companyName: "Star Sewing Machines &ndash; Tunisie",
    companySubTitle: "Machines à coudre industrielles &amp; Équipements de confection",
    letterheadContact:
      "Tunisie<br>Email : star@starsew.com",
    bank: [
      { key: "Banque",          value: "—" },
      { key: "Numéro de compte", value: "—" },
      { key: "IBAN",            value: "—" },
      { key: "Devise",          value: "EUR" },
    ],
    paymentText: "A convenir",
    noteText:
      "Machines disponibles en stock. Le client est responsable des frais de livraison et de déchargement.",
    footerLine1: "Star Sewing Machines &ndash; Tunisie",
    footerLine2: "Email : star@starsew.com &nbsp;&nbsp; Website : www.starsew.com",
    headerVariant:    "wave",
    waveCompanyName:  "STAR NORTH AFRICA",
    // French label overrides
    docTitle:       "DEVIS",
    colBrand:       "Marque",
    colModel:       "Référence",
    colDesc:        "Désignation",
    colQty:         "Qté",
    colUnitPrice:   "P. Unitaire HT",
    colTotal:       "Total HT",
    paymentLabel:   "Conditions de règlement",
    creditTermLabel:"Délai de livraison",
    bankLabel:      "Coordonnées bancaires",
    noteLabel:      "Remarque",
    validityText:   "Validité du devis : 10 jours",
    vatLabel:       "TVA",
    acceptedLabel:  "Accepté &amp; Confirmé",
    sigCompanyLabel:"STAR SEWING MACHINES",
    customerLabel:  "Destinataire",
    addressLabel:   "Adresse",
    attentionLabel: "À l'attention de",
    subTotalLabel:  "Sous-total",
    discountLabel:  "Remise",
    deliveryLabel:  "Livraison / Transport",
    grandTotalLabel:"Total HT",
    receivedLabel:  "Montant reçu",
    outstandingLabel:"Montant restant dû",
    currencySymbol:  "€",
  },
  NG: {
    currency: "NGN",
    vatRate: 7.5,
    totalLabel: "Total",
    companyName: "Star Sewing Machines Limited",
    companySubTitle: "Industrial Sewing Machines &amp; Garment Equipment",
    letterheadContact:
      "270 B, Ajose Adeogun Street, Victoria Island Lagos, Nigeria<br>Tel No. +234-9082069383 &nbsp;|&nbsp; Email: sales1@starwestafrica.com &nbsp;|&nbsp; License No. RC1119984",
    bank: [
      { key: "Account Name",    value: "Star Sewing Machines Limited" },
      { key: "Bank Name",       value: "—" },
      { key: "Account Number",  value: "—" },
      { key: "Currency",        value: "NGN" },
    ],
    paymentText: "100% Advance",
    noteText:
      "Customer must provide local expenses including delivery and off-loading charges.",
    footerLine1:
      "270 B, Ajose Adeogun Street, Victoria Island Lagos, Nigeria &nbsp; Tel: +234-9082069383",
    footerLine2:
      "Email: sales1@starwestafrica.com &nbsp;&nbsp; License No. RC1119984",
    companyNameColor: "#8C1515",
    addressUnderline: true,
    sigCompanyLabel: "STAR SEWING MACHINES LIMITED",
  },
};

// Maps stored salesperson country names → REGION_CONFIGS keys
const REGION_ALIASES: Record<string, string> = {
  "NIGERIA":      "NG",
  "NIGER":        "NG",
  "TUNISIA":      "TN",
  "TUNISIE":      "TN",
  "SAUDI ARABIA": "KSA",
  "SAUDI":        "KSA",
  "KSA":          "KSA",
  "KENYA":        "KE",
  "KE":           "KE",
  "UAE":          "UAE",
  "NG":           "NG",
  "TN":           "TN",
};

function getRegionConfig(region?: string | null): RegionConfig {
  if (!region) return REGION_CONFIGS["UAE"];
  const upper = region.toUpperCase().trim();
  const key = REGION_ALIASES[upper] ?? upper;
  return REGION_CONFIGS[key] ?? REGION_CONFIGS["UAE"];
}

function fmt(n: number, curr: string): string {
  return `${n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const d = new Date(dateStr.split("T")[0] + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function openProformaInvoice(data: ProformaInvoiceData): void {
  const cfg = getRegionConfig(data.region);
  const _rawCurr = data.currency || cfg.currency;
  const curr = _rawCurr === "TND" ? "EUR" : _rawCurr;
  const currDisp = cfg.currencySymbol ?? curr;
  const yr = new Date().getFullYear().toString().slice(-2);
  const invoiceNo = data.companySelection === "STAR GLOBAL TECH FZCO"
    ? `SGT/PI-${yr}/${String(data.sgtInvoiceSeq ?? data.id).padStart(4, "0")}`
    : `SSMT/PI-${yr}/${String(data.id).padStart(3, "0")}`;
  const dateStr = fmtDate(data.dealStartDate);
  const baseAmt = data.agreedAmount ?? 0;
  const vatAmt = data.vatApplicable ? Math.round(baseAmt * (cfg.vatRate / 100) * 100) / 100 : 0;
  const totalAmt = baseAmt + vatAmt;

  const logoHtml = data.logoUrl
    ? `<img src="${data.logoUrl}" alt="Star Logo" class="logo-img" />`
    : `<div class="logo-placeholder">★</div>`;

  const docTitle       = cfg.docTitle       ?? "Proforma Invoice";
  const colBrand       = cfg.colBrand       ?? "Brand";
  const colModel       = cfg.colModel       ?? "Model";
  const colDesc        = cfg.colDesc        ?? "Description";
  const colQty         = cfg.colQty         ?? "Qty";
  const colUnitPrice   = cfg.colUnitPrice   ?? `Unit Price<br>(${currDisp})`;
  const colTotal       = cfg.colTotal       ?? `Total<br>(${currDisp})`;
  const paymentLabel   = cfg.paymentLabel   ?? "Payment";
  const bankLabel      = cfg.bankLabel      ?? "Our Bank Details";
  const noteLabel      = cfg.noteLabel      ?? "Note";
  const vatLabel       = cfg.vatLabel       ?? `VAT @ ${cfg.vatRate}%`;
  const acceptedLabel  = cfg.acceptedLabel  ?? "Accepted &amp; Confirmed";
  const sigCompanyLabel= cfg.sigCompanyLabel?? "STAR.S.M.TRADING LLC";
  const bankRowsHtml = cfg.bank
    .map((r) => `<span class="bank-key">${r.key}</span><span>${r.value}</span>`)
    .join("\n    ");

  // Determine whether to use multi-item mode or legacy single-row mode
  const useItems = Array.isArray(data.items) && data.items.length > 0;

  // Multi-item calculations
  const itemRows: ProformaInvoiceItem[] = useItems
    ? (data.items as ProformaInvoiceItem[])
    : [{
        brand: data.brand ?? "",
        model: data.model ?? "",
        description: data.productItem ?? "",
        qty: data.quantity ?? 1,
        unitPrice: data.agreedAmount ?? 0,
        discountPct: 0,
        vatPct: data.vatApplicable ? cfg.vatRate : 0,
      }];

  const subTotal = itemRows.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const totalDiscount = itemRows.reduce((s, it) => s + it.qty * it.unitPrice * (it.discountPct / 100), 0);
  const totalVat = itemRows.reduce((s, it) => {
    const base = it.qty * it.unitPrice * (1 - it.discountPct / 100);
    return s + base * (it.vatPct / 100);
  }, 0);
  const transportFee = useItems ? (data.transportationFee ?? 0) : 0;
  const grandTotal = subTotal - totalDiscount + totalVat + transportFee;

  const itemRowsHtml = itemRows.map((it, idx) => {
    const lineBase = it.qty * it.unitPrice;
    const lineDiscount = lineBase * (it.discountPct / 100);
    const lineVat = (lineBase - lineDiscount) * (it.vatPct / 100);
    const lineTotal = lineBase - lineDiscount + lineVat;
    return `<tr>
      <td class="center" style="font-size:10px;color:#888">${idx + 1}</td>
      <td class="center">${escHtml(it.brand)}</td>
      <td class="center">${escHtml(it.model)}</td>
      <td>${escHtml(it.description)}</td>
      <td class="center">${it.qty}</td>
      <td class="right">${fmt(it.unitPrice, curr)}</td>
      <td class="right">${fmt(lineTotal, curr)}</td>
    </tr>`;
  }).join("\n");

  const receivedAmt = data.receivedAmount ?? 0;
  const outstandingAmt = data.outstandingAmount ?? grandTotal;

  const lSubTotal    = cfg.subTotalLabel   ?? "Sub Total";
  const lDiscount    = cfg.discountLabel   ?? "Discount";
  const lDelivery    = cfg.deliveryLabel   ?? "Delivery / Transportation";
  const lGrandTotal  = cfg.grandTotalLabel ?? "Grand Total";
  const lReceived    = cfg.receivedLabel   ?? "Received Amount";
  const lOutstanding = cfg.outstandingLabel ?? "Outstanding Amount";

  const totalsHtml = `
  <tr>
    <td class="label">${lSubTotal} (${currDisp})</td>
    <td class="value">${fmt(subTotal, curr)} ${currDisp}</td>
  </tr>
  ${totalDiscount > 0 ? `<tr>
    <td class="label">${lDiscount} (${currDisp})</td>
    <td class="value">- ${fmt(totalDiscount, curr)} ${currDisp}</td>
  </tr>` : ""}
  ${totalVat > 0 ? `<tr>
    <td class="label">${vatLabel} (${currDisp})</td>
    <td class="value">${fmt(totalVat, curr)} ${currDisp}</td>
  </tr>` : ""}
  ${transportFee > 0 ? `<tr>
    <td class="label">${lDelivery} (${currDisp})</td>
    <td class="value">${fmt(transportFee, curr)} ${currDisp}</td>
  </tr>` : ""}
  <tr class="grand">
    <td class="label">${lGrandTotal} (${currDisp})</td>
    <td class="value">${fmt(grandTotal, curr)} ${currDisp}</td>
  </tr>
  ${receivedAmt > 0 ? `<tr>
    <td class="label">${lReceived} (${currDisp})</td>
    <td class="value" style="color:#1a7a1a;font-weight:700;">${fmt(receivedAmt, curr)} ${currDisp}</td>
  </tr>` : ""}
  <tr>
    <td class="label">${lOutstanding} (${currDisp})</td>
    <td class="value" style="color:${outstandingAmt > 0 ? "#c0392b" : "#1a7a1a"};font-weight:700;">${fmt(outstandingAmt, curr)} ${currDisp}</td>
  </tr>`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Proforma Invoice ${invoiceNo}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #111;
    background: #fff;
    padding: 20px 36px 32px;
    line-height: 1.5;
  }

  /* ── Letterhead (standard) ── */
  .letterhead {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 12px;
    border-bottom: 3px double #222;
    margin-bottom: 12px;
  }
  .logo-img {
    width: 80px;
    height: 80px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .logo-placeholder {
    font-size: 60px;
    line-height: 80px;
    width: 80px;
    text-align: center;
    flex-shrink: 0;
  }
  .company-info {
    flex: 1;
    text-align: center;
  }
  .company-info .co-name {
    font-size: 18px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 1px;
    line-height: 1.3;
  }
  .company-info .co-sub {
    font-size: 10px;
    color: #555;
    margin-top: 2px;
    letter-spacing: 0.3px;
  }
  .company-info .co-contact {
    font-size: 10px;
    color: #333;
    margin-top: 4px;
    line-height: 1.6;
  }
  .letterhead-spacer {
    width: 80px;
    flex-shrink: 0;
  }

  /* ── Wave / Banner Header (Tunisia / North Africa) ── */
  .wave-banner-img {
    display: block;
    width: calc(100% + 72px);
    margin: -20px -36px 0;
    height: auto;
  }
  /* DEVIS title for wave variant */
  .devis-title {
    text-align: center;
    font-size: 22px;
    font-weight: 900;
    color: #8C2222;
    letter-spacing: 10px;
    text-transform: uppercase;
    margin: 18px 0 6px;
    padding-bottom: 10px;
    border-bottom: 1px solid #ddd;
  }
  .devis-ref {
    text-align: center;
    font-size: 10.5px;
    font-weight: 600;
    color: #444;
    margin-bottom: 14px;
    letter-spacing: 0.4px;
  }

  /* ── Customer Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
  }
  .customer-block {
    font-size: 11px;
    line-height: 1.7;
  }
  .customer-block .company-name {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .date-block {
    font-size: 11px;
    text-align: right;
    padding-top: 2px;
    white-space: nowrap;
  }

  /* ── Title ── */
  .title-section {
    text-align: center;
    margin: 8px 0 4px;
  }
  .title-section h1 {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    border-bottom: 2px solid #111;
    display: inline-block;
    padding-bottom: 2px;
  }
  .invoice-no {
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    margin-top: 4px;
    letter-spacing: 0.5px;
  }

  /* ── Table ── */
  .invoice-table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0 0;
    font-size: 11px;
  }
  .invoice-table th {
    background: #f0f0f0;
    border: 1px solid #bbb;
    padding: 6px 8px;
    text-align: center;
    font-weight: 700;
    font-size: 10.5px;
    text-transform: uppercase;
  }
  .invoice-table th.left { text-align: left; }
  .invoice-table td {
    border: 1px solid #bbb;
    padding: 8px 8px;
    vertical-align: middle;
  }
  .invoice-table td.center { text-align: center; }
  .invoice-table td.right  { text-align: right; }

  /* ── Totals ── */
  .totals-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0;
    font-size: 11px;
  }
  .totals-table td {
    padding: 5px 8px;
    border: 1px solid #bbb;
  }
  .totals-table .label {
    text-align: right;
    font-weight: 600;
    background: #f7f7f7;
    width: 72%;
    text-transform: uppercase;
    letter-spacing: 0.2px;
  }
  .totals-table .value {
    text-align: right;
    font-weight: 600;
    white-space: nowrap;
  }
  .totals-table .grand .label,
  .totals-table .grand .value {
    background: #e8e8e8;
    font-weight: 700;
    font-size: 11.5px;
  }

  /* ── Payment & Bank ── */
  .section {
    margin-top: 12px;
    font-size: 11px;
  }
  .section-title {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    font-size: 11px;
  }
  .bank-grid {
    display: grid;
    grid-template-columns: 180px 1fr;
    row-gap: 2px;
    margin-top: 4px;
  }
  .bank-key { font-weight: 600; }

  /* ── Terms ── */
  .terms {
    margin-top: 10px;
    font-size: 11px;
    line-height: 1.8;
  }
  .terms .row { display: flex; gap: 8px; }
  .terms .key { font-weight: 700; text-transform: uppercase; min-width: 200px; white-space: nowrap; }

  /* ── Note ── */
  .note-block {
    margin-top: 10px;
    font-size: 10.5px;
    border-top: 1px solid #ccc;
    padding-top: 8px;
    line-height: 1.6;
  }
  .note-block .note-title { font-weight: 700; text-transform: uppercase; }

  /* ── Signature Footer ── */
  .footer {
    margin-top: 40px;
    font-size: 11px;
  }
  .footer-row-top {
    display: flex;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .footer-row-bottom {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #aaa;
    padding-top: 6px;
  }
  .sig-name { font-weight: 700; font-size: 12px; text-transform: uppercase; }
  .sig-company { font-size: 10.5px; color: #444; margin-top: 2px; }
  .accepted-label { font-weight: 700; font-size: 11px; letter-spacing: 0.3px; text-align: right; }
  .accepted-company { font-size: 10.5px; color: #444; text-align: right; margin-top: 2px; }

  /* ── Address Footer (standard) ── */
  .address-footer {
    margin-top: 28px;
    border-top: 2px solid #222;
    padding-top: 6px;
    text-align: center;
    font-size: 10.5px;
    line-height: 1.7;
    color: #222;
  }
  .address-footer .af-line1 { font-weight: 700; }
  .address-footer .af-line2 { font-weight: 700; }

  /* ── Banner Footer (Tunisia) ── */
  .footer-banner-img {
    display: block;
    width: calc(100% + 72px);
    margin: 28px -36px -32px;
    height: auto;
  }

  @media print {
    body { padding: 10px 20px 16px; }
    @page { margin: 8mm 10mm; size: A4; }
  }
</style>
</head>
<body>

${cfg.headerVariant === "wave" ? `
<!-- ── BANNER LETTERHEAD (Tunisia / North Africa) ── -->
<img src="${tnHeaderBanner}" alt="Star North Africa" class="wave-banner-img" />
<div class="devis-ref" style="text-align:center;margin-top:10px">${invoiceNo}</div>
` : data.companySelection === "STAR GLOBAL TECH FZCO" ? `
<!-- ── SGT FULL-WIDTH HEADER ── -->
<img src="${starGlobalTechHeader}" alt="STAR GLOBAL TECH FZCO" style="display:block;width:calc(100% + 72px);margin:-20px -36px 0;height:auto;" />
<div style="text-align:center;margin-top:18px;">
  <span style="font-size:17px;font-weight:900;letter-spacing:3px;text-transform:uppercase;border-bottom:2px solid #111;padding-bottom:3px;">PROFORMA INVOICE</span>
</div>
<div style="text-align:center;font-size:11px;font-weight:600;margin-top:8px;letter-spacing:0.5px;margin-bottom:14px;">${invoiceNo}</div>
` : `
<!-- ── LETTERHEAD (standard) ── -->
<div class="letterhead">
  ${logoHtml}
  <div class="company-info">
    ${data.companyNameImageUrl ? `<img src="${data.companyNameImageUrl}" alt="" style="width:100%;height:auto;max-height:28px;object-fit:contain;object-position:center;display:block;margin:0 auto 3px;" />` : ""}
    ${data.companySelection === "STAR GLOBAL TECH FZCO"
      ? `<img src="${starGlobalTechHeader}" alt="STAR GLOBAL TECH FZCO" style="width:100%;max-width:420px;height:auto;display:block;margin:0 auto 4px;object-fit:contain;" />`
      : `<div class="co-name" ${cfg.companyNameColor ? `style="color:${cfg.companyNameColor}"` : ""}>${cfg.companyName}</div>`
    }
    <div class="co-sub">${cfg.companySubTitle}</div>
    <div class="co-contact" ${cfg.addressUnderline ? `style="text-decoration:underline"` : ""}>
      ${cfg.letterheadContact}
    </div>
  </div>
  <div class="letterhead-spacer"></div>
</div>

<!-- ── TITLE ── -->
<div class="title-section">
  <h1>${docTitle}</h1>
</div>
<div class="invoice-no">${invoiceNo}</div>
`}

<!-- ── CUSTOMER HEADER ── -->
<div class="header">
  <div class="customer-block">
    ${cfg.customerLabel ? `<div><strong>${cfg.customerLabel} :</strong></div>` : ""}
    <div class="company-name">${escHtml(data.companyName)}</div>
    ${data.contactName
      ? cfg.attentionLabel
        ? `<div>${cfg.attentionLabel} : ${escHtml(data.contactName)}</div>`
        : `<div>MR : ${escHtml(data.contactName)}</div>`
      : ""}
    ${data.orderType ? `<div style="margin-top:4px;font-size:11px"><span style="font-weight:700;text-transform:uppercase;letter-spacing:0.3px">Order Type :</span> ${escHtml(data.orderType)}</div>` : ""}
  </div>
  <div class="date-block">${dateStr}</div>
</div>

<!-- ── ITEMS TABLE ── -->
<table class="invoice-table">
  <thead>
    <tr>
      <th style="width:4%">#</th>
      <th class="left" style="width:12%">${colBrand}</th>
      <th class="left" style="width:14%">${colModel}</th>
      <th class="left" style="width:30%">${colDesc}</th>
      <th style="width:5%">${colQty}</th>
      <th style="width:12%">${colUnitPrice}</th>
      <th style="width:15%">${colTotal}</th>
    </tr>
  </thead>
  <tbody>
    ${itemRowsHtml}
  </tbody>
</table>

<!-- ── TOTALS ── -->
<table class="totals-table">
  ${totalsHtml}
</table>

${cfg.validityText ? `<div class="section" style="font-style:italic;color:#555;">${cfg.validityText}</div>` : ""}

<!-- ── PAYMENT ── -->
<div class="section">
  <span class="section-title">${paymentLabel} :</span> ${escHtml(data.paymentTerms) || cfg.paymentText}
</div>

${data.deliveryTime ? `<!-- ── DELIVERY TIME ── -->
<div class="section">
  <span class="section-title">Delivery Time :</span> ${escHtml(data.deliveryTime)}
</div>` : ""}

${data.deliveryTerms ? `<!-- ── DELIVERY TERMS ── -->
<div class="section">
  <span class="section-title">Delivery Terms :</span> ${escHtml(data.deliveryTerms)}
</div>` : ""}

${data.warranty ? `<!-- ── WARRANTY ── -->
<div class="section">
  <span class="section-title">Warranty :</span> ${escHtml(data.warranty)}
</div>` : ""}

${data.pdc ? `<!-- ── PDC ── -->
<div class="section">
  <span class="section-title">Number of PDC :</span> ${escHtml(data.pdc)} cheque(s)${(() => {
    const count = parseInt(data.pdc ?? "");
    if (count > 0 && outstandingAmt > 0) {
      return ` &nbsp;|&nbsp; <span style="font-weight:600;">Amount per cheque : ${fmt(outstandingAmt / count, curr)} ${currDisp}</span>`;
    }
    return "";
  })()}
</div>` : ""}

<!-- ── BANK DETAILS ── -->
<div class="section">
  <div class="section-title">${bankLabel}</div>
  <div class="bank-grid">
    ${bankRowsHtml}
  </div>
</div>


${data.delayReason ? `<!-- ── DELAY REASON ── -->
<div class="section" style="margin-bottom:8px;">
  <span class="section-title">Raison du délai client : </span>${escHtml(data.delayReason)}
</div>` : ""}

${Array.isArray(data.additionalInfo) && data.additionalInfo.some(Boolean) ? `<!-- ── ADDITIONAL INFORMATION ── -->
<div class="section" style="margin-top:10px;">
  <div class="section-title" style="margin-bottom:6px;">Additional Information :</div>
  ${data.additionalInfo.map((checked, i) => checked ? `<div style="font-size:11px;margin:3px 0;">&#9746; ${escHtml([
    "Machine inspected and tested before shipment",
    "Spare parts kit included",
    "Operator training to be provided",
    "Warranty documentation to be issued",
  ][i] ?? "")}</div>` : "").filter(Boolean).join("\n  ")}
</div>` : ""}

<!-- ── NOTE ── -->
<div class="note-block">
  <span class="note-title">${noteLabel} : </span>
  ${cfg.noteText}${data.notes ? `<br><br>${escHtml(data.notes)}` : ""}
</div>

<!-- ── SIGNATURE FOOTER ── -->
<div class="footer">
  <div class="footer-row-top">
    <div class="sig-name">${escHtml(data.salespersonName || "Authorized Signatory")}</div>
    <div class="accepted-label">${acceptedLabel}</div>
  </div>
  <div class="footer-row-bottom">
    <div class="sig-company">${sigCompanyLabel}</div>
    <div class="accepted-company">${escHtml(data.companyName)}</div>
  </div>
</div>

<!-- ── ADDRESS FOOTER ── -->
${cfg.headerVariant === "wave"
  ? `<img src="${tnFooterBanner}" alt="Star North Africa Footer" class="footer-banner-img" />`
  : data.companySelection === "STAR GLOBAL TECH FZCO"
    ? `<img src="${starGlobalTechFooter}" alt="STAR GLOBAL TECH FZCO Footer" style="display:block;width:calc(100% + 72px);margin:28px -36px -32px;height:auto;" />`
    : `<div class="address-footer">
  <div class="af-line1">${cfg.footerLine1}</div>
  <div class="af-line2">${cfg.footerLine2}</div>
</div>`
}

<script>
  window.onload = function () { window.print(); };
</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Please allow popups for this site to download the invoice.");
    return;
  }
  win.document.write(html);
  win.document.close();
}

function escHtml(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
