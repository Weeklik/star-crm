import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

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
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "RUB", name: "Russian Ruble" },
];

interface OwnerControlsContextValue {
  selectedRegion: string;
  setSelectedRegion: (r: string) => void;
  regions: string[];

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
  regions: [],
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

  const [selectedRegion, setSelectedRegion] = useState("all");
  const [regions, setRegions] = useState<string[]>([]);
  const [selectedCurrency, setSelectedCurrencyState] = useState(baseCurrency);
  const [conversionRate, setConversionRateState] = useState(1);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateEdited, setRateEdited] = useState(false);

  // Fetch distinct regions from API
  useEffect(() => {
    if (user?.role !== "owner") return;
    fetch("/api/lookup/regions", { credentials: "include" })
      .then((r) => r.json())
      .then((data: string[]) => setRegions(data))
      .catch(() => {});
  }, [user?.role]);

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

  // Re-fetch when base currency (user profile) or selected currency changes
  useEffect(() => {
    setRateEdited(false);
    fetchRate(baseCurrency, selectedCurrency);
  }, [baseCurrency, selectedCurrency, fetchRate]);

  const setSelectedCurrency = useCallback((c: string) => {
    setSelectedCurrencyState(c);
    setRateEdited(false);
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
