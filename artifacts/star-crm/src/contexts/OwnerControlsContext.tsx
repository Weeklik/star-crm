import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

/**
 * Map of country names / codes / common variants → default currency code.
 * Used to auto-select the display currency when a region is chosen.
 */
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // United Arab Emirates
  "United Arab Emirates": "AED", "UAE": "AED", "AE": "AED", "Emirates": "AED",
  // Saudi Arabia
  "Saudi Arabia": "SAR", "KSA": "SAR", "SA": "SAR",
  // Kuwait
  "Kuwait": "KWD", "KW": "KWD",
  // Qatar
  "Qatar": "QAR", "QA": "QAR",
  // Bahrain
  "Bahrain": "BHD", "BH": "BHD",
  // Oman
  "Oman": "OMR", "OM": "OMR",
  // Egypt
  "Egypt": "EGP", "EG": "EGP",
  // India
  "India": "INR", "IN": "INR",
  // Pakistan
  "Pakistan": "PKR", "PK": "PKR",
  // Bangladesh
  "Bangladesh": "BDT", "BD": "BDT",
  // United Kingdom
  "United Kingdom": "GBP", "UK": "GBP", "GB": "GBP", "Britain": "GBP", "England": "GBP",
  // United States
  "United States": "USD", "USA": "USD", "US": "USD", "America": "USD",
  // Euro zone
  "Germany": "EUR", "DE": "EUR",
  "France": "EUR", "FR": "EUR",
  "Italy": "EUR", "IT": "EUR",
  "Spain": "EUR", "ES": "EUR",
  "Netherlands": "EUR", "NL": "EUR",
  "Belgium": "EUR", "BE": "EUR",
  "Portugal": "EUR", "PT": "EUR",
  "Austria": "EUR", "AT": "EUR",
  "Ireland": "EUR", "IE": "EUR",
  "Greece": "EUR", "GR": "EUR",
  "Finland": "EUR", "FI": "EUR",
  "Europe": "EUR", "EU": "EUR",
  // Japan
  "Japan": "JPY", "JP": "JPY",
  // China
  "China": "CNY", "CN": "CNY", "PRC": "CNY",
  // Canada
  "Canada": "CAD", "CA": "CAD",
  // Australia
  "Australia": "AUD", "AU": "AUD",
  // Switzerland
  "Switzerland": "CHF", "CH": "CHF",
  // Singapore
  "Singapore": "SGD", "SG": "SGD",
  // Hong Kong
  "Hong Kong": "HKD", "HK": "HKD",
  // Malaysia
  "Malaysia": "MYR", "MY": "MYR",
  // Thailand
  "Thailand": "THB", "TH": "THB",
  // Philippines
  "Philippines": "PHP", "PH": "PHP",
  // Indonesia
  "Indonesia": "IDR", "ID": "IDR",
  // South Korea
  "South Korea": "KRW", "Korea": "KRW", "KR": "KRW",
  // Nigeria
  "Nigeria": "NGN", "NG": "NGN",
  // South Africa
  "South Africa": "ZAR", "ZA": "ZAR",
  // Turkey
  "Turkey": "TRY", "Türkiye": "TRY", "TR": "TRY",
  // Mexico
  "Mexico": "MXN", "MX": "MXN",
  // Brazil
  "Brazil": "BRL", "BR": "BRL",
  // Sweden
  "Sweden": "SEK", "SE": "SEK",
  // Norway
  "Norway": "NOK", "NO": "NOK",
  // Denmark
  "Denmark": "DKK", "DK": "DKK",
  // Poland
  "Poland": "PLN", "PL": "PLN",
  // Czech Republic
  "Czech Republic": "CZK", "Czechia": "CZK", "CZ": "CZK",
  // Hungary
  "Hungary": "HUF", "HU": "HUF",
  // Russia
  "Russia": "RUB", "RU": "RUB",
  // Kenya
  "Kenya": "KES", "KE": "KES",
  // Israel
  "Israel": "ILS", "IL": "ILS",
  // Sri Lanka
  "Sri Lanka": "LKR", "LK": "LKR",
  // New Zealand
  "New Zealand": "NZD", "NZ": "NZD",
  // Taiwan
  "Taiwan": "TWD", "TW": "TWD",
  // Vietnam
  "Vietnam": "VND", "VN": "VND",
  // Argentina
  "Argentina": "ARS", "AR": "ARS",
  // Chile
  "Chile": "CLP", "CL": "CLP",
  // Colombia
  "Colombia": "COP", "CO": "COP",
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

  baseCurrency: string;
  selectedCurrency: string;
  setSelectedCurrency: (c: string) => void;
  conversionRate: number;
  setConversionRate: (r: number) => void;
  rateLoading: boolean;
  rateEdited: boolean;

  convertAmount: (n: number) => number;
  formatConverted: (n: number) => string;
  formatConvertedOrEmpty: (n: number) => string;
}

