import { useState, useEffect } from "react";
import { Globe, DollarSign, Loader2, Pencil, CalendarDays } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useOwnerControls, CURRENCIES, type RegionOption } from "@/contexts/OwnerControlsContext";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

const YEAR_OPTIONS = [2024, 2025, 2026, 2027, 2028];

const COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates", UAE: "United Arab Emirates",
  SA: "Saudi Arabia", KSA: "Saudi Arabia",
  NG: "Nigeria", KE: "Kenya", TN: "Tunisia",
  EG: "Egypt", ET: "Ethiopia", QA: "Qatar",
  PK: "Pakistan", IN: "India", GB: "United Kingdom",
  US: "United States", DE: "Germany", FR: "France",
  CN: "China", JP: "Japan", AU: "Australia",
  CA: "Canada", ZA: "South Africa", BH: "Bahrain",
  KW: "Kuwait", OM: "Oman",
};

function countryLabel(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

export function OwnerControlsBar() {
  const {
    selectedRegion, setSelectedRegion, regions,
    sourceCurrency, selectedCurrency, setSelectedCurrency,
    conversionRate, setConversionRate,
    rateLoading, rateEdited, isSameCurrency,
    selectedYear, setSelectedYear,
  } = useOwnerControls();

  const { t } = useTranslation();
  const { user } = useAuth();

  const isTunisian = user?.country === "Tunisia";
  const visibleCurrencies = isTunisian
    ? CURRENCIES.filter((c) => c.code === "EUR")
    : CURRENCIES;

  // Auto-lock Tunisian users to EUR
  useEffect(() => {
    if (isTunisian && selectedCurrency !== "EUR") {
      setSelectedCurrency("EUR");
    }
  }, [isTunisian, selectedCurrency, setSelectedCurrency]);

  const [rateInput, setRateInput] = useState<string>("");
  const [editingRate, setEditingRate] = useState(false);

  function handleRateBlur() {
    const v = parseFloat(rateInput);
    if (!isNaN(v) && v > 0) setConversionRate(v);
    setEditingRate(false);
  }

  function startEditingRate() {
    setRateInput(String(conversionRate));
    setEditingRate(true);
  }

  const displayRate = editingRate ? rateInput : conversionRate.toFixed(4);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3 border-b border-border bg-muted/30">
      {/* Year filter */}
      <div className="flex items-center gap-2 min-w-0">
        <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
        <Label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{t("ownerControls.year")}</Label>
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="h-7 text-xs w-24 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isTunisian && (
        <>
          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Region filter */}
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
            <Label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{t("ownerControls.region")}</Label>
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="h-7 text-xs w-36 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("ownerControls.allRegions")}</SelectItem>
                {regions.map((r: RegionOption) => (
                  <SelectItem key={r.country} value={r.country}>
                    {countryLabel(r.country)}
                  </SelectItem>
                ))}
                {regions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">{t("ownerControls.noSalespersonCountries")}</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />
        </>
      )}

      {/* Currency converter */}
      {!isTunisian && (
        <div className="flex items-center gap-2 flex-wrap">
          <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
          <Label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{t("ownerControls.displayCurrency")}</Label>
          <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
            <SelectTrigger className="h-7 text-xs w-44 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {visibleCurrencies.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!isSameCurrency && user?.role !== "salesperson" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="whitespace-nowrap">1 {sourceCurrency} =</span>
              {rateLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : editingRate ? (
                <Input
                  autoFocus
                  className="h-6 w-24 text-xs px-2"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  onBlur={handleRateBlur}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRateBlur(); if (e.key === "Escape") setEditingRate(false); }}
                />
              ) : (
                <button
                  onClick={startEditingRate}
                  className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary transition-colors"
                  title={t("ownerControls.clickToEditRate")}
                >
                  {displayRate}
                  <Pencil className="w-3 h-3 opacity-50" />
                </button>
              )}
              <span className="whitespace-nowrap">{selectedCurrency}</span>
              {rateEdited && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">
                  {t("common.custom")}
                </Badge>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
