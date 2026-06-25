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
  const curr = data.currency || "AED";
  const yr = new Date().getFullYear().toString().slice(-2);
  const invoiceNo = `SSMT/PI-${yr}/${String(data.id).padStart(3, "0")}`;
  const dateStr = fmtDate(data.dealStartDate);
  const baseAmt = data.agreedAmount ?? 0;
  const vatAmt = data.vatApplicable ? Math.round(baseAmt * 0.05 * 100) / 100 : 0;
  const totalAmt = baseAmt + vatAmt;

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
    padding: 32px 40px;
    line-height: 1.5;
  }

  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 18px;
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
    font-size: 18px;
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
    margin-top: 14px;
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
  .bank-val { }

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

  /* ── Footer ── */
  .footer {
    display: flex;
    justify-content: space-between;
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #aaa;
    font-size: 11px;
  }
  .footer .sig-block { display: flex; flex-direction: column; gap: 4px; }
  .footer .sig-name { font-weight: 700; font-size: 12px; text-transform: uppercase; }
  .footer .sig-company { font-size: 10.5px; color: #444; }
  .footer .accepted { text-align: right; font-weight: 700; font-size: 11px; letter-spacing: 0.3px; }
  .footer .accepted-company { text-align: right; font-size: 10.5px; color: #444; }

  @media print {
    body { padding: 16px 24px; }
    @page { margin: 8mm 10mm; size: A4; }
  }
</style>
</head>
<body>

<!-- ── HEADER ── -->
<div class="header">
  <div class="customer-block">
    <div class="company-name">${escHtml(data.companyName)}</div>
    ${data.contactName ? `<div>${escHtml(data.contactName)}</div>` : ""}
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
    <td class="label">Total Ex-Works Dubai (${curr})</td>
    <td class="value">${fmt(baseAmt, curr)}</td>
  </tr>
  ${
    data.vatApplicable
      ? `<tr>
    <td class="label">VAT @ 5% (${curr})</td>
    <td class="value">${fmt(vatAmt, curr)}</td>
  </tr>`
      : ""
  }
  <tr class="grand">
    <td class="label">Total on Ex-Works Dubai Basis (${curr})</td>
    <td class="value">${fmt(totalAmt, curr)}</td>
  </tr>
</table>

<!-- ── PAYMENT ── -->
<div class="section">
  <span class="section-title">Payment:</span> 100% Advance
</div>

<!-- ── BANK DETAILS ── -->
<div class="section">
  <div class="section-title">Our Bank Details</div>
  <div class="bank-grid">
    <span class="bank-key">Account Name</span><span class="bank-val">Star Sewing Machines Trading LLC</span>
    <span class="bank-key">Account Number</span><span class="bank-val">1011006864301</span>
    <span class="bank-key">IBAN (23 Chars)</span><span class="bank-val">AE20026000101 1006864301</span>
    <span class="bank-key">Currency</span><span class="bank-val">AED</span>
    <span class="bank-key">Bank Name</span><span class="bank-val">Emirates NBD Bank PJSC</span>
    <span class="bank-key">Swift</span><span class="bank-val">EBILAEAD</span>
  </div>
</div>

<!-- ── TERMS ── -->
<div class="terms">
  <div class="row"><span class="key">Delivery :</span><span>Available Ex-Stock, For Subject to Prior Sale</span></div>
  <div class="row"><span class="key">Installation &amp; Training :</span><span>Free Installation &amp; Training Provided in U.A.E</span></div>
  <div class="row"><span class="key">Validity :</span><span>01 Weeks</span></div>
  <div class="row"><span class="key">Warranty :</span><span>One Year from Date of Invoice</span></div>
</div>

<!-- ── NOTE ── -->
<div class="note-block">
  <span class="note-title">Note: </span>
  Customer must provide local expenses (e.g. Gate Pass Charges, Delivery &amp; Off Loading Charges, etc.)${data.notes ? `<br><br>${escHtml(data.notes)}` : ""}
</div>

<!-- ── FOOTER ── -->
<div class="footer">
  <div class="sig-block">
    <div class="sig-name">${escHtml(data.salespersonName || "Authorized Signatory")}</div>
    <div class="sig-company">STAR SEWING MACHINES TRADING LLC</div>
  </div>
  <div>
    <div class="accepted">Accepted &amp; Confirmed</div>
    <div class="accepted-company">${escHtml(data.companyName)}</div>
  </div>
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
