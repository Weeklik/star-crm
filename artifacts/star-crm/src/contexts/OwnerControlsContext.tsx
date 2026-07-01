import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

export type DateRange = "fullyear" | "h1" | "h2" | "last30" | "last7";

export const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function getDateBounds(range: DateRange, year: number): { startDate: string; endDate: string } {
  if (range === "fullyear") return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  if (range === "h1")       return { startDate: `${year}-01-01`, endDate: `${year}-06-30` };
  if (range === "h2")       return { startDate: `${year}-07-01`, endDate: `${year}-12-31` };
  const now = new Date();
  const pad = (d: Date) => d.toISOString().split("T")[0];
  if (range === "last7") {
    const s = new Date(now); s.setDate(s.getDate() - 6);
    return { startDate: pad(s), endDate: pad(now) };
  }
  const s = new Date(now); s.setDate(s.getDate() - 29);
  return { startDate: pad(s), endDate: pad(now) };
}

/**
 * Map of country names / codes / common variants → default currency code.
 * Used to auto-select the display currency when a region is chosen.
 */
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  "KSA": "SAR", "UAE": "AED", "Nigeria": "NGN",
  "Tunisia": "TND", "Egypt": "EGP", "Ghana": "GHS", "Kenya": "KES", "Ethiopia": "ETB",
};

export const CURRENCIES: { code: string; name: string }[] = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "ETB", name: "Ethiopian Birr" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "TND", name: "Tunisian Dinar" },
];

export interface RegionOption {
  country: string;
  currency: string | null;
}

interface OwnerControlsContextValue {
  selectedRegion: string;
  setSelectedRegion: (r: string) => void;
  regions: RegionOption[];
  selectedYear: number;
  setSelectedYear: (y: number) => void;

  /** Shared date range filter (synced across Dashboard and Orders) */
  dateRange: DateRange;
  setDateRange: (r: DateRange) => void;
  fromMonth: number;
  setFromMonth: (m: number) => void;
  toMonth: number;
  setToMonth: (m: number) => void;
  getActiveDateBounds: () => { startDate: string; endDate: string };

  /** Owner's profile currency — always fixed to their account setting. */
  baseCurrency: string;
  /**
   * The "natural" currency of the data currently in view.
   * Equals the selected region's currency when a region is active,
   * or baseCurrency when "All Regions" is shown.
   * This is the SOURCE for conversion (rate = 1 sourceCurrency → X selectedCurrency).
   */
  sourceCurrency: string;
  /** The display currency the user wants amounts shown in. */
  selectedCurrency: string;
  setSelectedCurrency: (c: string) => void;
  /** 1 sourceCurrency = conversionRate selectedCurrency */
  conversionRate: number;
  setConversionRate: (r: number) => void;
  rateLoading: boolean;
  rateEdited: boolean;
  /** True when sourceCurrency === selectedCurrency — no conversion needed. */
  isSameCurrency: boolean;

  /**
   * Per-currency rate map for "All Regions" mode.
   * Maps fromCurrency → rate to selectedCurrency (1 fromCurrency = X selectedCurrency).
   * Populated by calling loadMultiRates().
   */
  multiRateMap: Record<string, number>;
  multiRateLoading: boolean;
  /**
   * Fetch rates for multiple currencies → selectedCurrency in one API call.
   * Call this from report pages when "All Regions" is active.
   */
  loadMultiRates: (currencies: string[]) => Promise<void>;
  /**
   * Get the conversion rate: 1 fromCurrency = X selectedCurrency.
   * Uses multiRateMap when available, falls back to conversionRate.
   * Returns 1 if fromCurrency === selectedCurrency.
   */
  getRateFor: (fromCurrency: string) => number;

  convertAmount: (n: number) => number;
  formatConverted: (n: number) => string;
  formatConvertedOrEmpty: (n: number) => string;
}

