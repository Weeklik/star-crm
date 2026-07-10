export const COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates", UAE: "United Arab Emirates",
  SA: "Saudi Arabia", KSA: "Saudi Arabia", SAUDI: "Saudi Arabia",
  NG: "Nigeria", NIGERIA: "Nigeria",
  KE: "Kenya", KENYA: "Kenya",
  TN: "Tunisia", TUNISIA: "Tunisia",
  EG: "Egypt", EGYPT: "Egypt",
  ET: "Ethiopia", ETHIOPIA: "Ethiopia",
  GH: "Ghana", GHANA: "Ghana",
  QA: "Qatar", QATAR: "Qatar",
  PK: "Pakistan", IN: "India", GB: "United Kingdom",
  US: "United States", DE: "Germany", FR: "France",
  CN: "China", JP: "Japan", AU: "Australia",
  CA: "Canada", ZA: "South Africa", BH: "Bahrain",
  KW: "Kuwait", OM: "Oman",
};

export function countryLabel(code?: string | null): string {
  if (!code) return "—";
  return COUNTRY_NAMES[code.toUpperCase().trim()] ?? code;
}
