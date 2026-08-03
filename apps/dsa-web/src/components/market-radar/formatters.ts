export type SortKey = 'name' | 'price' | 'changePercent' | 'value' | 'performance' | 'trend' | 'signals';
export type SortDirection = 'asc' | 'desc';

export const money = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
export const number2 = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  HKD: "HK$",
  EUR: "€",
  GBP: "£",
  JPY: "JP¥",
  SGD: "S$",
  AUD: "A$",
};

export function normalizeCurrencyCode(currency?: string | null): string {
  const code = String(currency || "").trim().toUpperCase();
  return code || "CNY";
}

export function currencySymbol(currency?: string | null): string {
  const code = normalizeCurrencyCode(currency);
  return CURRENCY_SYMBOLS[code] || `${code} `;
}

export function signed(value: number, suffix = "") {
  return (value > 0 ? "+" : "") + number2.format(value) + suffix;
}

export function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e12) return number2.format(value / 1e12) + "万亿";
  if (Math.abs(value) >= 1e8) return number2.format(value / 1e8) + "亿";
  if (Math.abs(value) >= 1e4) return number2.format(value / 1e4) + "万";
  return money.format(value);
}

/** Compact money for account/holding cards; keeps 万/亿 and uses account currency symbol. */
export function formatMoneyAmount(value: number, currency?: string | null) {
  if (!Number.isFinite(value)) return "—";
  const symbol = currencySymbol(currency);
  const sign = value < 0 ? "-" : "";
  return `${sign}${symbol}${money.format(Math.abs(value))}`;
}

export function formatCompactMoney(value: number, currency?: string | null) {
  if (!Number.isFinite(value)) return "—";
  const symbol = currencySymbol(currency);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${sign}${symbol}${number2.format(abs / 1e12)}万亿`;
  if (abs >= 1e8) return `${sign}${symbol}${number2.format(abs / 1e8)}亿`;
  if (abs >= 1e4) return `${sign}${symbol}${number2.format(abs / 1e4)}万`;
  return `${sign}${symbol}${money.format(abs)}`;
}

export function formatNetFlow(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "暂无数据";
  if (value === 0) return "净额 0";
  return (value > 0 ? "净流入 " : "净流出 ") + formatAmount(Math.abs(value));
}

export function levelLabel(level: "green" | "orange" | "blue" | "red") {
  return level === "green" ? "强风险" : level === "orange" ? "风险预警" : level === "blue" ? "中性观察" : "正向确认";
}

export function tradingMinuteOfDay(time: string) {
  const digits = time.replace(/\D/g, "");
  if (digits.length < 4) return 0;
  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2, 4));
  const total = hour * 60 + minute;
  const morningStart = 9 * 60 + 30;
  const morningEnd = 11 * 60 + 30;
  const afternoonStart = 13 * 60;
  const afternoonEnd = 15 * 60;
  if (total <= morningStart) return 0;
  if (total <= morningEnd) return total - morningStart;
  if (total < afternoonStart) return 120;
  return Math.min(240, 120 + Math.min(total, afternoonEnd) - afternoonStart);
}