const OwnerControlsContext = createContext<OwnerControlsContextValue>({
  selectedRegion: "all",
  setSelectedRegion: () => {},
  regions: [] as RegionOption[],
  baseCurrency: "USD",
  sourceCurrency: "USD",
  selectedCurrency: "USD",
  setSelectedCurrency: () => {},
  conversionRate: 1,
  setConversionRate: () => {},
  rateLoading: false,
  rateEdited: false,
  isSameCurrency: true,
  multiRateMap: {},
  multiRateLoading: false,
  loadMultiRates: async () => {},
  getRateFor: () => 1,
  convertAmount: (n) => n,
  formatConverted: (n) => n.toLocaleString(),
  formatConvertedOrEmpty: (n) => (n ? n.toLocaleString() : ""),
  selectedYear: new Date().getFullYear(),
  setSelectedYear: () => {},
  dateRange: "fullyear",
  setDateRange: () => {},
  fromMonth: 0,
  setFromMonth: () => {},
  toMonth: 0,
  setToMonth: () => {},
  getActiveDateBounds: () => ({ startDate: `${new Date().getFullYear()}-01-01`, endDate: `${new Date().getFullYear()}-12-31` }),
});

function fmt(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  }
}

export function OwnerControlsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const baseCurrency = user?.currency ?? "USD";

  const [selectedRegion, setSelectedRegionState] = useState("all");
  const [regions, setRegions] = useState<RegionOption[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/lookup/regions", { credentials: "include" })
      .then((r) => r.json())
      .then((data: RegionOption[]) => {
        if (Array.isArray(data)) setRegions(data);
      })
      .catch(() => {});
  }, [user]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Shared date range filter
  const [dateRange, setDateRangeState] = useState<DateRange>("fullyear");
  const [fromMonth, setFromMonthState] = useState(0);
  const [toMonth, setToMonthState] = useState(0);
  // Reset when year changes
  useEffect(() => { setDateRangeState("fullyear"); setFromMonthState(0); setToMonthState(0); }, [selectedYear]);

  const setDateRange = useCallback((r: DateRange) => setDateRangeState(r), []);
  const setFromMonth = useCallback((m: number) => setFromMonthState(m), []);
  const setToMonth   = useCallback((m: number) => setToMonthState(m), []);

  const getActiveDateBounds = useCallback((): { startDate: string; endDate: string } => {
    if (fromMonth > 0 || toMonth > 0) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const f = fromMonth > 0 ? fromMonth : 1;
      const t = toMonth   > 0 ? toMonth   : fromMonth > 0 ? fromMonth : 12;
      const lastDay = new Date(selectedYear, t, 0).getDate();
      return { startDate: `${selectedYear}-${pad(f)}-01`, endDate: `${selectedYear}-${pad(t)}-${lastDay}` };
    }
    return getDateBounds(dateRange, selectedYear);
  }, [fromMonth, toMonth, dateRange, selectedYear]);
  // sourceCurrency = natural currency of the current view (region's or owner's)
  const [sourceCurrency, setSourceCurrencyState] = useState(baseCurrency);
  // selectedCurrency = what the user wants amounts displayed in
  const [selectedCurrency, setSelectedCurrencyState] = useState(baseCurrency);
  const [conversionRate, setConversionRateState] = useState(1);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateEdited, setRateEdited] = useState(false);
  const [currencyUserSet, setCurrencyUserSet] = useState(false);

  // Sync both currencies to baseCurrency when user profile first loads.
  // (baseCurrency starts as "USD" because user is null on first render.)
  useEffect(() => {
    if (!currencyUserSet && baseCurrency) {
      setSourceCurrencyState(baseCurrency);
      setSelectedCurrencyState(baseCurrency);
    }
  }, [baseCurrency, currencyUserSet]);


  // When a region is selected:
  //   sourceCurrency → region's native currency (data is in that currency)
  //   selectedCurrency → same (default: show amounts as-is, no conversion)
  // When reset to "all":
  //   both → owner's baseCurrency
  const setSelectedRegion = useCallback((r: string) => {
    setSelectedRegionState(r);
    if (r === "all") {
      setSourceCurrencyState(baseCurrency);
      setSelectedCurrencyState(baseCurrency);
      setCurrencyUserSet(false);
      setRateEdited(false);
    } else {
      const regionObj = regions.find((ro) => ro.country === r);
      const currency =
        regionObj?.currency ||   // from salesperson profile
        COUNTRY_CURRENCY_MAP[r]; // static fallback
      if (currency) {
        setSourceCurrencyState(currency);
        setSelectedCurrencyState(currency);
        setCurrencyUserSet(true);
        setRateEdited(false);
      }
    }
  }, [regions, baseCurrency]);

  const fetchRate = useCallback(async (base: string, target: string) => {
    if (base === target) {
      setConversionRateState(1);
      return;
    }
    setRateLoading(true);
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      const data = await res.json();
      const rate = data?.rates?.[target];
      if (rate) setConversionRateState(Number(rate.toFixed(6)));
    } catch {
      // keep existing rate on error
    } finally {
      setRateLoading(false);
    }
  }, []);

  // Rate = "1 sourceCurrency = X selectedCurrency"
  // e.g. Kenya region (KES) + user picks AED → 1 KES = 0.0284 AED
  useEffect(() => {
    setRateEdited(false);
    fetchRate(sourceCurrency, selectedCurrency);
  }, [sourceCurrency, selectedCurrency, fetchRate]);

  // When user manually changes display currency (selectedCurrency only, sourceCurrency stays)
  const setSelectedCurrency = useCallback((c: string) => {
    setSelectedCurrencyState(c);
    setRateEdited(false);
    setCurrencyUserSet(true);
  }, []);

  const setConversionRate = useCallback((r: number) => {
    setConversionRateState(r);
    setRateEdited(true);
  }, []);

  const isSameCurrency = sourceCurrency === selectedCurrency;

  // ── Multi-currency support for "All Regions" mode ──────────────────────────
  const [multiRateMap, setMultiRateMap] = useState<Record<string, number>>({});
  const [multiRateLoading, setMultiRateLoading] = useState(false);

  // Clear map whenever the target display currency changes (rates become stale)
  useEffect(() => {
    setMultiRateMap({});
  }, [selectedCurrency]);

  // One API call: GET /v6/latest/${selectedCurrency} gives "1 selectedCurrency = X other".
  // Invert each to get "1 other = Y selectedCurrency".
  const loadMultiRates = useCallback(async (currencies: string[]) => {
    const unique = [...new Set(currencies.filter(Boolean))];
    if (unique.length === 0) return;
    if (unique.every((c) => c === selectedCurrency)) {
      setMultiRateMap({});
      return;
    }
    setMultiRateLoading(true);
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${selectedCurrency}`);
      const data = await res.json();
      const map: Record<string, number> = {};
      for (const cur of unique) {
        if (cur === selectedCurrency) { map[cur] = 1; continue; }
        const rateFromSelected = data?.rates?.[cur]; // 1 selectedCurrency = X cur
        if (rateFromSelected && rateFromSelected > 0) {
          map[cur] = Number((1 / rateFromSelected).toFixed(6)); // 1 cur = Y selectedCurrency
        }
      }
      setMultiRateMap(map);
    } catch {
      // keep existing map on error
    } finally {
      setMultiRateLoading(false);
    }
  }, [selectedCurrency]);

  // Get rate: 1 fromCurrency = X selectedCurrency.
  // Uses multiRateMap first, falls back to global conversionRate (same-currency-pair fallback).
  const getRateFor = useCallback((fromCurrency: string): number => {
    if (!fromCurrency || fromCurrency === selectedCurrency) return 1;
    return multiRateMap[fromCurrency] ?? conversionRate;
  }, [multiRateMap, selectedCurrency, conversionRate]);

  // convertAmount: multiply by rate to convert sourceCurrency → selectedCurrency
  const convertAmount = useCallback(
    (n: number) => n * conversionRate,
    [conversionRate],
  );

  // formatConverted: show amount in selectedCurrency (not baseCurrency)
  const formatConverted = useCallback(
    (n: number) => fmt(n * conversionRate, selectedCurrency),
    [conversionRate, selectedCurrency],
  );

  const formatConvertedOrEmpty = useCallback(
    (n: number) => (n ? fmt(n * conversionRate, selectedCurrency) : ""),
    [conversionRate, selectedCurrency],
  );

  return (
    <OwnerControlsContext.Provider
      value={{
        selectedRegion,
        setSelectedRegion,
        regions,
        baseCurrency,
        sourceCurrency,
        selectedCurrency,
        setSelectedCurrency,
        conversionRate,
        setConversionRate,
        rateLoading,
        rateEdited,
        isSameCurrency,
        multiRateMap,
        multiRateLoading,
        loadMultiRates,
        getRateFor,
        convertAmount,
        formatConverted,
        formatConvertedOrEmpty,
        selectedYear,
        setSelectedYear,
        dateRange,
        setDateRange,
        fromMonth,
        setFromMonth,
        toMonth,
        setToMonth,
        getActiveDateBounds,
      }}
    >
      {children}
    </OwnerControlsContext.Provider>
  );
}

export function useOwnerControls() {
  return useContext(OwnerControlsContext);
}
