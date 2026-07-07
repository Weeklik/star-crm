import { createContext, useContext } from "react";
import { useAuth } from "./AuthContext";

interface CurrencyContextValue {
  currency: string;
  formatAmount: (n: number) => string;
  formatAmountOrEmpty: (n: number) => string;
}

const defaultFormat = (n: number, currency = "USD") => {
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
};

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  formatAmount: (n) => defaultFormat(n, "USD"),
  formatAmountOrEmpty: (n) => (n ? defaultFormat(n, "USD") : ""),
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const currency = user?.country === "Tunisia" ? "EUR" : (user?.currency ?? "USD");

  const formatAmount = (n: number): string => defaultFormat(n, currency);
  const formatAmountOrEmpty = (n: number): string => (n ? defaultFormat(n, currency) : "");

  return (
    <CurrencyContext.Provider value={{ currency, formatAmount, formatAmountOrEmpty }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
