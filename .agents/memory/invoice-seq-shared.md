---
name: Proforma invoice numbering is a single shared sequence
description: All 5 companies in the Add Order "Choose Your Company" dropdown draw from one shared invoice sequence number, not independent per-company counters.
---

## Rule
Proforma invoice numbers (`SGT/PI-{yr}/{seq}`, `SSMT/PI-{yr}/{seq}`, etc.) all draw their numeric portion from a single shared counter (`deals.invoiceSeq`), computed as `MAX(all deals' invoiceSeq/legacy seqs) + 1` whenever any company is selected. Only the text prefix differs per company.

**Why:** Originally SGT and SSMT had independent counters (`sgtInvoiceSeq`/`ssmtInvoiceSeq`), and 3 other companies (BR, MODREN, DUBAI) weren't tracked at all and mislabeled as SSMT. The business wants one continuous number across every company so gaps/duplicates don't appear across the combined invoice log.

**How to apply:**
- Legacy `sgtInvoiceSeq`/`ssmtInvoiceSeq` columns are kept for backward compatibility with old deals/invoices; new deals only populate `invoiceSeq`.
- Frontend prefix mapping lives in `artifacts/star-crm/src/utils/proformaInvoice.ts` (`COMPANY_INVOICE_PREFIX`) — add new companies there, not by branching on company name in the number logic.
- If adding a 6th company, just add it to `COMPANY_INVOICE_PREFIX` — no server-side changes needed since seq computation isn't company-specific anymore.
