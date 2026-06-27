export interface ProformaInvoiceData {
  id: number;
  companyName: string;
  contactName: string;
  dealStartDate?: string | null;
  productItem: string;
  agreedAmount: number;
  currency?: string | null;
  vatApplicable?: boolean;
  notes?: string | null;
  salespersonName: string;
  logoUrl?: string;
  creditTerm?: string | null;
  region?: string | null;
  companyNameImageUrl?: string;
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
      { key: "Bank Name",       value: "—" },
      { key: "Account Number",  value: "—" },
      { key: "IBAN",            value: "—" },
      { key: "Currency",        value: "SAR" },
    ],
    paymentText: "100% Advance",
    noteText:
      "Customer must provide local expenses including Gate Pass Charges, Delivery &amp; Off Loading Charges etc.",
    footerLine1:
      "Askan Building - No : 3 Group 6 Ground Floor, 3228 King Abdullah Road, Ash Sharafiyah Dist. Jeddah 23217 &ndash; 6192",
    footerLine2: "C.R : 4030287042",
  },
};

function getRegionConfig(region?: string | null): RegionConfig {
  if (region && REGION_CONFIGS[region.toUpperCase()]) {
    return REGION_CONFIGS[region.toUpperCase()];
  }
  return REGION_CONFIGS["UAE"];
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
  const curr = data.currency || cfg.currency;
  const yr = new Date().getFullYear().toString().slice(-2);
  const invoiceNo = `SSMT/PI-${yr}/${String(data.id).padStart(3, "0")}`;
  const dateStr = fmtDate(data.dealStartDate);
  const baseAmt = data.agreedAmount ?? 0;
  const vatAmt = data.vatApplicable ? Math.round(baseAmt * (cfg.vatRate / 100) * 100) / 100 : 0;
  const totalAmt = baseAmt + vatAmt;

  const logoHtml = data.logoUrl
    ? `<img src="${data.logoUrl}" alt="Star Logo" class="logo-img" />`
    : `<div class="logo-placeholder">★</div>`;

  const creditTermValue = data.creditTerm ? escHtml(data.creditTerm) : "&mdash;";
  const bankRowsHtml = cfg.bank
    .map((r) => `<span class="bank-key">${r.key}</span><span>${r.value}</span>`)
    .join("\n    ");

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

  /* ── Letterhead ── */
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

  /* ── Address Footer ── */
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

  @media print {
    body { padding: 10px 20px 16px; }
    @page { margin: 8mm 10mm; size: A4; }
  }
</style>
</head>
<body>

<!-- ── LETTERHEAD ── -->
<div class="letterhead">
  ${logoHtml}
  <div class="company-info">
    ${data.companyNameImageUrl ? `<img src="${data.companyNameImageUrl}" alt="" style="height:23px;width:auto;max-width:100%;display:block;margin:0 auto 3px;" />` : ""}
    <div class="co-name">${cfg.companyName}</div>
    <div class="co-sub">${cfg.companySubTitle}</div>
    <div class="co-contact">
      ${cfg.letterheadContact}
    </div>
  </div>
  <div class="letterhead-spacer"></div>
</div>

<!-- ── CUSTOMER HEADER ── -->
<div class="header">
  <div class="customer-block">
    <div class="company-name">${escHtml(data.companyName)}</div>
    ${data.contactName ? `<div>MR : ${escHtml(data.contactName)}</div>` : ""}
  </div>
  <div class="date-block">${dateStr}</div>
</div>

<!-- ── TITLE ── -->
<div class="title-section">
  <h1>Proforma Invoice</h1>
</div>
<div class="invoice-no">${invoiceNo}</div>

<!-- ── ITEMS TABLE ── -->
<table class="invoice-table">
  <thead>
    <tr>
      <th class="left" style="width:14%">Brand</th>
      <th class="left" style="width:16%">Model</th>
      <th class="left" style="width:36%">Description</th>
      <th style="width:6%">Qty</th>
      <th style="width:14%">Unit Price<br>(${curr})</th>
      <th style="width:14%">Total<br>(${curr})</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="center"></td>
      <td class="center"></td>
      <td>${escHtml(data.productItem)}</td>
      <td class="center">1</td>
      <td class="right">${fmt(baseAmt, curr)}</td>
      <td class="right">${fmt(baseAmt, curr)}</td>
    </tr>
  </tbody>
</table>

<!-- ── TOTALS ── -->
<table class="totals-table">
  <tr>
    <td class="label">${cfg.totalLabel} (${curr})</td>
    <td class="value">${fmt(baseAmt, curr)}</td>
  </tr>
  ${
    data.vatApplicable
      ? `<tr>
    <td class="label">VAT @ ${cfg.vatRate}% (${curr})</td>
    <td class="value">${fmt(vatAmt, curr)}</td>
  </tr>`
      : ""
  }
  <tr class="grand">
    <td class="label">Grand Total (${curr})</td>
    <td class="value">${fmt(totalAmt, curr)}</td>
  </tr>
</table>

<!-- ── PAYMENT ── -->
<div class="section">
  <span class="section-title">Payment:</span> ${cfg.paymentText}
</div>

<!-- ── CREDIT TERM ── -->
<div class="section">
  <span class="section-title">Credit Term:</span> ${escHtml(data.creditTerm) || "&mdash;"}
</div>

<!-- ── BANK DETAILS ── -->
<div class="section">
  <div class="section-title">Our Bank Details</div>
  <div class="bank-grid">
    ${bankRowsHtml}
  </div>
</div>


<!-- ── NOTE ── -->
<div class="note-block">
  <span class="note-title">Note: </span>
  ${cfg.noteText}${data.notes ? `<br><br>${escHtml(data.notes)}` : ""}
</div>

<!-- ── SIGNATURE FOOTER ── -->
<div class="footer">
  <div class="footer-row-top">
    <div class="sig-name">${escHtml(data.salespersonName || "Authorized Signatory")}</div>
    <div class="accepted-label">Accepted &amp; Confirmed</div>
  </div>
  <div class="footer-row-bottom">
    <div class="sig-company">STAR.S.M.TRADING LLC</div>
    <div class="accepted-company">${escHtml(data.companyName)}</div>
  </div>
</div>

<!-- ── ADDRESS FOOTER ── -->
<div class="address-footer">
  <div class="af-line1">${cfg.footerLine1}</div>
  <div class="af-line2">${cfg.footerLine2}</div>
</div>

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
