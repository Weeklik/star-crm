import { useState, useEffect, useRef } from "react";
import { Download, ChevronRight, ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateProformaInvoiceHtml, openProformaInvoice } from "@/utils/proformaInvoice";
import starLogo from "@assets/Star-Logo_1782471527362.webp";
import starLogoKSA from "@assets/image_1782548029206.png";
import ghanaHeader from "@assets/image_1784288251350.png";

interface CompanyEntry {
  name: string;
  displayName: string;
  region: string;
  companySelection?: string;
  bankDetails?: string;
  logo?: string;
}

const COUNTRY_COMPANIES: Record<string, CompanyEntry[]> = {
  UAE: [
    {
      name: "STAR SEWING MACHINES TRADING L.L.C",
      displayName: "Star Sewing Machines Trading L.L.C.",
      region: "UAE",
      companySelection: "STAR SEWING MACHINES TRADING L.L.C",
      bankDetails: "AED",
      logo: starLogo,
    },
    {
      name: "STAR GLOBAL TECH FZCO",
      displayName: "Star Global Tech FZCO",
      region: "UAE",
      companySelection: "STAR GLOBAL TECH FZCO",
      bankDetails: "AED",
      logo: starLogo,
    },
    {
      name: "STAR SEWING MACHINES TRADING L.L.C BR",
      displayName: "Star Sewing Machines Trading L.L.C. BR",
      region: "UAE",
      companySelection: "STAR SEWING MACHINES TRADING L.L.C BR",
      bankDetails: "AED",
      logo: starLogo,
    },
    {
      name: "MODREN SEWING MACHINE TRADING",
      displayName: "Modren Sewing Machine Trading",
      region: "UAE",
      companySelection: "MODREN SEWING MACHINE TRADING",
      bankDetails: "AED",
      logo: starLogo,
    },
    {
      name: "DUBAI SEWING MACHINE",
      displayName: "Dubai Sewing Machine",
      region: "UAE",
      companySelection: "DUBAI SEWING MACHINE",
      bankDetails: "AED",
      logo: starLogo,
    },
  ],
  KSA: [
    {
      name: "YOUSEF AMER M. S. BAGHERAN EST",
      displayName: "Yousef Amer M. S. Bagheran Est",
      region: "KSA",
      bankDetails: "KSA-SAR",
      logo: starLogoKSA,
    },
  ],
  Kenya: [
    {
      name: "STAR SEWING MACHINE (K) LTD",
      displayName: "Star Sewing Machine (K) Ltd",
      region: "KE",
      bankDetails: "KEN-KES",
      logo: starLogo,
    },
  ],
  Nigeria: [
    {
      name: "STAR SEWING MACHINES LIMITED",
      displayName: "Star Sewing Machines Limited",
      region: "NG",
      bankDetails: "NIG-NGN",
      logo: starLogo,
    },
  ],
  TN: [
    {
      name: "STAR NORTH AFRICA",
      displayName: "Star North Africa",
      region: "TN",
      bankDetails: "TN-EUR-ATB",
      logo: starLogo,
    },
  ],
  Ghana: [
    {
      name: "STAR WEST AFRICA MACHINERY LTD.",
      displayName: "Star West Africa Machinery Ltd.",
      region: "Ghana",
      bankDetails: "GHA-GHS",
      logo: starLogo,
    },
  ],
  Egypt: [],
  Ethiopia: [],
};

const COUNTRIES = [
  { code: "UAE",      name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "Egypt",    name: "Egypt",                flag: "🇪🇬" },
  { code: "Ethiopia", name: "Ethiopia",             flag: "🇪🇹" },
  { code: "Ghana",    name: "Ghana",                flag: "🇬🇭" },
  { code: "Kenya",    name: "Kenya",                flag: "🇰🇪" },
  { code: "KSA",      name: "Saudi Arabia",         flag: "🇸🇦" },
  { code: "Nigeria",  name: "Nigeria",              flag: "🇳🇬" },
  { code: "TN",       name: "Tunisia",              flag: "🇹🇳" },
];

