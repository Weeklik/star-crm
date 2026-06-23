import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

/**
 * Map of country names / codes / common variants → default currency code.
 * Used to auto-select the display currency when a region is chosen.
 */
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  "Qatar": "QAR", "Saudi Arabia": "SAR", "Kuwait": "KWD", "Bahrain": "BHD",
  "Oman": "OMR", "Egypt": "EGP", "India": "INR", "Pakistan": "PKR",
  "Bangladesh": "BDT", "Sri Lanka": "LKR", "Nepal": "NPR", "Jordan": "JOD",
  "Lebanon": "LBP", "Iraq": "IQD", "Syria": "SYP", "Yemen": "YER",
  "Turkey": "TRY", "Iran": "IRR", "United States": "USD", "United Kingdom": "GBP",
  "Germany": "EUR", "France": "EUR", "Italy": "EUR", "Spain": "EUR",
  "Netherlands": "EUR", "Belgium": "EUR", "Switzerland": "CHF", "Sweden": "SEK",
  "Norway": "NOK", "Denmark": "DKK", "Poland": "PLN", "Russia": "RUB",
  "China": "CNY", "Japan": "JPY", "South Korea": "KRW", "Singapore": "SGD",
  "Malaysia": "MYR", "Indonesia": "IDR", "Thailand": "THB", "Philippines": "PHP",
  "Vietnam": "VND", "Hong Kong": "HKD", "Taiwan": "TWD", "Australia": "AUD",
  "New Zealand": "NZD", "Canada": "CAD", "Mexico": "MXN", "Brazil": "BRL",
  "Argentina": "ARS", "Colombia": "COP", "Chile": "CLP", "South Africa": "ZAR",
  "Nigeria": "NGN", "Kenya": "KES", "Ghana": "GHS", "Ethiopia": "ETB",
  "Tanzania": "TZS", "Uganda": "UGX", "Morocco": "MAD", "Tunisia": "TND",
  "Algeria": "DZD", "Libya": "LYD", "Sudan": "SDG", "Israel": "ILS",
  "Greece": "EUR", "Portugal": "EUR", "Austria": "EUR", "Czech Republic": "CZK",
  "Hungary": "HUF", "Romania": "RON", "Ukraine": "UAH",
};

export const CURRENCIES: { code: string; name: string }[] = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "INR", name: "Indian Rupee" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "THB", name: "Thai Baht" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "OMR", name: "Omani Rial" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "ZAR", name: "South African Rand" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "KRW", name: "South Korean Won" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "ILS", name: "Israeli Shekel" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "TWD", name: "Taiwan Dollar" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "ARS", name: "Argentine Peso" },
  { code: "CLP", name: "Chilean Peso" },
  { code: "COP", name: "Colombian Peso" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "RUB", name: "Russian Ruble" },
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
  const regions: RegionOption[] = [
    { country: "Qatar",           currency: "QAR" },
    { country: "Saudi Arabia",    currency: "SAR" }, { country: "Kuwait",        currency: "KWD" },
    { country: "Bahrain",         currency: "BHD" }, { country: "Oman",          currency: "OMR" },
    { country: "Egypt",           currency: "EGP" }, { country: "India",         currency: "INR" },
    { country: "Pakistan",        currency: "PKR" }, { country: "Bangladesh",    currency: "BDT" },
    { country: "Sri Lanka",       currency: "LKR" }, { country: "Nepal",         currency: "NPR" },
    { country: "Jordan",          currency: "JOD" }, { country: "Lebanon",       currency: "LBP" },
    { country: "Iraq",            currency: "IQD" }, { country: "Syria",         currency: "SYP" },
    { country: "Yemen",           currency: "YER" }, { country: "Turkey",        currency: "TRY" },
    { country: "Iran",            currency: "IRR" }, { country: "United States", currency: "USD" },
    { country: "United Kingdom",  currency: "GBP" }, { country: "Germany",       currency: "EUR" },
    { country: "France",          currency: "EUR" }, { country: "Italy",         currency: "EUR" },
    { country: "Spain",           currency: "EUR" }, { country: "Netherlands",   currency: "EUR" },
    { country: "Belgium",         currency: "EUR" }, { country: "Switzerland",   currency: "CHF" },
    { country: "Sweden",          currency: "SEK" }, { country: "Norway",        currency: "NOK" },
    { country: "Denmark",         currency: "DKK" }, { country: "Poland",        currency: "PLN" },
    { country: "Russia",          currency: "RUB" }, { country: "China",         currency: "CNY" },
    { country: "Japan",           currency: "JPY" }, { country: "South Korea",   currency: "KRW" },
    { country: "Singapore",       currency: "SGD" }, { country: "Malaysia",      currency: "MYR" },
    { country: "Indonesia",       currency: "IDR" }, { country: "Thailand",      currency: "THB" },
    { country: "Philippines",     currency: "PHP" }, { country: "Vietnam",       currency: "VND" },
    { country: "Hong Kong",       currency: "HKD" }, { country: "Taiwan",        currency: "TWD" },
    { country: "Australia",       currency: "AUD" }, { country: "New Zealand",   currency: "NZD" },
    { country: "Canada",          currency: "CAD" }, { country: "Mexico",        currency: "MXN" },
    { country: "Brazil",          currency: "BRL" }, { country: "Argentina",     currency: "ARS" },
    { country: "Colombia",        currency: "COP" }, { country: "Chile",         currency: "CLP" },
    { country: "South Africa",    currency: "ZAR" }, { country: "Nigeria",       currency: "NGN" },
    { country: "Kenya",           currency: "KES" }, { country: "Ghana",         currency: "GHS" },
    { country: "Ethiopia",        currency: "ETB" }, { country: "Tanzania",      currency: "TZS" },
    { country: "Uganda",          currency: "UGX" }, { country: "Morocco",       currency: "MAD" },
    { country: "Tunisia",         currency: "TND" }, { country: "Algeria",       currency: "DZD" },
    { country: "Libya",           currency: "LYD" }, { country: "Sudan",         currency: "SDG" },
    { country: "Israel",          currency: "ILS" }, { country: "Greece",        currency: "EUR" },
    { country: "Portugal",        currency: "EUR" }, { country: "Austria",       currency: "EUR" },
    { country: "Czech Republic",  currency: "CZK" }, { country: "Hungary",       currency: "HUF" },
    { country: "Romania",         currency: "RON" }, { country: "Ukraine",       currency: "UAH" },
  ];
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
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
      }}
    >
      {children}
    </OwnerControlsContext.Provider>
  );
}

export function useOwnerControls() {
  return useContext(OwnerControlsContext);
}
