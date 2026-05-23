import { useState, useEffect, useCallback, useRef } from "react";

const mkKey = (year: number, month: number) => `${year}-${month}`;

async function fetchFrankfurter(base: string, target: string, year: number, month: number): Promise<number | null> {
  const dateStr = `${year}-${String(month).padStart(2, "0")}-15`;
  try {
    const res = await fetch(`https://api.frankfurter.app/${dateStr}?from=${base}&to=${target}`);
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.rates?.[target];
    return rate != null ? Number(rate) : null;
  } catch {
    return null;
  }
}

export function useHistoricalRates(
  baseCurrency: string,
  targetCurrency: string,
  liveRate: number,
  months: Array<{ year: number; month: number }>,
) {
  const isSame = baseCurrency === targetCurrency;
  const now = new Date();
  const curKey = mkKey(now.getFullYear(), now.getMonth() + 1);

  // fetched: key → rate value
  // fetchedFromApi: key → true if Frankfurter returned a real rate, false if we used liveRate as fallback
  const [fetched, setFetched] = useState<Record<string, number>>({});
  const [fetchedFromApi, setFetchedFromApi] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const currencyPairRef = useRef(`${baseCurrency}->${targetCurrency}`);
  const pair = `${baseCurrency}->${targetCurrency}`;

  // Reset all state when currency pair changes
  useEffect(() => {
    if (currencyPairRef.current !== pair) {
      currencyPairRef.current = pair;
      setFetched({});
      setFetchedFromApi({});
      setOverrides({});
      setLoading({});
    }
  }, [pair]);

  const monthKeys = months.map((m) => mkKey(m.year, m.month)).join(",");

  // Fetch historical rates from Frankfurter for past months
  useEffect(() => {
    if (isSame) return;

    const toFetch = months.filter(({ year, month }) => {
      const key = mkKey(year, month);
      return key !== curKey && fetched[key] === undefined && !loading[key];
    });

    if (toFetch.length === 0) return;

    setLoading((prev) => {
      const next = { ...prev };
      toFetch.forEach(({ year, month }) => (next[mkKey(year, month)] = true));
      return next;
    });

    Promise.all(
      toFetch.map(async ({ year, month }) => {
        const key = mkKey(year, month);
        const rate = await fetchFrankfurter(baseCurrency, targetCurrency, year, month);
        return { key, rate };
      }),
    ).then((results) => {
      setFetched((prev) => {
        const next = { ...prev };
        for (const { key, rate } of results) {
          // Store the Frankfurter rate if available; use current liveRate as a placeholder
          // (will be updated in the liveRate-sync effect below if liveRate was still 1)
          next[key] = rate ?? liveRate;
        }
        return next;
      });
      setFetchedFromApi((prev) => {
        const next = { ...prev };
        for (const { key, rate } of results) {
          next[key] = rate !== null; // true = real Frankfurter data, false = fallback
        }
        return next;
      });
      setLoading((prev) => {
        const next = { ...prev };
        for (const { key } of results) delete next[key];
        return next;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCurrency, targetCurrency, isSame, monthKeys]);

  // When liveRate changes (e.g. loads from default 1 → real rate), sync two things:
  //  1. The current month always tracks liveRate
  //  2. Any past month that used liveRate as a fallback (Frankfurter returned null) gets updated
  useEffect(() => {
    if (isSame) return;
    setFetched((prev) => {
      const next = { ...prev };
      let changed = false;
      // Update current month
      if (prev[curKey] !== undefined && prev[curKey] !== liveRate) {
        next[curKey] = liveRate;
        changed = true;
      }
      // Update all months whose rate came from the fallback (not real Frankfurter data)
      for (const key of Object.keys(fetchedFromApi)) {
        if (!fetchedFromApi[key]) {
          next[key] = liveRate;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRate]);

  const getRate = useCallback(
    (year: number, month: number): number => {
      if (isSame) return 1;
      const key = mkKey(year, month);
      if (overrides[key] !== undefined) return overrides[key];
      if (key === curKey) return liveRate;
      return fetched[key] ?? liveRate;
    },
    [isSame, overrides, fetched, liveRate, curKey],
  );

  const setOverride = useCallback((year: number, month: number, rate: number) => {
    setOverrides((prev) => ({ ...prev, [mkKey(year, month)]: rate }));
  }, []);

  const isLoading = useCallback(
    (year: number, month: number): boolean => !!loading[mkKey(year, month)],
    [loading],
  );

  const isOverridden = useCallback(
    (year: number, month: number): boolean => mkKey(year, month) in overrides,
    [overrides],
  );

  const isCurrentMonth = useCallback(
    (year: number, month: number): boolean => mkKey(year, month) === curKey,
    [curKey],
  );

  return { getRate, setOverride, isLoading, isOverridden, isCurrentMonth };
}