const SAMPLE_ITEMS = [
  {
    brand: "JUKI",
    model: "DDL-8100e/GSRV",
    description: "1 Needle Lockstitch (Basic, made in Vietnam), Complete set with Table, Stand & GlobalStar Belt type Servo motor 550W",
    qty: 2,
    unitPrice: 1000,
    discountPct: 0,
    vatPct: 0,
  },
  {
    brand: "SINGER",
    model: "M2405",
    description: "4 step buttonhole, Stitch Length Adjustment, 8 built in Stitches",
    qty: 10,
    unitPrice: 500,
    discountPct: 0,
    vatPct: 0,
  },
];

function CountryFlag({ flag, size = "text-2xl" }: { flag: string; size?: string }) {
  return <span className={size} role="img">{flag}</span>;
}

function CompanyAvatar({ logo, name }: { logo?: string; name: string }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        className="w-10 h-10 object-contain rounded bg-white border border-border p-0.5 flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
      <FileText className="w-5 h-5 text-primary" />
    </div>
  );
}

export default function PerformaInvoice() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyEntry | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
    if (!selectedCompany) {
      setPreviewUrl(null);
      return;
    }
    const vatPct =
      selectedCompany.companySelection === "STAR GLOBAL TECH FZCO" ? 0
      : selectedCompany.region === "TN"  ? 0
      : selectedCompany.region === "UAE" ? 5
      : selectedCompany.region === "KSA" ? 15
      : selectedCompany.region === "NG"  ? 7.5
      : selectedCompany.region === "KE"  ? 16
      : 0;

    const html = generateProformaInvoiceHtml({
      id: 77,
      companyName: "SAMPLE",
      contactName: "Kill Robber",
      customerAddress: "1701 Golden Sands Tower Al-Nahda Sharjah",
      customerPhone: "0565012376",
      customerEmail: "killrobber8@gmail.com",
      customerTrn: "12312312376",
      dealStartDate: new Date().toISOString(),
      productItem: "Sewing Machines",
      agreedAmount: 82000,
      receivedAmount: 0,
      outstandingAmount: 82000,
      salespersonName: "Sample Salesperson",
      region: selectedCompany.region,
      companySelection: selectedCompany.companySelection ?? null,
      bankDetails: selectedCompany.bankDetails ?? null,
      logoUrl: selectedCompany.logo,
      vatApplicable: false,
      items: SAMPLE_ITEMS.map((it) => ({ ...it, vatPct })),
      transportationFee: 5,
      paymentTerms: "100% Advance",
      warranty: "1 Year",
      deliveryTerms: "Ex-Works",
      deliveryTime: "2-3 Weeks",
      invoiceSeq: 77,
    });

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    prevUrlRef.current = url;
    setPreviewUrl(url);
  }, [selectedCompany]);

  function handleDownload() {
    if (!selectedCompany) return;
    const vatPct =
      selectedCompany.companySelection === "STAR GLOBAL TECH FZCO" ? 0
      : selectedCompany.region === "TN"  ? 0
      : selectedCompany.region === "UAE" ? 5
      : selectedCompany.region === "KSA" ? 15
      : selectedCompany.region === "NG"  ? 7.5
      : selectedCompany.region === "KE"  ? 16
      : 0;

    openProformaInvoice({
      id: 77,
      companyName: "SAMPLE",
      contactName: "Kill Robber",
      customerAddress: "1701 Golden Sands Tower Al-Nahda Sharjah",
      customerPhone: "0565012376",
      customerEmail: "killrobber8@gmail.com",
      customerTrn: "12312312376",
      dealStartDate: new Date().toISOString(),
      productItem: "Sewing Machines",
      agreedAmount: 82000,
      receivedAmount: 0,
      outstandingAmount: 82000,
      salespersonName: "Sample Salesperson",
      region: selectedCompany.region,
      companySelection: selectedCompany.companySelection ?? null,
      bankDetails: selectedCompany.bankDetails ?? null,
      logoUrl: selectedCompany.logo,
      vatApplicable: false,
      items: SAMPLE_ITEMS.map((it) => ({ ...it, vatPct })),
      transportationFee: 5,
      paymentTerms: "100% Advance",
      warranty: "1 Year",
      deliveryTerms: "Ex-Works",
      deliveryTime: "2-3 Weeks",
      invoiceSeq: 77,
    });
  }

  const companies = selectedCountry ? (COUNTRY_COMPANIES[selectedCountry] ?? []) : [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Performa Invoice Format</h1>
            <p className="text-xs text-muted-foreground">View and manage Performa Invoice (PI) formats for all regions and companies.</p>
          </div>
        </div>
      </div>

      {/* 3-column body */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Panel 1: Countries ── */}
        <div className="w-64 flex-shrink-0 border-r border-border flex flex-col overflow-hidden bg-card">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
              <span className="text-sm font-semibold">Select Region</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-7">Choose a region to view companies and their Performa Invoice formats.</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {COUNTRIES.map((c) => {
              const count = (COUNTRY_COMPANIES[c.code] ?? []).length;
              const isSelected = selectedCountry === c.code;
              return (
                <button
                  key={c.code}
                  onClick={() => {
                    setSelectedCountry(c.code);
                    setSelectedCompany(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    isSelected
                      ? "bg-primary/10 border border-primary/30 ring-1 ring-primary/20"
                      : "hover:bg-secondary border border-transparent"
                  }`}
                >
                  <CountryFlag flag={c.flag} size="text-xl" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">{c.name}</div>
                    {count > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {count} {count === 1 ? "Company" : "Companies"}
                      </div>
                    )}
                  </div>
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Performa Invoice formats are company specific and used for creating Performa Invoices.
            </p>
          </div>
        </div>

        {/* ── Panel 2: Companies ── */}
        <div className={`flex flex-col border-r border-border overflow-hidden transition-all duration-200 ${selectedCompany ? "w-72 flex-shrink-0" : "flex-1"}`}>
          <div className="px-4 py-3 border-b border-border bg-card flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
              <span className="text-sm font-semibold">
                Select Company{selectedCountry ? ` (${COUNTRIES.find(c => c.code === selectedCountry)?.name ?? selectedCountry})` : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-7">Select a company to view its Performa Invoice format.</p>
          </div>

          <div className="flex-1 overflow-y-auto bg-background">
            {!selectedCountry ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Select a region from the left to view its companies</p>
              </div>
            ) : companies.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No companies configured for this region yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {companies.map((company, idx) => {
                  const isSelected = selectedCompany?.name === company.name;
                  return (
                    <button
                      key={company.name}
                      onClick={() => setSelectedCompany(company)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                        isSelected ? "bg-primary/8 border-l-2 border-l-primary" : "hover:bg-secondary/50"
                      }`}
                    >
                      <span className="text-xs text-muted-foreground w-5 font-mono flex-shrink-0">{idx + 1}</span>
                      <CompanyAvatar logo={company.logo} name={company.name} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight truncate">{company.displayName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {COUNTRIES.find(c => c.code === selectedCountry)?.name ?? selectedCountry}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel 3: Preview ── */}
        {selectedCompany && (
          <div className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
            <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between flex-shrink-0 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold flex-shrink-0">3</span>
                <div className="min-w-0">
                  <span className="text-sm font-semibold">Performa Invoice Format Preview</span>
                </div>
              </div>
              <Button size="sm" onClick={handleDownload} className="gap-1.5 flex-shrink-0">
                <Download className="w-4 h-4" />
                Download Format
              </Button>
            </div>

            {/* Company title bar */}
            <div className="px-5 py-3 border-b border-border bg-card/50 flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setSelectedCompany(null)}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Companies
              </button>
              <span className="text-muted-foreground text-xs">·</span>
              <div className="min-w-0">
                <span className="text-sm font-bold truncate">{selectedCompany.displayName.toUpperCase()}</span>
                <span className="text-xs text-muted-foreground ml-2">Performa Invoice Format</span>
              </div>
            </div>

            {/* Iframe preview */}
            <div className="flex-1 overflow-hidden p-4">
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  title="Proforma Invoice Preview"
                  className="w-full h-full rounded-lg border border-border shadow-sm bg-white"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty right panel placeholder when no company selected */}
        {!selectedCompany && selectedCountry && companies.length > 0 && (
          <div className="flex-0 hidden" />
        )}
      </div>
    </div>
  );
}