const OwnerControlsContext = createContext<OwnerControlsContextValue>({
  selectedRegion: "all",
  setSelectedRegion: () => {},
  regions: [] as RegionOption[],
  baseCurrency: "USD",
  selectedCurrency: "USD",
  setSelectedCurrency: () => {},
  conversionRate: 1,
  setConversionRate: () => {},
  rateLoading: false,
  rateEdited: false,
  convertAmount: (n) => n,
  formatConverted: (n) => n.toLocaleString(),
  formatConvertedOrEmpty: (n) => (n ? n.toLocaleString() : ""),
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
  const [selectedCurrency, setSelectedCurrencyState] = useState(baseCurrency);
  const [conversionRate, setConversionRateState] = useState(1);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateEdited, setRateEdited] = useState(false);
  const [currencyUserSet, setCurrencyUserSet] = useState(false);

  // Sync selectedCurrency to baseCurrency when user profile first loads
  // (baseCurrency starts as "USD" default because user is null at first render)
  useEffect(() => {
    if (!currencyUserSet && baseCurrency) {
      setSelectedCurrencyState(baseCurrency);
    }
  }, [baseCurrency, currencyUserSet]);

  // Fetch distinct regions (with currencies) from API
  useEffect(() => {
    if (user?.role !== "owner") return;
    fetch("/api/lookup/regions", { credentials: "include" })
      .then((r) => r.json())
      .then((data: RegionOption[]) => setRegions(data))
      .catch(() => {});
  }, [user?.role]);

  // Auto-set display currency when region changes.
  // Priority: 1) salesperson's profile currency, 2) static country→currency map.
  const setSelectedRegion = useCallback((r: string) => {
    setSelectedRegionState(r);
    if (r === "all") {
      // Reset to base currency when going back to "all"
      setSelectedCurrencyState(baseCurrency);
      setCurrencyUserSet(false);
      setRateEdited(false);
    } else {
      const regionObj = regions.find((ro) => ro.country === r);
      const currency =
        regionObj?.currency ||        // from salesperson profile
        COUNTRY_CURRENCY_MAP[r];      // static fallback
      if (currency) {
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

  // Re-fetch when base currency (user profile) or selected currency changes.
  // We fetch selectedCurrency→baseCurrency so the rate means "1 deal-currency = X owner-currency".
  useEffect(() => {
    setRateEdited(false);
    fetchRate(selectedCurrency, baseCurrency);
  }, [baseCurrency, selectedCurrency, fetchRate]);

  const setSelectedCurrency = useCallback((c: string) => {
    setSelectedCurrencyState(c);
    setRateEdited(false);
    setCurrencyUserSet(true);
  }, []);

  const setConversionRate = useCallback((r: number) => {
    setConversionRateState(r);
    setRateEdited(true);
  }, []);

  const convertAmount = useCallback(
    (n: number) => n * conversionRate,
    [conversionRate],
  );

  const formatConverted = useCallback(
    (n: number) => fmt(n * conversionRate, baseCurrency),
    [conversionRate, baseCurrency],
  );

  const formatConvertedOrEmpty = useCallback(
    (n: number) => (n ? fmt(n * conversionRate, baseCurrency) : ""),
    [conversionRate, baseCurrency],
  );

  return (
    <OwnerControlsContext.Provider
      value={{
        selectedRegion,
        setSelectedRegion,
        regions,
        baseCurrency,
        selectedCurrency,
        setSelectedCurrency,
        conversionRate,
        setConversionRate,
        rateLoading,
        rateEdited,
        convertAmount,
        formatConverted,
        formatConvertedOrEmpty,
      }}
    >
      {children}
    </OwnerControlsContext.Provider>
  );
}

export function useOwnerControls() {
  return useContext(OwnerControlsContext);
}
